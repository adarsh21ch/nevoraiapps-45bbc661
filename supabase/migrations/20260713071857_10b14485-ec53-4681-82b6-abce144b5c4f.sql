
-- =========================================================
-- Match Center: Teams + Team Players
-- =========================================================

CREATE TABLE IF NOT EXISTS public.mc_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'cricket',
  name TEXT NOT NULL,
  short_name TEXT,
  age_group TEXT,
  age_group_custom TEXT,
  coach_name TEXT,
  assistant_coach_name TEXT,
  team_color TEXT,
  logo_url TEXT,
  season TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  captain_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  vice_captain_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  keeper_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_teams_tenant ON public.mc_teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_teams_tenant_status ON public.mc_teams(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_teams TO authenticated;
GRANT ALL ON public.mc_teams TO service_role;

ALTER TABLE public.mc_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their teams"
  ON public.mc_teams
  FOR ALL
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_teams_touch_updated_at
  BEFORE UPDATE ON public.mc_teams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


CREATE TABLE IF NOT EXISTS public.mc_team_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.mc_teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('batter','bowler','all_rounder','wicket_keeper')),
  batting_style TEXT CHECK (batting_style IN ('right_hand','left_hand')),
  bowling_style TEXT,
  jersey_number INT,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  is_vice_captain BOOLEAN NOT NULL DEFAULT false,
  is_keeper BOOLEAN NOT NULL DEFAULT false,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_team_players_tenant ON public.mc_team_players(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_team_players_team ON public.mc_team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_mc_team_players_student ON public.mc_team_players(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_team_players TO authenticated;
GRANT ALL ON public.mc_team_players TO service_role;

ALTER TABLE public.mc_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their team players"
  ON public.mc_team_players
  FOR ALL
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
