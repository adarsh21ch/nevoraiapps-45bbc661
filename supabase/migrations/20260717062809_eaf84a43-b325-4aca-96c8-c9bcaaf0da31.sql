DROP POLICY IF EXISTS "owner manages fee_plans" ON public.fee_plans;
CREATE POLICY "owner manages fee_plans"
  ON public.fee_plans
  FOR ALL
  TO authenticated
  USING (
    (is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner'::text))
    OR is_platform_admin(auth.uid())
  )
  WITH CHECK (
    (is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner'::text))
    OR is_platform_admin(auth.uid())
  );