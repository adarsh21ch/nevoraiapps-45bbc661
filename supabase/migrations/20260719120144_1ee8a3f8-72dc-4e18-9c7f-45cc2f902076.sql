
-- 1. Public view: squad players for publicly visible matches (safe columns only)
CREATE OR REPLACE VIEW public.mc_public_squad_players
WITH (security_invoker = off) AS
SELECT
  s.match_id,
  s.team_id,
  s.id AS squad_row_id,
  s.athlete_profile_id,
  s.external_player_name,
  COALESCE(st.name, s.external_player_name) AS display_name,
  st.photo_url,
  s.role,
  s.batting_order,
  s.is_playing,
  s.is_captain,
  s.is_vice_captain,
  s.is_keeper,
  s.is_substitute
FROM public.mc_match_squads s
LEFT JOIN public.mc_athlete_profiles ap ON ap.id = s.athlete_profile_id
LEFT JOIN public.students st ON st.id = ap.student_id
WHERE EXISTS (
  SELECT 1 FROM public.mc_matches m
  WHERE m.id = s.match_id
    AND (
      (m.visibility = 'public' AND public.is_active_tenant(m.tenant_id))
      OR EXISTS (
        SELECT 1 FROM public.mc_tournaments t
        WHERE t.id = m.tournament_id
          AND t.published = true
          AND t.visibility = 'public'
      )
    )
);

GRANT SELECT ON public.mc_public_squad_players TO anon, authenticated;

COMMENT ON VIEW public.mc_public_squad_players IS
  'Public projection of match squads. Exposes only display_name, photo_url, role, batting_order and flags — never DOB / medical / guardian / contact / address / email.';

-- 2. Extend tenant-assets anon-read allowlist to include a "players" prefix
DROP POLICY IF EXISTS "tenant-assets anon read public sections" ON storage.objects;

CREATE POLICY "tenant-assets anon read public sections"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] = ANY (ARRAY[
    'public','gallery','hero','logo_url','founder','cta','star_players','upi_qr_url','players'
  ])
  AND public.is_active_tenant(((storage.foldername(name))[1])::uuid)
);
