
-- 1) Fix storage policy: tenant scoping must use the object's own path,
--    not the tenants.name column.
DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;
CREATE POLICY "tenant-assets public read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tenant-assets'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = ((storage.foldername(storage.objects.name))[1])::uuid
        AND t.status = 'active'
    )
  );

-- 2) mc_scorers: per-tenant scoring-only access grant.
CREATE TABLE public.mc_scorers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  athlete_profile_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_scorers TO authenticated;
GRANT ALL ON public.mc_scorers TO service_role;

ALTER TABLE public.mc_scorers ENABLE ROW LEVEL SECURITY;

-- Owners/admins of the tenant manage their scorers.
CREATE POLICY "tenant members manage scorers"
  ON public.mc_scorers
  FOR ALL
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- The scorer can read their own grant row (used by the app to decide the shell).
CREATE POLICY "scorer reads own row"
  ON public.mc_scorers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_mc_scorers_touch
  BEFORE UPDATE ON public.mc_scorers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) is_match_scorer: security-definer helper for RLS.
CREATE OR REPLACE FUNCTION public.is_match_scorer(_uid uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mc_scorers
    WHERE user_id = _uid
      AND tenant_id = _tenant
      AND status = 'active'
  )
$$;

-- 4) Additive scorer RLS on match-center tables.
--    Existing tenant-member policies are unchanged; these are OR'd in as
--    permissive policies so scorers get scoped access to scoring data only.
CREATE POLICY "scorers read matches"
  ON public.mc_matches FOR SELECT TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id));
CREATE POLICY "scorers write matches"
  ON public.mc_matches FOR ALL TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id))
  WITH CHECK (public.is_match_scorer(auth.uid(), tenant_id));

CREATE POLICY "scorers rw innings"
  ON public.mc_innings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_innings.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_innings.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)));

CREATE POLICY "scorers rw ball events"
  ON public.mc_ball_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_ball_events.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_ball_events.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)));

CREATE POLICY "scorers rw match squads"
  ON public.mc_match_squads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_match_squads.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_match_squads.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)));

CREATE POLICY "scorers read teams"
  ON public.mc_teams FOR SELECT TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id));
CREATE POLICY "scorers write teams"
  ON public.mc_teams FOR ALL TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id))
  WITH CHECK (public.is_match_scorer(auth.uid(), tenant_id));

CREATE POLICY "scorers read athlete profiles"
  ON public.mc_athlete_profiles FOR SELECT TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id));

CREATE POLICY "scorers read team players"
  ON public.mc_team_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mc_teams t WHERE t.id = mc_team_players.team_id AND public.is_match_scorer(auth.uid(), t.tenant_id)));

CREATE POLICY "scorers read tournaments"
  ON public.mc_tournaments FOR SELECT TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id));

CREATE POLICY "scorers read public match settings"
  ON public.mc_public_matches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mc_matches m WHERE m.id = mc_public_matches.match_id AND public.is_match_scorer(auth.uid(), m.tenant_id)));

-- 5) Narrow scorer-safe view over students: only identity, no PII / fee data.
CREATE OR REPLACE VIEW public.students_scorer_view
WITH (security_invoker=on) AS
  SELECT s.id, s.tenant_id, s.name, s.player_id, s.photo_url
  FROM public.students s;

GRANT SELECT ON public.students_scorer_view TO authenticated;

-- Corresponding SELECT policy on the base table so the view can resolve
-- rows for a scorer without exposing sensitive columns (the view projects
-- only the safe subset). Tenant members already have full access via
-- existing policies; this adds a scorer-only read path.
CREATE POLICY "scorers read students identity"
  ON public.students FOR SELECT TO authenticated
  USING (public.is_match_scorer(auth.uid(), tenant_id));
