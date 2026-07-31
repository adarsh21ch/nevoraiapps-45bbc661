DROP POLICY IF EXISTS "public insert registration" ON public.registrations;
DROP POLICY IF EXISTS "auth insert registration" ON public.registrations;

CREATE POLICY "public insert registration"
ON public.registrations FOR INSERT TO anon
WITH CHECK (
  status = 'new'
  AND payment_status = 'pending'
  AND review_status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND student_id IS NULL
  AND applicant_user_id IS NULL
  AND is_active_tenant(tenant_id)
  AND (batch_id IS NULL OR EXISTS (
    SELECT 1 FROM batches b WHERE b.id = registrations.batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true))
  AND (fee_plan_id IS NULL OR EXISTS (
    SELECT 1 FROM fee_plans f WHERE f.id = registrations.fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true))
);

CREATE POLICY "auth insert registration"
ON public.registrations FOR INSERT TO authenticated
WITH CHECK (
  status = 'new'
  AND payment_status = 'pending'
  AND review_status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND student_id IS NULL
  AND (applicant_user_id IS NULL OR applicant_user_id = auth.uid())
  AND is_active_tenant(tenant_id)
  AND (batch_id IS NULL OR EXISTS (
    SELECT 1 FROM batches b WHERE b.id = registrations.batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true))
  AND (fee_plan_id IS NULL OR EXISTS (
    SELECT 1 FROM fee_plans f WHERE f.id = registrations.fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true))
);