
-- ============================================================
-- Academy Website Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mc_website_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'modern',
  is_published BOOLEAN NOT NULL DEFAULT true,
  homepage_widget TEXT NOT NULL DEFAULT 'live_match',
  hero JSONB NOT NULL DEFAULT '{}'::jsonb,
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured_player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured_tournament_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_website_config TO authenticated;
GRANT ALL ON public.mc_website_config TO service_role;

ALTER TABLE public.mc_website_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "website_config_read" ON public.mc_website_config
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "website_config_write" ON public.mc_website_config
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.mc_website_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mc_website_analytics TO authenticated;
GRANT ALL ON public.mc_website_analytics TO service_role;

ALTER TABLE public.mc_website_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "website_analytics_read" ON public.mc_website_analytics
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_mc_website_analytics_tenant
  ON public.mc_website_analytics(tenant_id, event_type, created_at DESC);

-- ============================================================
-- Public RPC: aggregate everything a public academy site shows
-- Only aggregates existing engine data. Never calculates cricket.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_academy_bundle(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_config public.mc_website_config%ROWTYPE;
  result JSONB;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants
    WHERE slug = _slug OR custom_domain = _slug
    LIMIT 1;

  IF v_tenant.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_config FROM public.mc_website_config WHERE tenant_id = v_tenant.id;

  result := jsonb_build_object(
    'academy', jsonb_build_object(
      'id', v_tenant.id,
      'slug', v_tenant.slug,
      'name', v_tenant.name,
      'custom_domain', v_tenant.custom_domain
    ),
    'config', COALESCE(to_jsonb(v_config), jsonb_build_object(
      'theme','modern','is_published',true,
      'widgets','[]'::jsonb,'hero','{}'::jsonb,'seo','{}'::jsonb
    )),
    'upcoming_matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'scheduled_date', m.scheduled_date,
        'team_a_id', m.team_a_id, 'team_b_id', m.team_b_id,
        'venue', m.venue, 'format', m.format
      ) ORDER BY m.scheduled_date ASC)
      FROM public.mc_matches m
      WHERE m.tenant_id = v_tenant.id
        AND m.status IN ('scheduled','live')
        AND (m.scheduled_date IS NULL OR m.scheduled_date >= now() - interval '1 day')
      LIMIT 10
    ), '[]'::jsonb),
    'recent_results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'scheduled_date', m.scheduled_date,
        'team_a_id', m.team_a_id, 'team_b_id', m.team_b_id,
        'result', m.result, 'winner_team', m.winner_team
      ) ORDER BY m.scheduled_date DESC)
      FROM public.mc_matches m
      WHERE m.tenant_id = v_tenant.id AND m.status = 'finalized'
      LIMIT 10
    ), '[]'::jsonb),
    'academy_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.record_type)
      FROM public.mc_academy_records r
      WHERE r.tenant_id = v_tenant.id
      LIMIT 50
    ), '[]'::jsonb),
    'hall_of_fame', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM public.mc_hall_of_fame h
      WHERE h.tenant_id = v_tenant.id
      LIMIT 20
    ), '[]'::jsonb),
    'recognitions', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM public.mc_recognitions r
      WHERE r.tenant_id = v_tenant.id
        AND r.status = 'published'
      LIMIT 20
    ), '[]'::jsonb)
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_academy_bundle(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_academy_bundle(TEXT) TO anon, authenticated;

-- ============================================================
-- Public RPC: track anonymous website analytics
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_website_event(
  _slug TEXT, _event_type TEXT, _event_key TEXT DEFAULT NULL, _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants
    WHERE slug = _slug OR custom_domain = _slug
    LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.mc_website_analytics(tenant_id, event_type, event_key, metadata)
  VALUES (v_tenant_id, _event_type, _event_key, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.track_website_event(TEXT, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.track_website_event(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.mc_website_config_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS mc_website_config_touch_trg ON public.mc_website_config;
CREATE TRIGGER mc_website_config_touch_trg
  BEFORE UPDATE ON public.mc_website_config
  FOR EACH ROW EXECUTE FUNCTION public.mc_website_config_touch();
