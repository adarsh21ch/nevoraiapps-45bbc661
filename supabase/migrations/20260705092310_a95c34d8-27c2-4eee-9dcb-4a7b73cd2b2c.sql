
-- 1) Tighten registrations public insert: validate tenant/batch/fee_plan consistency
DROP POLICY IF EXISTS "public insert registration" ON public.registrations;
CREATE POLICY "public insert registration" ON public.registrations
FOR INSERT TO anon
WITH CHECK (
  status = 'new'
  AND payment_status IN ('pending','verified')
  AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.status = 'active')
  AND (batch_id IS NULL OR EXISTS (
    SELECT 1 FROM public.batches b WHERE b.id = batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true
  ))
  AND (fee_plan_id IS NULL OR EXISTS (
    SELECT 1 FROM public.fee_plans f WHERE f.id = fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true
  ))
);

-- Also allow authenticated users to insert their own registrations under same constraints
DROP POLICY IF EXISTS "auth insert registration" ON public.registrations;
CREATE POLICY "auth insert registration" ON public.registrations
FOR INSERT TO authenticated
WITH CHECK (
  status = 'new'
  AND payment_status IN ('pending','verified')
  AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.status = 'active')
  AND (batch_id IS NULL OR EXISTS (
    SELECT 1 FROM public.batches b WHERE b.id = batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true
  ))
  AND (fee_plan_id IS NULL OR EXISTS (
    SELECT 1 FROM public.fee_plans f WHERE f.id = fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true
  ))
);

-- 2) Scope site_content public read to active tenants only (no draft/inactive-tenant leakage)
DROP POLICY IF EXISTS "public read site_content" ON public.site_content;
CREATE POLICY "public read site_content" ON public.site_content
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = site_content.tenant_id AND t.status = 'active'));

DROP POLICY IF EXISTS "auth read site_content" ON public.site_content;
CREATE POLICY "auth read site_content" ON public.site_content
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = site_content.tenant_id AND t.status = 'active'));

-- 3) Lock down SECURITY DEFINER function execution
-- approve_registration: only authenticated tenant staff (checks membership internally); revoke public/anon
REVOKE ALL ON FUNCTION public.approve_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_registration(uuid) TO authenticated;

-- Helper functions used by RLS policies: revoke from anon and PUBLIC; keep authenticated (required for RLS evaluation on authenticated queries)
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
