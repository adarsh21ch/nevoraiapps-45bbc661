-- Task 2: Fix reversed is_tenant_member arguments in payment_transactions policy
DROP POLICY IF EXISTS "tenant members read own payment transactions" ON public.payment_transactions;

CREATE POLICY "tenant members read own payment transactions" ON public.payment_transactions 
FOR SELECT TO authenticated
USING (
  (scope='tenant' AND tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  OR (scope='platform' AND public.is_platform_admin(auth.uid()))
);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;