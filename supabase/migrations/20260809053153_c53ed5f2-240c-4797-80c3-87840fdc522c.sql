-- Forward-only migration to fix mc_match_squads RLS and drop 2-arg has_role
BEGIN;

-- 1. Drop the problematic RLS policy first (so function can be dropped)
DROP POLICY IF EXISTS "Staff manage match squads" ON public.mc_match_squads;

-- 2. Drop the incorrect 2-arg overload of has_role
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- 3. Create the corrected tenant-scoped policy using the canonical 3-arg signature
CREATE POLICY "Staff manage match squads"
ON public.mc_match_squads
FOR ALL
TO authenticated
USING (
  (
    public.has_role(auth.uid(), tenant_id, 'owner') OR 
    public.has_role(auth.uid(), tenant_id, 'admin') OR 
    public.has_role(auth.uid(), tenant_id, 'staff') OR 
    public.has_role(auth.uid(), tenant_id, 'coach')
  ) 
  AND public.is_tenant_member(auth.uid(), tenant_id)
)
WITH CHECK (
  (
    public.has_role(auth.uid(), tenant_id, 'owner') OR 
    public.has_role(auth.uid(), tenant_id, 'admin') OR 
    public.has_role(auth.uid(), tenant_id, 'staff') OR 
    public.has_role(auth.uid(), tenant_id, 'coach')
  ) 
  AND public.is_tenant_member(auth.uid(), tenant_id)
);

-- 4. Re-apply necessary grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_squads TO authenticated;
GRANT ALL ON public.mc_match_squads TO service_role;

COMMIT;
