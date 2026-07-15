
CREATE TABLE public.manual_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'upi' CHECK (method IN ('upi','qr','bank_transfer','cash','cheque','other')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  utr text,
  paid_at timestamptz,
  screenshot_path text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','duplicate','needs_reupload')),
  review_reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  billing_payment_id uuid REFERENCES public.billing_payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mps_tenant_status ON public.manual_payment_submissions (tenant_id, status, created_at DESC);
CREATE INDEX mps_student ON public.manual_payment_submissions (student_id, created_at DESC);
CREATE INDEX mps_invoice ON public.manual_payment_submissions (invoice_id) WHERE invoice_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.manual_payment_submissions TO authenticated;
GRANT ALL ON public.manual_payment_submissions TO service_role;
ALTER TABLE public.manual_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY mps_parent_insert ON public.manual_payment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_my_child(student_id)
    AND submitted_by = auth.uid()
  );

CREATE POLICY mps_parent_read ON public.manual_payment_submissions FOR SELECT TO authenticated
  USING (
    public.is_my_child(student_id)
    OR public.is_tenant_member(auth.uid(), tenant_id)
  );

CREATE POLICY mps_owner_update ON public.manual_payment_submissions FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

CREATE TRIGGER trg_mps_updated
  BEFORE UPDATE ON public.manual_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
