
-- ============================================================
-- Hot-path composite indexes (safe: IF NOT EXISTS)
-- ============================================================

-- Match Center core reads
CREATE INDEX IF NOT EXISTS idx_mc_matches_tenant_status_date
  ON public.mc_matches (tenant_id, status, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_mc_matches_team_a ON public.mc_matches (team_a_id);
CREATE INDEX IF NOT EXISTS idx_mc_matches_team_b ON public.mc_matches (team_b_id);

-- Ball events — realtime + scorecard aggregation
CREATE INDEX IF NOT EXISTS idx_mc_ball_events_match_created
  ON public.mc_ball_events (match_id, created_at);

-- Innings
CREATE INDEX IF NOT EXISTS idx_mc_innings_match_number
  ON public.mc_innings (match_id, innings_number);

-- Squads (used by career + parent portal joins)
CREATE INDEX IF NOT EXISTS idx_mc_match_squads_match
  ON public.mc_match_squads (match_id);
CREATE INDEX IF NOT EXISTS idx_mc_match_squads_athlete
  ON public.mc_match_squads (athlete_profile_id);

-- Recognition Engine
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_tenant_status_created
  ON public.mc_recognitions (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_recognitions_athlete
  ON public.mc_recognitions (athlete_profile_id);

-- Academy Timeline
CREATE INDEX IF NOT EXISTS idx_mc_academy_timeline_tenant_date
  ON public.mc_academy_timeline (tenant_id, created_at DESC);

-- Career Engine
CREATE INDEX IF NOT EXISTS idx_mc_player_careers_tenant
  ON public.mc_player_careers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mc_athlete_profiles_student
  ON public.mc_athlete_profiles (student_id);

-- Website Engine analytics rollups
CREATE INDEX IF NOT EXISTS idx_mc_website_analytics_type_created
  ON public.mc_website_analytics (tenant_id, event_type, created_at DESC);

-- Tournament tables lookups
CREATE INDEX IF NOT EXISTS idx_mc_tournament_teams_tournament
  ON public.mc_tournament_teams (tournament_id);

-- ============================================================
-- Planner: mark the public academy bundle as STABLE
-- (all reads, no writes; same input → same output within a txn)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_academy_bundle(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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
      'id', v_tenant.id, 'slug', v_tenant.slug,
      'name', v_tenant.name, 'custom_domain', v_tenant.custom_domain
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
      FROM public.mc_academy_records r WHERE r.tenant_id = v_tenant.id LIMIT 50
    ), '[]'::jsonb),
    'hall_of_fame', COALESCE((
      SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM public.mc_hall_of_fame h WHERE h.tenant_id = v_tenant.id LIMIT 20
    ), '[]'::jsonb),
    'recognitions', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM public.mc_recognitions r
      WHERE r.tenant_id = v_tenant.id AND r.status = 'published' LIMIT 20
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$$;

-- ============================================================
-- Realtime publication for live widgets
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_ball_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_innings;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_matches;      EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
