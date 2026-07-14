
-- ============================================================================
-- Phase 02.7 — Financial Core (Subscription → Charge → Invoice → Payment)
-- ============================================================================

-- ---------- Extend fee_plans (additive, non-breaking) ----------------------
ALTER TABLE public.fee_plans
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IN ('monthly','quarterly','half_yearly','yearly','one_time')),
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS cycle_anchor_day smallint
    CHECK (cycle_anchor_day BETWEEN 1 AND 28);

-- ---------- Owner check helper --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_uid uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid AND tenant_id = _tenant AND role = 'owner'
  );
$$;

-- ---------- Generic updated_at trigger (reuse existing touch_updated_at) --

-- ============================================================================
-- 1. billing_subscriptions
-- ============================================================================
CREATE TABLE public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  enrollment_id uuid NULL,                          -- future-ready
  fee_plan_id uuid NULL REFERENCES public.fee_plans(id) ON DELETE SET NULL,

  -- Price snapshot (frozen at creation)
  unit_amount numeric(14,2) NOT NULL CHECK (unit_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','quarterly','half_yearly','yearly','one_time')),
  cycle_anchor_day smallint NOT NULL DEFAULT 1
    CHECK (cycle_anchor_day BETWEEN 1 AND 28),

  -- Lifecycle
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing','active','paused','past_due','canceled','ended')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NULL,
  pause_start date NULL,
  pause_end date NULL,
  canceled_at timestamptz NULL,
  cancel_reason text NULL,

  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);
CREATE INDEX idx_bsub_tenant_student ON public.billing_subscriptions(tenant_id, student_id);
CREATE INDEX idx_bsub_tenant_status ON public.billing_subscriptions(tenant_id, status);
CREATE INDEX idx_bsub_enrollment ON public.billing_subscriptions(enrollment_id) WHERE enrollment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bsub_owner_all ON public.billing_subscriptions FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_bsub_updated BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 2. billing_discounts (recurring discounts / scholarships)
-- ============================================================================
CREATE TABLE public.billing_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percent','fixed','scholarship')),
  value numeric(14,2) NOT NULL CHECK (value >= 0),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date NULL,
  active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);
CREATE INDEX idx_bdisc_sub ON public.billing_discounts(subscription_id);
CREATE INDEX idx_bdisc_tenant ON public.billing_discounts(tenant_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_discounts TO authenticated;
GRANT ALL ON public.billing_discounts TO service_role;
ALTER TABLE public.billing_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bdisc_owner_all ON public.billing_discounts FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_bdisc_updated BEFORE UPDATE ON public.billing_discounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 3. billing_charges
-- ============================================================================
CREATE TABLE public.billing_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid NULL REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,

  period_start date NOT NULL,
  period_end date NOT NULL,
  period_key text NOT NULL,                        -- e.g. '2026-03' for dedupe
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  description text NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','invoiced','void')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,

  CONSTRAINT bcharge_period_valid CHECK (period_end >= period_start)
);
CREATE UNIQUE INDEX uq_bcharge_sub_period ON public.billing_charges(subscription_id, period_key)
  WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_bcharge_tenant_status ON public.billing_charges(tenant_id, status);
CREATE INDEX idx_bcharge_student ON public.billing_charges(tenant_id, student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_charges TO authenticated;
GRANT ALL ON public.billing_charges TO service_role;
ALTER TABLE public.billing_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY bcharge_owner_all ON public.billing_charges FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_bcharge_updated BEFORE UPDATE ON public.billing_charges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 4. billing_invoices
-- ============================================================================
CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  subscription_id uuid NULL REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,

  number text NULL,                                -- assigned on issue
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','partially_paid','paid','void','uncollectible')),

  issue_date date NULL,
  due_date date NULL,
  period_start date NULL,
  period_end date NULL,

  currency char(3) NOT NULL DEFAULT 'INR',
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance numeric(14,2) NOT NULL DEFAULT 0,

  issued_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);
