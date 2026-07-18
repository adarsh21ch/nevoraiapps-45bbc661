
-- Phase 24: public live match center — narrow anon SELECT policies.
-- Additive; existing tournament-published policies and all staff policies remain untouched.

-- 1. mc_matches: allow anon to read matches the owner has explicitly marked public,
--    only while the tenant is active. Existing "Public read matches of published tournaments"
--    policy remains and continues to gate tournament pages.
CREATE POLICY "Public read public matches"
ON public.mc_matches FOR SELECT TO anon
USING (
  visibility = 'public'
  AND public.is_active_tenant(tenant_id)
);

-- 2. mc_ball_events: anon may read ball events belonging to a public match.
CREATE POLICY "Public read ball events of public matches"
ON public.mc_ball_events FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.mc_matches m
    WHERE m.id = mc_ball_events.match_id
      AND m.visibility = 'public'
      AND public.is_active_tenant(m.tenant_id)
  )
);

-- 3. mc_innings: anon may read innings totals for a public match.
CREATE POLICY "Public read innings of public matches"
ON public.mc_innings FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.mc_matches m
    WHERE m.id = mc_innings.match_id
      AND m.visibility = 'public'
      AND public.is_active_tenant(m.tenant_id)
  )
);

-- 4. mc_match_squads: anon may read squad rows (position, role, denormalized name) for a public match.
--    Note: mc_match_squads carries a denormalized player display name; PII on
--    mc_athlete_profiles (medical/emergency/dob) stays inaccessible to anon.
CREATE POLICY "Public read squads of public matches"
ON public.mc_match_squads FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.mc_matches m
    WHERE m.id = mc_match_squads.match_id
      AND m.visibility = 'public'
      AND public.is_active_tenant(m.tenant_id)
  )
);

-- 5. mc_teams: anon may read a team row only when it's referenced by a public match
--    in an active tenant.
CREATE POLICY "Public read teams of public matches"
ON public.mc_teams FOR SELECT TO anon
USING (
  public.is_active_tenant(tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.mc_matches m
    WHERE (m.team_a_id = mc_teams.id OR m.team_b_id = mc_teams.id)
      AND m.visibility = 'public'
      AND m.tenant_id = mc_teams.tenant_id
  )
);

-- 6. Data API grants for anon on these tables (idempotent — no-op if already granted).
GRANT SELECT ON public.mc_matches TO anon;
GRANT SELECT ON public.mc_ball_events TO anon;
GRANT SELECT ON public.mc_innings TO anon;
GRANT SELECT ON public.mc_match_squads TO anon;
GRANT SELECT ON public.mc_teams TO anon;

-- 7. Ensure is_active_tenant is executable by anon (already true per audit, but idempotent).
GRANT EXECUTE ON FUNCTION public.is_active_tenant(uuid) TO anon;

-- 8. Realtime: ensure these tables are in the realtime publication so the shared
--    useMatchLive hook's postgres_changes subscription delivers to anon clients.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_matches;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_ball_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_innings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
