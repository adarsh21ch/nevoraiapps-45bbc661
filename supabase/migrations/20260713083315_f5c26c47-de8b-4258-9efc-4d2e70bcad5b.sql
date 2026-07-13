
CREATE TABLE public.mc_player_careers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  athlete_profile_id UUID NOT NULL REFERENCES public.mc_athlete_profiles(id) ON DELETE CASCADE,
  matches INT NOT NULL DEFAULT 0,
  innings INT NOT NULL DEFAULT 0,
  not_outs INT NOT NULL DEFAULT 0,
  runs INT NOT NULL DEFAULT 0,
  balls INT NOT NULL DEFAULT 0,
  highest_score INT NOT NULL DEFAULT 0,
  highest_score_not_out BOOLEAN NOT NULL DEFAULT false,
  average NUMERIC(8,2) NOT NULL DEFAULT 0,
  strike_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  fifties INT NOT NULL DEFAULT 0,
  hundreds INT NOT NULL DEFAULT 0,
  ducks INT NOT NULL DEFAULT 0,
  golden_ducks INT NOT NULL DEFAULT 0,
  silver_ducks INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  balls_bowled INT NOT NULL DEFAULT 0,
  overs NUMERIC(8,1) NOT NULL DEFAULT 0,
  maidens INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  best_bowling_wickets INT NOT NULL DEFAULT 0,
  best_bowling_runs INT NOT NULL DEFAULT 0,
  best_bowling TEXT NOT NULL DEFAULT '0/0',
  five_wicket_hauls INT NOT NULL DEFAULT 0,
  ten_wicket_hauls INT NOT NULL DEFAULT 0,
  economy NUMERIC(8,2) NOT NULL DEFAULT 0,
  bowling_average NUMERIC(8,2) NOT NULL DEFAULT 0,
  bowling_strike_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  catches INT NOT NULL DEFAULT 0,
  stumpings INT NOT NULL DEFAULT 0,
  run_outs INT NOT NULL DEFAULT 0,
  captain_matches INT NOT NULL DEFAULT 0,
  captain_wins INT NOT NULL DEFAULT 0,
  captain_losses INT NOT NULL DEFAULT 0,
  player_of_match INT NOT NULL DEFAULT 0,
  last_rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, athlete_profile_id)
);

CREATE INDEX mc_player_careers_tenant_idx ON public.mc_player_careers(tenant_id);
CREATE INDEX mc_player_careers_athlete_idx ON public.mc_player_careers(athlete_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_player_careers TO authenticated;
GRANT ALL ON public.mc_player_careers TO service_role;

ALTER TABLE public.mc_player_careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view careers"
  ON public.mc_player_careers FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can insert careers"
  ON public.mc_player_careers FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can update careers"
  ON public.mc_player_careers FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can delete careers"
  ON public.mc_player_careers FOR DELETE
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_player_careers_touch_updated_at
  BEFORE UPDATE ON public.mc_player_careers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
