DROP POLICY IF EXISTS "auth read fee_plans" ON public.fee_plans;
CREATE POLICY "auth read fee_plans"
  ON public.fee_plans
  FOR SELECT
  TO authenticated
  USING (
    (active = true)
    OR (is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner'::text))
    OR is_platform_admin(auth.uid())
  );