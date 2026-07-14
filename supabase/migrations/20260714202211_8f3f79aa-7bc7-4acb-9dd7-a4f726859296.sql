DROP FUNCTION IF EXISTS public.submit_registration(uuid, text, text, uuid, uuid, date, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_registration(
  _tenant_id uuid,
  _name text,
  _phone text,
  _fee_plan_id uuid,
  _batch_id uuid DEFAULT NULL::uuid,
  _dob date DEFAULT NULL::date,
  _guardian_name text DEFAULT NULL::text,
  _guardian_phone text DEFAULT NULL::text,
  _whatsapp text DEFAULT NULL::text,
  _policy_acceptances jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF _phone IS NULL OR btrim(_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF _fee_plan_id IS NULL THEN RAISE EXCEPTION 'Fee plan is required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'Academy not accepting registrations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fee_plans WHERE id = _fee_plan_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid fee plan';
  END IF;
  IF _batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.batches WHERE id = _batch_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid batch';
  END IF;

  INSERT INTO public.registrations (
    tenant_id, name, phone, whatsapp, guardian_name, guardian_phone,
    dob, batch_id, fee_plan_id, status, payment_status, policy_acceptances
  ) VALUES (
    _tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_whatsapp),''),
    NULLIF(btrim(_guardian_name),''), NULLIF(btrim(_guardian_phone),''),
    _dob, _batch_id, _fee_plan_id, 'new', 'pending',
    COALESCE(_policy_acceptances, '[]'::jsonb)
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;
