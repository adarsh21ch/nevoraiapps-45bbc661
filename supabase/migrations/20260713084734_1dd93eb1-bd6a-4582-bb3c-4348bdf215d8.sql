
-- ============================================================
-- Academy Records Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_academy_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_key TEXT NOT NULL,
  athlete_profile_id UUID REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.mc_teams(id) ON DELETE SET NULL,
  match_id UUID REFERENCES public.mc_matches(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES public.mc_tournaments(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, record_type, record_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_academy_records TO authenticated;
GRANT ALL ON public.mc_academy_records TO service_role;

ALTER TABLE public.mc_academy_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view academy records"
  ON public.mc_academy_records FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can manage academy records"
  ON public.mc_academy_records FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_academy_records_tenant ON public.mc_academy_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_academy_records_type ON public.mc_academy_records(tenant_id, record_type);
CREATE INDEX IF NOT EXISTS idx_mc_academy_records_athlete ON public.mc_academy_records(athlete_profile_id);

CREATE TRIGGER trg_mc_academy_records_updated
BEFORE UPDATE ON public.mc_academy_records
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Hall of Fame
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_hall_of_fame (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  athlete_profile_id UUID REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  achievement_title TEXT NOT NULL,
  achievement_description TEXT,
  image_url TEXT,
  awarded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_hall_of_fame TO authenticated;
GRANT ALL ON public.mc_hall_of_fame TO service_role;

ALTER TABLE public.mc_hall_of_fame ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view hall of fame"
  ON public.mc_hall_of_fame FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can manage hall of fame"
  ON public.mc_hall_of_fame FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_hall_of_fame_tenant ON public.mc_hall_of_fame(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_hall_of_fame_category ON public.mc_hall_of_fame(tenant_id, category);

CREATE TRIGGER trg_mc_hall_of_fame_updated
BEFORE UPDATE ON public.mc_hall_of_fame
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