CREATE UNIQUE INDEX uq_binv_tenant_number ON public.billing_invoices(tenant_id, number) WHERE number IS NOT NULL;
CREATE INDEX idx_binv_tenant_status ON public.billing_invoices(tenant_id, status);
CREATE INDEX idx_binv_tenant_student ON public.billing_invoices(tenant_id, student_id);
CREATE INDEX idx_binv_tenant_due ON public.billing_invoices(tenant_id, due_date) WHERE status IN ('issued','partially_paid');
CREATE INDEX idx_binv_tenant_created ON public.billing_invoices(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY binv_owner_all ON public.billing_invoices FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_binv_updated BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Immutability guard on issued invoices --------------------------
CREATE OR REPLACE FUNCTION public.billing_invoice_immutability_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  -- Once issued: financial fields frozen. Only balance/paid/status/notes may change.
  IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.discount_total IS DISTINCT FROM OLD.discount_total
     OR NEW.tax_total IS DISTINCT FROM OLD.tax_total
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.number IS DISTINCT FROM OLD.number
     OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
  THEN
    RAISE EXCEPTION 'Invoice % is issued and immutable. Use billing_invoice_adjustments for corrections.', OLD.id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_binv_immutable BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_immutability_guard();

-- ============================================================================
-- 5. billing_invoice_lines
-- ============================================================================
CREATE TABLE public.billing_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  charge_id uuid NULL REFERENCES public.billing_charges(id) ON DELETE SET NULL,

  line_type text NOT NULL
    CHECK (line_type IN ('charge','discount','scholarship','tax','adjustment','one_time')),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount numeric(14,2) NOT NULL,             -- negative for discounts
  amount numeric(14,2) NOT NULL,                   -- quantity * unit_amount
  period_start date NULL,
  period_end date NULL,
  sort_order int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX idx_bline_invoice ON public.billing_invoice_lines(invoice_id, sort_order);
CREATE INDEX idx_bline_tenant ON public.billing_invoice_lines(tenant_id);
CREATE INDEX idx_bline_charge ON public.billing_invoice_lines(charge_id) WHERE charge_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoice_lines TO authenticated;
GRANT ALL ON public.billing_invoice_lines TO service_role;
ALTER TABLE public.billing_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY bline_owner_all ON public.billing_invoice_lines FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_bline_updated BEFORE UPDATE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Prevent line edits on issued invoices
CREATE OR REPLACE FUNCTION public.billing_invoice_line_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE inv_status text;
BEGIN
  SELECT status INTO inv_status FROM public.billing_invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF inv_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Cannot modify lines on a non-draft invoice. Use an adjustment.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_bline_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_line_guard();

-- ============================================================================
-- 6. billing_payments
-- ============================================================================
CREATE TABLE public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,

  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'INR',

  method text NOT NULL
    CHECK (method IN ('cash','upi','qr','bank_transfer','card','gateway','cheque','other')),
  reference_number text NULL,
  gateway text NULL,                               -- 'razorpay','stripe',... null for manual
  gateway_reference text NULL,
  gateway_payload jsonb NULL,
  idempotency_key text NULL,

  status text NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('pending','succeeded','failed','refunded','partially_refunded')),

  collected_by uuid NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  remarks text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);
CREATE UNIQUE INDEX uq_bpay_tenant_idempotency ON public.billing_payments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_bpay_tenant_student ON public.billing_payments(tenant_id, student_id);
CREATE INDEX idx_bpay_tenant_status ON public.billing_payments(tenant_id, status);
CREATE INDEX idx_bpay_tenant_collected ON public.billing_payments(tenant_id, collected_at DESC);
CREATE INDEX idx_bpay_gateway_ref ON public.billing_payments(gateway, gateway_reference)
  WHERE gateway_reference IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY bpay_owner_all ON public.billing_payments FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_bpay_updated BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 7. billing_payment_allocations
