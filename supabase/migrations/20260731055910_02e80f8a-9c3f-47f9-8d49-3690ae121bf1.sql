CREATE OR REPLACE VIEW public.students_scoring_directory
WITH (security_invoker = off) AS
SELECT
  s.id,
  s.tenant_id,
  s.name,
  s.photo_url,
  s.player_id,
  s.dob,
  s.gender,
  s.batch_id,
  s.status,
  CASE
    WHEN public.is_tenant_member(auth.uid(), s.tenant_id)
      OR public.is_platform_admin(auth.uid())
    THEN s.phone
    ELSE NULL
  END AS phone
FROM public.students s
WHERE public.is_tenant_member(auth.uid(), s.tenant_id)
   OR public.is_platform_admin(auth.uid())
   OR public.is_match_scorer(auth.uid(), s.tenant_id);

GRANT SELECT ON public.students_scoring_directory TO authenticated;

DROP POLICY IF EXISTS "scorers read students identity" ON public.students;