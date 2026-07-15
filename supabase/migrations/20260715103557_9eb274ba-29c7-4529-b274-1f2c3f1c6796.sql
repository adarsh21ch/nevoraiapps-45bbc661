
ALTER TABLE public.mc_tournaments
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS has_groups boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_knockout boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS third_place_match boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualification_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tiebreak_rules text[] NOT NULL DEFAULT ARRAY['points','net_run_rate','wins','head_to_head']::text[],
  ADD COLUMN IF NOT EXISTS match_format_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sponsors jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS mc_tournaments_tenant_slug_uk
  ON public.mc_tournaments (tenant_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS mc_tournaments_published_idx
  ON public.mc_tournaments (tenant_id, published) WHERE published = true;

ALTER TABLE public.mc_tournament_teams
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS seed integer;

ALTER TABLE public.mc_matches
  ADD COLUMN IF NOT EXISTS venue_id uuid,
  ADD COLUMN IF NOT EXISTS round_id uuid,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS matchday_no integer;

CREATE INDEX IF NOT EXISTS mc_matches_tournament_round_idx
  ON public.mc_matches (tournament_id, round_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mc_matches_tournament_group_idx
  ON public.mc_matches (tournament_id, group_id) WHERE tournament_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mc_tournament_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.mc_tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  qualify_count integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_tournament_groups_tournament_idx
  ON public.mc_tournament_groups (tournament_id, display_order);

GRANT SELECT ON public.mc_tournament_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournament_groups TO authenticated;
GRANT ALL ON public.mc_tournament_groups TO service_role;

ALTER TABLE public.mc_tournament_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage tournament groups"
  ON public.mc_tournament_groups FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Public read groups of published tournaments"
  ON public.mc_tournament_groups FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mc_tournaments t
    WHERE t.id = mc_tournament_groups.tournament_id
      AND t.published = true AND t.visibility = 'public'
  ));

CREATE TABLE IF NOT EXISTS public.mc_tournament_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.mc_tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  capacity integer,
  pitch_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_tournament_venues_tournament_idx
  ON public.mc_tournament_venues (tournament_id);

GRANT SELECT ON public.mc_tournament_venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournament_venues TO authenticated;
GRANT ALL ON public.mc_tournament_venues TO service_role;

ALTER TABLE public.mc_tournament_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage tournament venues"
  ON public.mc_tournament_venues FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Public read venues of published tournaments"
  ON public.mc_tournament_venues FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mc_tournaments t
    WHERE t.id = mc_tournament_venues.tournament_id
      AND t.published = true AND t.visibility = 'public'
  ));

CREATE TABLE IF NOT EXISTS public.mc_tournament_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.mc_tournaments(id) ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  contact text,
  athlete_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_tournament_officials_tournament_idx
  ON public.mc_tournament_officials (tournament_id, role);

GRANT SELECT ON public.mc_tournament_officials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournament_officials TO authenticated;
GRANT ALL ON public.mc_tournament_officials TO service_role;

ALTER TABLE public.mc_tournament_officials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage tournament officials"
  ON public.mc_tournament_officials FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Public read officials of published tournaments"
  ON public.mc_tournament_officials FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mc_tournaments t
    WHERE t.id = mc_tournament_officials.tournament_id
      AND t.published = true AND t.visibility = 'public'
  ));

CREATE TABLE IF NOT EXISTS public.mc_tournament_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.mc_tournaments(id) ON DELETE CASCADE,
  stage text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  slot_index integer NOT NULL DEFAULT 0,
  name text,
  match_id uuid REFERENCES public.mc_matches(id) ON DELETE SET NULL,
  feeder_a_round_id uuid REFERENCES public.mc_tournament_rounds(id) ON DELETE SET NULL,
  feeder_b_round_id uuid REFERENCES public.mc_tournament_rounds(id) ON DELETE SET NULL,
  feeder_type text NOT NULL DEFAULT 'winner',
  advances_to_round_id uuid REFERENCES public.mc_tournament_rounds(id) ON DELETE SET NULL,
  team_a_id uuid,
  team_b_id uuid,
  is_placeholder boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mc_tournament_rounds_tournament_idx
  ON public.mc_tournament_rounds (tournament_id, stage_order, slot_index);

GRANT SELECT ON public.mc_tournament_rounds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_tournament_rounds TO authenticated;
GRANT ALL ON public.mc_tournament_rounds TO service_role;

ALTER TABLE public.mc_tournament_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage tournament rounds"
  ON public.mc_tournament_rounds FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

CREATE POLICY "Public read rounds of published tournaments"
  ON public.mc_tournament_rounds FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mc_tournaments t
    WHERE t.id = mc_tournament_rounds.tournament_id
      AND t.published = true AND t.visibility = 'public'
  ));

-- Public read policies for existing tables (scoped to published tournaments)
CREATE POLICY "Public read published tournaments"
  ON public.mc_tournaments FOR SELECT TO anon
  USING (published = true AND visibility = 'public');

CREATE POLICY "Public read tournament teams of published tournaments"
  ON public.mc_tournament_teams FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.mc_tournaments t
    WHERE t.id = mc_tournament_teams.tournament_id
      AND t.published = true AND t.visibility = 'public'
  ));

-- updated_at triggers (use project's touch_updated_at)
DO $$ BEGIN
  CREATE TRIGGER trg_mc_tournament_groups_updated_at
    BEFORE UPDATE ON public.mc_tournament_groups
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mc_tournament_venues_updated_at
    BEFORE UPDATE ON public.mc_tournament_venues
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mc_tournament_officials_updated_at
    BEFORE UPDATE ON public.mc_tournament_officials
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mc_tournament_rounds_updated_at
    BEFORE UPDATE ON public.mc_tournament_rounds
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