-- ============================================================================
CREATE TABLE public.billing_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.billing_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX idx_balloc_payment ON public.billing_payment_allocations(payment_id);
CREATE INDEX idx_balloc_invoice ON public.billing_payment_allocations(invoice_id);
CREATE INDEX idx_balloc_tenant ON public.billing_payment_allocations(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payment_allocations TO authenticated;
GRANT ALL ON public.billing_payment_allocations TO service_role;
ALTER TABLE public.billing_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY balloc_owner_all ON public.billing_payment_allocations FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ============================================================================
-- 8. billing_invoice_adjustments (credit notes / waivers / write-offs)
-- ============================================================================
CREATE TABLE public.billing_invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('credit_note','waiver','writeoff','refund_reversal')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);
CREATE INDEX idx_badj_invoice ON public.billing_invoice_adjustments(invoice_id);
CREATE INDEX idx_badj_tenant ON public.billing_invoice_adjustments(tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoice_adjustments TO authenticated;
GRANT ALL ON public.billing_invoice_adjustments TO service_role;
ALTER TABLE public.billing_invoice_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY badj_owner_all ON public.billing_invoice_adjustments FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ============================================================================
-- 9. billing_audit_log
-- ============================================================================
CREATE TABLE public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,             -- 'invoice','payment','subscription','charge','adjustment'
  entity_id uuid NOT NULL,
  action text NOT NULL,                  -- 'created','issued','voided','paid','adjusted', ...
  actor_id uuid NULL,
  before_state jsonb NULL,
  after_state jsonb NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_baudit_tenant_created ON public.billing_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_baudit_entity ON public.billing_audit_log(entity_type, entity_id);

GRANT SELECT, INSERT ON public.billing_audit_log TO authenticated;
GRANT ALL ON public.billing_audit_log TO service_role;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY baudit_owner_read ON public.billing_audit_log FOR SELECT TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY baudit_owner_insert ON public.billing_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ============================================================================
-- Invoice numbering: assign INV-YYYY-NNNNN on issue
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_billing_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  year_part text;
  next_num int;
  candidate text;
BEGIN
  IF NEW.number IS NOT NULL AND btrim(NEW.number) <> '' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN RETURN NEW; END IF;

  year_part := to_char(COALESCE(NEW.issue_date, CURRENT_DATE), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '^INV-' || year_part || '-', ''), '')::int), 0) + 1
    INTO next_num
    FROM public.billing_invoices
   WHERE tenant_id = NEW.tenant_id
     AND number ~ ('^INV-' || year_part || '-[0-9]+$');

  LOOP
    candidate := 'INV-' || year_part || '-' || lpad(next_num::text, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.billing_invoices
      WHERE tenant_id = NEW.tenant_id AND number = candidate
    );
    next_num := next_num + 1;
  END LOOP;
  NEW.number := candidate;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_binv_assign_number
  BEFORE INSERT OR UPDATE OF status ON public.billing_invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_billing_invoice_number();

-- ============================================================================
-- RPC: issue_billing_invoice
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_billing_invoice(_invoice_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), inv.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF inv.status <> 'draft' THEN RAISE EXCEPTION 'Only draft invoices can be issued'; END IF;

  UPDATE public.billing_invoices
     SET status = 'issued',
         issue_date = COALESCE(issue_date, CURRENT_DATE),
         issued_at = now(),
         balance = total - amount_paid
   WHERE id = _invoice_id;

  UPDATE public.billing_charges
     SET status = 'invoiced'
   WHERE id IN (SELECT charge_id FROM public.billing_invoice_lines
                WHERE invoice_id = _invoice_id AND charge_id IS NOT NULL);

  INSERT INTO public.billing_audit_log(tenant_id, entity_type, entity_id, action, actor_id, after_state)
  VALUES (inv.tenant_id, 'invoice', _invoice_id, 'issued', auth.uid(),
          jsonb_build_object('total', inv.total));
  RETURN _invoice_id;
END; $$;

-- ============================================================================
-- RPC: void_billing_invoice
-- ============================================================================
CREATE OR REPLACE FUNCTION public.void_billing_invoice(_invoice_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices%ROWTYPE; paid numeric;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), inv.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF inv.status IN ('void','paid') THEN RAISE EXCEPTION 'Cannot void a % invoice', inv.status; END IF;

  SELECT COALESCE(SUM(a.amount),0) INTO paid
    FROM public.billing_payment_allocations a
    JOIN public.billing_payments p ON p.id = a.payment_id AND p.status = 'succeeded'
   WHERE a.invoice_id = _invoice_id;
  IF paid > 0 THEN RAISE EXCEPTION 'Cannot void invoice with successful payments; use adjustments'; END IF;

  UPDATE public.billing_invoices SET status = 'void', notes = COALESCE(notes,'') || E'\nVOID: ' || _reason
   WHERE id = _invoice_id;
  UPDATE public.billing_charges SET status = 'void'
   WHERE id IN (SELECT charge_id FROM public.billing_invoice_lines WHERE invoice_id = _invoice_id AND charge_id IS NOT NULL);

  INSERT INTO public.billing_audit_log(tenant_id, entity_type, entity_id, action, actor_id, metadata)
  VALUES (inv.tenant_id, 'invoice', _invoice_id, 'voided', auth.uid(), jsonb_build_object('reason', _reason));
  RETURN _invoice_id;
END; $$;

