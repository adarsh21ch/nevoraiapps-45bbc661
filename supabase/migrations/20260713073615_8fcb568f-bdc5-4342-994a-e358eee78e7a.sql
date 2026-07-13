
-- ------------------------------------------------------------
-- 1. Extend mc_teams with external-team support
-- ------------------------------------------------------------
ALTER TABLE public.mc_teams
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city text;

CREATE INDEX IF NOT EXISTS mc_teams_is_external_idx ON public.mc_teams(tenant_id, is_external);

-- ------------------------------------------------------------
-- 2. Custom match types (per academy)
-- ------------------------------------------------------------
CREATE TABLE public.mc_custom_match_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_custom_match_types TO authenticated;
GRANT ALL ON public.mc_custom_match_types TO service_role;
ALTER TABLE public.mc_custom_match_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage custom match types"
  ON public.mc_custom_match_types FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3. Matches
-- ------------------------------------------------------------
CREATE TABLE public.mc_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_a_id uuid NOT NULL REFERENCES public.mc_teams(id) ON DELETE RESTRICT,
  team_b_id uuid NOT NULL REFERENCES public.mc_teams(id) ON DELETE RESTRICT,
  ground_id uuid,
  tournament_id uuid,
  match_type text NOT NULL DEFAULT 'practice',
  match_format text NOT NULL DEFAULT 'T20',
  overs integer NOT NULL DEFAULT 20,
  scheduled_date date,
  scheduled_time time,
  status text NOT NULL DEFAULT 'scheduled',
  toss_winner uuid,
  toss_decision text,
  winner_team uuid,
  result text,
  ground_name text,
  pitch text,
  weather text,
  scorer text,
  umpire text,
  notes text,
  visibility text NOT NULL DEFAULT 'private',
  streaming_url text,
  ball_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_matches_teams_differ CHECK (team_a_id <> team_b_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_matches TO authenticated;
GRANT ALL ON public.mc_matches TO service_role;
ALTER TABLE public.mc_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage matches"
  ON public.mc_matches FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_matches_touch BEFORE UPDATE ON public.mc_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_matches_tenant_idx ON public.mc_matches(tenant_id);
CREATE INDEX mc_matches_team_a_idx ON public.mc_matches(team_a_id);
CREATE INDEX mc_matches_team_b_idx ON public.mc_matches(team_b_id);
CREATE INDEX mc_matches_status_idx ON public.mc_matches(tenant_id, status);
CREATE INDEX mc_matches_schedule_idx ON public.mc_matches(tenant_id, scheduled_date DESC);

-- ------------------------------------------------------------
-- 4. Match squads (Playing XI per team per match)
-- ------------------------------------------------------------
CREATE TABLE public.mc_match_squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.mc_teams(id) ON DELETE CASCADE,
  athlete_profile_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  external_player_name text,
  batting_order integer,
  is_playing boolean NOT NULL DEFAULT true,
  is_captain boolean NOT NULL DEFAULT false,
  is_vice_captain boolean NOT NULL DEFAULT false,
  is_keeper boolean NOT NULL DEFAULT false,
  is_substitute boolean NOT NULL DEFAULT false,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_match_squads_identity CHECK (
    athlete_profile_id IS NOT NULL OR (external_player_name IS NOT NULL AND btrim(external_player_name) <> '')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_squads TO authenticated;
GRANT ALL ON public.mc_match_squads TO service_role;
ALTER TABLE public.mc_match_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage match squads"
  ON public.mc_match_squads FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX mc_match_squads_match_idx ON public.mc_match_squads(match_id);
CREATE INDEX mc_match_squads_team_idx ON public.mc_match_squads(match_id, team_id);
CREATE INDEX mc_match_squads_athlete_idx ON public.mc_match_squads(athlete_profile_id);
