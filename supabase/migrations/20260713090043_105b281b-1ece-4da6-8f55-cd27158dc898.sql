
CREATE TABLE public.mc_ai_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL,
  report_type text NOT NULL,
  reference_type text NOT NULL,
  reference_id uuid,
  title text NOT NULL,
  summary text,
  key_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by text NOT NULL DEFAULT 'system',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mc_ai_reports_academy ON public.mc_ai_reports(academy_id);
CREATE INDEX idx_mc_ai_reports_ref ON public.mc_ai_reports(reference_type, reference_id);
CREATE INDEX idx_mc_ai_reports_type ON public.mc_ai_reports(academy_id, report_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_ai_reports TO authenticated;
GRANT ALL ON public.mc_ai_reports TO service_role;
ALTER TABLE public.mc_ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage AI reports" ON public.mc_ai_reports
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));

CREATE TABLE public.mc_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL UNIQUE,
  auto_generate_match_reports boolean NOT NULL DEFAULT true,
  auto_generate_player_reports boolean NOT NULL DEFAULT true,
  auto_generate_monthly_reports boolean NOT NULL DEFAULT true,
  auto_generate_tournament_reports boolean NOT NULL DEFAULT true,
  coach_review_required boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  tone text NOT NULL DEFAULT 'coach',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_ai_settings TO authenticated;
GRANT ALL ON public.mc_ai_settings TO service_role;
ALTER TABLE public.mc_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage AI settings" ON public.mc_ai_settings
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_mc_ai_reports_updated BEFORE UPDATE ON public.mc_ai_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mc_ai_settings_updated BEFORE UPDATE ON public.mc_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
