
-- ============================================================
-- Ball Event Engine — mc_innings + mc_ball_events
-- ============================================================

-- ------------------------------------------------------------
-- 1. Innings
-- ------------------------------------------------------------
CREATE TABLE public.mc_innings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  innings_number smallint NOT NULL CHECK (innings_number BETWEEN 1 AND 4),
  batting_team_id uuid NOT NULL REFERENCES public.mc_teams(id) ON DELETE RESTRICT,
  bowling_team_id uuid NOT NULL REFERENCES public.mc_teams(id) ON DELETE RESTRICT,
  target integer,
  runs integer NOT NULL DEFAULT 0,
  wickets smallint NOT NULL DEFAULT 0,
  overs smallint NOT NULL DEFAULT 0,
  balls smallint NOT NULL DEFAULT 0,
  extras integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('scheduled','in_progress','completed','abandoned')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, innings_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_innings TO authenticated;
GRANT ALL ON public.mc_innings TO service_role;
ALTER TABLE public.mc_innings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage innings"
  ON public.mc_innings FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_innings_touch BEFORE UPDATE ON public.mc_innings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_innings_match_idx ON public.mc_innings(match_id, innings_number);
CREATE INDEX mc_innings_tenant_idx ON public.mc_innings(tenant_id);

-- ------------------------------------------------------------
-- 2. Ball Events (immutable append-only log)
-- ------------------------------------------------------------
CREATE TABLE public.mc_ball_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  innings_id uuid NOT NULL REFERENCES public.mc_innings(id) ON DELETE CASCADE,

  -- Position within the innings
  over_number smallint NOT NULL CHECK (over_number >= 0),
  ball_number smallint NOT NULL CHECK (ball_number >= 1),
  sequence_number integer NOT NULL, -- monotonic per innings for undo/ordering
  is_legal_delivery boolean NOT NULL DEFAULT true,

  -- Participants (athlete_profile ids; nullable for external players)
  bowler_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  striker_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  non_striker_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  bowler_name text,
  striker_name text,
  non_striker_name text,

  -- Runs & extras
  runs_off_bat smallint NOT NULL DEFAULT 0 CHECK (runs_off_bat >= 0),
  extra_type text CHECK (extra_type IN ('wide','no_ball','bye','leg_bye','penalty')),
  extra_runs smallint NOT NULL DEFAULT 0 CHECK (extra_runs >= 0),

  -- Dismissal
  dismissal_type text CHECK (dismissal_type IN (
    'bowled','caught','lbw','run_out','stumped',
    'hit_wicket','retired_hurt','retired_out','timed_out',
    'obstructing_field','handled_ball','hit_ball_twice'
  )),
  dismissed_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  dismissed_name text,
  fielder_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  fielder_name text,

  comment text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (innings_id, sequence_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_ball_events TO authenticated;
GRANT ALL ON public.mc_ball_events TO service_role;
ALTER TABLE public.mc_ball_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage ball events"
  ON public.mc_ball_events FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX mc_ball_events_innings_idx
  ON public.mc_ball_events(innings_id, sequence_number);
CREATE INDEX mc_ball_events_match_idx
  ON public.mc_ball_events(match_id, created_at DESC);
CREATE INDEX mc_ball_events_tenant_idx ON public.mc_ball_events(tenant_id);
CREATE INDEX mc_ball_events_striker_idx
  ON public.mc_ball_events(striker_athlete_id) WHERE striker_athlete_id IS NOT NULL;
CREATE INDEX mc_ball_events_bowler_idx
  ON public.mc_ball_events(bowler_athlete_id) WHERE bowler_athlete_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Realtime
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_innings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_ball_events;