-- ============================================================================
-- RPC: record_billing_payment (atomic payment + allocations)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_billing_payment(
  _tenant_id uuid,
  _student_id uuid,
  _amount numeric,
  _method text,
  _allocations jsonb,           -- [{"invoice_id":"...","amount":123.45}, ...]
  _reference_number text DEFAULT NULL,
  _gateway text DEFAULT NULL,
  _gateway_reference text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _collected_at timestamptz DEFAULT now(),
  _remarks text DEFAULT NULL,
  _status text DEFAULT 'succeeded'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_id uuid;
  new_payment_id uuid;
  alloc_sum numeric := 0;
  alloc jsonb;
  inv public.billing_invoices%ROWTYPE;
  new_paid numeric;
  new_status text;
BEGIN
  IF NOT (public.is_tenant_owner(auth.uid(), _tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Idempotency
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO existing_id FROM public.billing_payments
     WHERE tenant_id = _tenant_id AND idempotency_key = _idempotency_key;
    IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  END IF;

  -- Validate allocations
  IF _allocations IS NOT NULL THEN
    FOR alloc IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
      alloc_sum := alloc_sum + (alloc->>'amount')::numeric;
    END LOOP;
    IF alloc_sum > _amount + 0.005 THEN
      RAISE EXCEPTION 'Allocations (%) exceed payment amount (%)', alloc_sum, _amount;
    END IF;
  END IF;

  INSERT INTO public.billing_payments
    (tenant_id, student_id, amount, method, reference_number,
     gateway, gateway_reference, idempotency_key, status,
     collected_by, collected_at, remarks, created_by)
  VALUES
    (_tenant_id, _student_id, _amount, _method, _reference_number,
     _gateway, _gateway_reference, _idempotency_key, _status,
     auth.uid(), _collected_at, _remarks, auth.uid())
  RETURNING id INTO new_payment_id;

  -- Only allocate if payment is succeeded
  IF _status = 'succeeded' AND _allocations IS NOT NULL THEN
    FOR alloc IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
      INSERT INTO public.billing_payment_allocations
        (tenant_id, payment_id, invoice_id, amount, created_by)
      VALUES
        (_tenant_id, new_payment_id, (alloc->>'invoice_id')::uuid,
         (alloc->>'amount')::numeric, auth.uid());

      SELECT * INTO inv FROM public.billing_invoices
        WHERE id = (alloc->>'invoice_id')::uuid AND tenant_id = _tenant_id
        FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not in tenant'; END IF;
      IF inv.status = 'void' THEN RAISE EXCEPTION 'Cannot allocate to void invoice'; END IF;

      new_paid := inv.amount_paid + (alloc->>'amount')::numeric;
      IF new_paid >= inv.total THEN new_status := 'paid';
      ELSIF new_paid > 0 THEN new_status := 'partially_paid';
      ELSE new_status := inv.status; END IF;

      UPDATE public.billing_invoices
         SET amount_paid = new_paid,
             balance = GREATEST(total - new_paid, 0),
             status = new_status
       WHERE id = inv.id;
    END LOOP;
  END IF;

  INSERT INTO public.billing_audit_log(tenant_id, entity_type, entity_id, action, actor_id, after_state)
  VALUES (_tenant_id, 'payment', new_payment_id, 'created', auth.uid(),
          jsonb_build_object('amount', _amount, 'method', _method, 'allocated', alloc_sum));

  RETURN new_payment_id;
END; $$;

-- ============================================================================
-- RPC: create_billing_adjustment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_billing_adjustment(
  _invoice_id uuid, _kind text, _amount numeric, _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices%ROWTYPE; adj_id uuid;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), inv.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF inv.status = 'draft' THEN RAISE EXCEPTION 'Adjust only issued invoices'; END IF;

  INSERT INTO public.billing_invoice_adjustments(tenant_id, invoice_id, kind, amount, reason, created_by)
  VALUES (inv.tenant_id, _invoice_id, _kind, _amount, _reason, auth.uid())
  RETURNING id INTO adj_id;

  -- Waivers/write-offs reduce effective balance
  IF _kind IN ('waiver','writeoff','credit_note') THEN
    UPDATE public.billing_invoices
       SET balance = GREATEST(balance - _amount, 0),
           status = CASE
             WHEN GREATEST(balance - _amount, 0) = 0 THEN 'paid'
             ELSE status
           END
     WHERE id = _invoice_id;
  END IF;

  INSERT INTO public.billing_audit_log(tenant_id, entity_type, entity_id, action, actor_id, metadata)
  VALUES (inv.tenant_id, 'invoice', _invoice_id, 'adjusted', auth.uid(),
          jsonb_build_object('kind', _kind, 'amount', _amount, 'reason', _reason));
  RETURN adj_id;
END; $$;
