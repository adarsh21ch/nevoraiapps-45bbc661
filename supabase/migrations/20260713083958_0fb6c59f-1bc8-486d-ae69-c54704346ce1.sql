
CREATE TABLE public.mc_tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  season TEXT,
  age_group TEXT,
  tournament_type TEXT NOT NULL DEFAULT 'league',
  format TEXT NOT NULL DEFAULT 'T20',
  overs INT NOT NULL DEFAULT 20,
  start_date DATE,
  end_date DATE,
  ground_name TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  visibility TEXT NOT NULL DEFAULT 'internal',
  max_teams INT NOT NULL DEFAULT 16,
  points_for_win NUMERIC(4,1) NOT NULL DEFAULT 2,
  points_for_tie NUMERIC(4,1) NOT NULL DEFAULT 1,
  points_for_loss NUMERIC(4,1) NOT NULL DEFAULT 0,
  points_for_no_result NUMERIC(4,1) NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mc_tournaments_tenant_idx ON public.mc_tournaments(tenant_id);
CREATE INDEX mc_tournaments_status_idx ON public.mc_tournaments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournaments TO authenticated;
GRANT ALL ON public.mc_tournaments TO service_role;

ALTER TABLE public.mc_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tournaments"
  ON public.mc_tournaments FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can insert tournaments"
  ON public.mc_tournaments FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can update tournaments"
  ON public.mc_tournaments FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can delete tournaments"
  ON public.mc_tournaments FOR DELETE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_tournaments_touch_updated_at
  BEFORE UPDATE ON public.mc_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

------------------------------------------------------------

CREATE TABLE public.mc_tournament_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.mc_tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.mc_teams(id) ON DELETE CASCADE,
  played INT NOT NULL DEFAULT 0,
  won INT NOT NULL DEFAULT 0,
  lost INT NOT NULL DEFAULT 0,
  tied INT NOT NULL DEFAULT 0,
  no_result INT NOT NULL DEFAULT 0,
  points NUMERIC(6,1) NOT NULL DEFAULT 0,
  net_run_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  runs_scored INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  overs_faced NUMERIC(8,2) NOT NULL DEFAULT 0,
  overs_bowled NUMERIC(8,2) NOT NULL DEFAULT 0,
  wickets_lost INT NOT NULL DEFAULT 0,
  wickets_taken INT NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  last_rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, team_id)
);

CREATE INDEX mc_tournament_teams_tournament_idx ON public.mc_tournament_teams(tournament_id);
CREATE INDEX mc_tournament_teams_team_idx ON public.mc_tournament_teams(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournament_teams TO authenticated;
GRANT ALL ON public.mc_tournament_teams TO service_role;

ALTER TABLE public.mc_tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view tournament teams"
  ON public.mc_tournament_teams FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can insert tournament teams"
  ON public.mc_tournament_teams FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can update tournament teams"
  ON public.mc_tournament_teams FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can delete tournament teams"
  ON public.mc_tournament_teams FOR DELETE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_tournament_teams_touch_updated_at
  BEFORE UPDATE ON public.mc_tournament_teams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
