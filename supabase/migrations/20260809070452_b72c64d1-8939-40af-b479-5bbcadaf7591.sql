BEGIN;

-- 1. Drop both the original and current management policies to ensure convergence
DROP POLICY IF EXISTS "Tenant members manage match squads" ON public.mc_match_squads;
DROP POLICY IF EXISTS "Staff manage match squads" ON public.mc_match_squads;

-- 2. Drop the insecure 2-argument overload of has_role if it exists
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 3. Create the secure, tenant-scoped management policy
CREATE POLICY "Staff manage match squads" ON public.mc_match_squads 
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), tenant_id, 'owner'::app_role)
   OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
   OR has_role(auth.uid(), tenant_id, 'staff'::app_role)
   OR has_role(auth.uid(), tenant_id, 'coach'::app_role))
  AND is_tenant_member(auth.uid(), tenant_id)
)
WITH CHECK (
  (has_role(auth.uid(), tenant_id, 'owner'::app_role)
   OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
   OR has_role(auth.uid(), tenant_id, 'staff'::app_role)
   OR has_role(auth.uid(), tenant_id, 'coach'::app_role))
  AND is_tenant_member(auth.uid(), tenant_id)
);

-- 4. Re-assert standard grants for the table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_squads TO authenticated;
GRANT ALL ON public.mc_match_squads TO service_role;

COMMIT;