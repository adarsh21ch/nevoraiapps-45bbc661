-- Hardening mc_match_squads RLS with correct roles
DROP POLICY IF EXISTS "Tenant members manage match squads" ON public.mc_match_squads;

CREATE POLICY "Staff manage match squads"
ON public.mc_match_squads
FOR ALL
TO authenticated
USING (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'coach'))
  AND is_tenant_member(auth.uid(), tenant_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'coach'))
  AND is_tenant_member(auth.uid(), tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_squads TO authenticated;
GRANT ALL ON public.mc_match_squads TO service_role;
