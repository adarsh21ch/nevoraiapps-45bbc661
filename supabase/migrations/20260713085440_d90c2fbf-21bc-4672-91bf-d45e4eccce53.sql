
-- ============================================================
-- Recognition Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_recognitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recognition_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  athlete_profile_id UUID REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.mc_teams(id) ON DELETE SET NULL,
  match_id UUID REFERENCES public.mc_matches(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES public.mc_tournaments(id) ON DELETE SET NULL,
  certificate_template UUID,
  badge TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'suggested',
  awarded_by UUID,
  awarded_at TIMESTAMPTZ,
  period TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_recognitions TO authenticated;
GRANT ALL ON public.mc_recognitions TO service_role;

ALTER TABLE public.mc_recognitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view recognitions"
  ON public.mc_recognitions FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can manage recognitions"
  ON public.mc_recognitions FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_recognitions_tenant ON public.mc_recognitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_status ON public.mc_recognitions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_athlete ON public.mc_recognitions(athlete_profile_id);
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_match ON public.mc_recognitions(match_id);
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_type_period ON public.mc_recognitions(tenant_id, recognition_type, period);

CREATE TRIGGER trg_mc_recognitions_updated
BEFORE UPDATE ON public.mc_recognitions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Certificate templates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'generic',
  background_image TEXT,
  logo TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  secondary_color TEXT NOT NULL DEFAULT '#f59e0b',
  signature_name TEXT,
  signature_image TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_certificate_templates TO authenticated;
GRANT ALL ON public.mc_certificate_templates TO service_role;

ALTER TABLE public.mc_certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view certificate templates"
  ON public.mc_certificate_templates FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can manage certificate templates"
  ON public.mc_certificate_templates FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_cert_templates_tenant ON public.mc_certificate_templates(tenant_id);

CREATE TRIGGER trg_mc_certificate_templates_updated
BEFORE UPDATE ON public.mc_certificate_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- Academy timeline
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_academy_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_academy_timeline TO authenticated;
GRANT ALL ON public.mc_academy_timeline TO service_role;

ALTER TABLE public.mc_academy_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view academy timeline"
  ON public.mc_academy_timeline FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members can manage academy timeline"
  ON public.mc_academy_timeline FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_academy_timeline_tenant ON public.mc_academy_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_academy_timeline_type ON public.mc_academy_timeline(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_mc_academy_timeline_created ON public.mc_academy_timeline(tenant_id, created_at DESC);
