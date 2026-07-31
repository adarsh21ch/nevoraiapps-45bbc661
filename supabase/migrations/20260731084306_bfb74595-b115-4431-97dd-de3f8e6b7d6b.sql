-- 1. Link column so the mirror is idempotent and traceable.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS billing_payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_billing_payment_id_key
  ON public.payments (billing_payment_id) WHERE billing_payment_id IS NOT NULL;

-- 2. Bridge: Billing V2 (canonical) -> legacy payments (read model).
CREATE OR REPLACE FUNCTION public.mirror_billing_payment_to_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text;
  v_note text;
  v_type text;
BEGIN
  IF coalesce(current_setting('academyos.skip_mirror', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('succeeded', 'success') THEN
    v_period := substring(coalesce(NEW.remarks, '') from '\[period:([^\]]+)\]');
    IF v_period IS NULL OR v_period = '' THEN
      v_period := to_char(NEW.collected_at, 'YYYY-MM');
    END IF;

    v_note := nullif(btrim(regexp_replace(coalesce(NEW.remarks, ''), '\[period:[^\]]+\]', '')), '');

    v_type := CASE
      WHEN coalesce(NEW.remarks, '') ILIKE '%registration%' THEN 'registration'
      WHEN coalesce(NEW.remarks, '') ILIKE '%admission%' THEN 'admission'
      ELSE 'monthly'
    END;

    INSERT INTO public.payments (
      tenant_id, student_id, amount, type, period, method, note, recorded_by,
      created_at, billing_payment_id
    )
    VALUES (
      NEW.tenant_id, NEW.student_id, NEW.amount, v_type, v_period,
      coalesce(nullif(NEW.method, ''), 'upi'), v_note,
      coalesce(NEW.collected_by, NEW.created_by),
      NEW.collected_at, NEW.id
    )
    ON CONFLICT (billing_payment_id) WHERE billing_payment_id IS NOT NULL DO UPDATE
      SET amount = EXCLUDED.amount,
          method = EXCLUDED.method,
          period = EXCLUDED.period,
          note = EXCLUDED.note;
  ELSE
    -- refunded / failed / pending -> keep the read model clean
    DELETE FROM public.payments WHERE billing_payment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_billing_payment ON public.billing_payments;
CREATE TRIGGER trg_mirror_billing_payment
AFTER INSERT OR UPDATE OF status, amount, method, remarks, collected_at
ON public.billing_payments
FOR EACH ROW EXECUTE FUNCTION public.mirror_billing_payment_to_legacy();

-- 3. Reconcile existing data.
DO $$
DECLARE
  r record;
  v_new_id uuid;
  v_period text;
BEGIN
  PERFORM set_config('academyos.skip_mirror', 'on', true);

  -- 3a. Legacy rows already duplicated in V2 (client dual-write): link them.
  FOR r IN
    SELECT p.id AS legacy_id, bp.id AS v2_id
    FROM public.payments p
    JOIN public.billing_payments bp
      ON bp.tenant_id = p.tenant_id
     AND bp.student_id = p.student_id
     AND bp.amount = p.amount
     AND abs(extract(epoch FROM (bp.collected_at - p.created_at))) < 120
    WHERE p.billing_payment_id IS NULL
  LOOP
    UPDATE public.payments SET billing_payment_id = r.v2_id
    WHERE id = r.legacy_id
      AND NOT EXISTS (SELECT 1 FROM public.payments x WHERE x.billing_payment_id = r.v2_id);
  END LOOP;

  -- 3b. Legacy-only rows: backfill into Billing V2 so it holds full history.
  FOR r IN
    SELECT * FROM public.payments WHERE billing_payment_id IS NULL AND student_id IS NOT NULL
  LOOP
    v_period := coalesce(r.period, to_char(r.created_at, 'YYYY-MM'));
    INSERT INTO public.billing_payments (
      tenant_id, student_id, amount, method, status, collected_at, collected_by,
      created_by, remarks, idempotency_key
    ) VALUES (
      r.tenant_id, r.student_id, r.amount, r.method, 'succeeded', r.created_at,
      r.recorded_by, r.recorded_by,
      '[period:' || v_period || ']' || coalesce(' ' || r.note, ''),
      'legacy:' || r.id::text
    )
    RETURNING id INTO v_new_id;

    UPDATE public.payments SET billing_payment_id = v_new_id WHERE id = r.id;
  END LOOP;

  PERFORM set_config('academyos.skip_mirror', 'off', true);
END;
$$;