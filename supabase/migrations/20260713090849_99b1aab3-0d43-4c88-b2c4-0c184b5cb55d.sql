
-- ============ mc_parent_links ============
CREATE TABLE public.mc_parent_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL,
  parent_user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  relationship text NOT NULL DEFAULT 'guardian',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, student_id)
);
CREATE INDEX idx_mc_parent_links_parent ON public.mc_parent_links(parent_user_id);
CREATE INDEX idx_mc_parent_links_student ON public.mc_parent_links(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_parent_links TO authenticated;
GRANT ALL ON public.mc_parent_links TO service_role;
ALTER TABLE public.mc_parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents see own links" ON public.mc_parent_links
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Staff manage parent links" ON public.mc_parent_links
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_mc_parent_links_updated BEFORE UPDATE ON public.mc_parent_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ mc_public_matches ============
CREATE TABLE public.mc_public_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL UNIQUE,
  academy_id uuid NOT NULL,
  public_slug text NOT NULL UNIQUE,
  is_public boolean NOT NULL DEFAULT true,
  allow_live_score boolean NOT NULL DEFAULT true,
  allow_scorecard boolean NOT NULL DEFAULT true,
  allow_player_profiles boolean NOT NULL DEFAULT false,
  allow_match_summary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mc_public_matches_slug ON public.mc_public_matches(public_slug) WHERE is_public;
CREATE INDEX idx_mc_public_matches_match ON public.mc_public_matches(match_id);
GRANT SELECT ON public.mc_public_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_public_matches TO authenticated;
GRANT ALL ON public.mc_public_matches TO service_role;
ALTER TABLE public.mc_public_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads visible matches" ON public.mc_public_matches
  FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "Auth reads own or public matches" ON public.mc_public_matches
  FOR SELECT TO authenticated
  USING (is_public = true OR public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "Staff manage public matches" ON public.mc_public_matches
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_mc_public_matches_updated BEFORE UPDATE ON public.mc_public_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ mc_public_settings ============
CREATE TABLE public.mc_public_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id uuid NOT NULL UNIQUE,
  default_match_visibility text NOT NULL DEFAULT 'private',
  default_player_visibility text NOT NULL DEFAULT 'private',
  allow_public_links boolean NOT NULL DEFAULT true,
  allow_live_scores boolean NOT NULL DEFAULT true,
  allow_ai_summary boolean NOT NULL DEFAULT false,
  allow_download_scorecard boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mc_public_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_public_settings TO authenticated;
GRANT ALL ON public.mc_public_settings TO service_role;
ALTER TABLE public.mc_public_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads settings" ON public.mc_public_settings
  FOR SELECT TO anon USING (true);
CREATE POLICY "Auth reads settings" ON public.mc_public_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage settings" ON public.mc_public_settings
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), academy_id) OR public.is_platform_admin(auth.uid()));
CREATE TRIGGER trg_mc_public_settings_updated BEFORE UPDATE ON public.mc_public_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Public match bundle RPC ============
CREATE OR REPLACE FUNCTION public.get_public_match_bundle(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pm public.mc_public_matches%ROWTYPE;
  m public.mc_matches%ROWTYPE;
  result jsonb;
BEGIN
  SELECT * INTO pm FROM public.mc_public_matches WHERE public_slug = _slug AND is_public = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO m FROM public.mc_matches WHERE id = pm.match_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  result := jsonb_build_object(
    'public', to_jsonb(pm),
    'match', jsonb_build_object(
      'id', m.id,
      'match_type', m.match_type,
      'match_format', m.match_format,
      'overs', m.overs,
      'scheduled_date', m.scheduled_date,
      'scheduled_time', m.scheduled_time,
      'status', m.status,
      'ground_name', m.ground_name,
      'winner_team', m.winner_team,
      'result', m.result,
      'winning_margin', m.winning_margin,
      'winning_margin_type', m.winning_margin_type,
      'victory_type', m.victory_type,
      'player_of_match_athlete_id', m.player_of_match_athlete_id,
      'match_locked', m.match_locked,
      'team_a_id', m.team_a_id,
      'team_b_id', m.team_b_id,
      'toss_winner', m.toss_winner,
      'toss_decision', m.toss_decision
    ),
    'teams', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'short_name', t.short_name, 'logo_url', t.logo_url))
      FROM public.mc_teams t WHERE t.id IN (m.team_a_id, m.team_b_id)
    ), '[]'::jsonb),
    'innings', CASE WHEN pm.allow_scorecard OR pm.allow_live_score THEN
      COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.innings_number) FROM public.mc_innings i WHERE i.match_id = m.id), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'ball_events', CASE WHEN pm.allow_live_score OR pm.allow_scorecard THEN
      COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at) FROM public.mc_ball_events b WHERE b.match_id = m.id), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'squads', CASE WHEN pm.allow_player_profiles OR pm.allow_scorecard THEN
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'athlete_profile_id', s.athlete_profile_id,
          'team_id', s.team_id,
          'is_captain', s.is_captain,
          'is_wicketkeeper', s.is_wicketkeeper,
          'batting_order', s.batting_order,
          'name', st.name
        ))
        FROM public.mc_match_squads s
        LEFT JOIN public.mc_athlete_profiles ap ON ap.id = s.athlete_profile_id
        LEFT JOIN public.students st ON st.id = ap.student_id
        WHERE s.match_id = m.id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'pom_name', (
      SELECT st.name FROM public.mc_athlete_profiles ap
      LEFT JOIN public.students st ON st.id = ap.student_id
      WHERE ap.id = m.player_of_match_athlete_id
    )
  );
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_match_bundle(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_match_bundle(text) TO anon, authenticated;

-- ============ Parent child summary RPC ============
CREATE OR REPLACE FUNCTION public.get_parent_child_summary(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_ok boolean;
  ap_id uuid;
  result jsonb;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.mc_parent_links
    WHERE parent_user_id = auth.uid() AND student_id = _student_id
  ) INTO link_ok;
  IF NOT link_ok AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO ap_id FROM public.mc_athlete_profiles WHERE student_id = _student_id LIMIT 1;

  result := jsonb_build_object(
    'student', (SELECT jsonb_build_object(
        'id', s.id, 'name', s.name, 'player_id', s.player_id,
        'dob', s.dob, 'gender', s.gender, 'photo_url', s.photo_url,
        'batch_id', s.batch_id, 'tenant_id', s.tenant_id
      ) FROM public.students s WHERE s.id = _student_id),
    'athlete_profile_id', ap_id,
    'cricket_profile', (SELECT to_jsonb(cp) FROM public.mc_cricket_profiles cp WHERE cp.athlete_profile_id = ap_id LIMIT 1),
    'career', (SELECT to_jsonb(c) FROM public.mc_player_careers c WHERE c.athlete_profile_id = ap_id LIMIT 1),
    'recognitions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'recognition_type', r.recognition_type, 'title', r.title,
        'description', r.description, 'awarded_at', r.awarded_at, 'status', r.status,
        'badge_url', r.badge_url, 'certificate_url', r.certificate_url
      ) ORDER BY r.awarded_at DESC)
      FROM public.mc_recognitions r
      WHERE r.athlete_profile_id = ap_id AND r.status = 'published'
    ), '[]'::jsonb),
    'achievements', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.achieved_at DESC)
      FROM public.mc_athlete_achievements a
      WHERE a.athlete_profile_id = ap_id
    ), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'event_type', t.event_type, 'title', t.title,
        'description', t.description, 'occurred_at', t.occurred_at
      ) ORDER BY t.occurred_at DESC)
      FROM public.mc_athlete_timeline t
      WHERE t.athlete_profile_id = ap_id
      LIMIT 50
    ), '[]'::jsonb),
    'recent_matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'match_id', mm.id, 'scheduled_date', mm.scheduled_date,
        'team_a_id', mm.team_a_id, 'team_b_id', mm.team_b_id,
        'winner_team', mm.winner_team, 'result', mm.result,
        'match_locked', mm.match_locked
      ) ORDER BY mm.scheduled_date DESC)
      FROM public.mc_matches mm
      WHERE mm.id IN (
        SELECT DISTINCT sq.match_id FROM public.mc_match_squads sq WHERE sq.athlete_profile_id = ap_id
      )
      LIMIT 20
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_parent_child_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_parent_child_summary(uuid) TO authenticated;

-- ============ List parent's children ============
CREATE OR REPLACE FUNCTION public.list_parent_children()
RETURNS TABLE(
  link_id uuid, student_id uuid, student_name text, player_id text,
  relationship text, is_primary boolean, academy_id uuid, photo_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.student_id, s.name, s.player_id, l.relationship, l.is_primary, l.academy_id, s.photo_url
  FROM public.mc_parent_links l
  JOIN public.students s ON s.id = l.student_id
  WHERE l.parent_user_id = auth.uid()
  ORDER BY l.is_primary DESC, s.name ASC;
$$;
REVOKE ALL ON FUNCTION public.list_parent_children() FROM public;
GRANT EXECUTE ON FUNCTION public.list_parent_children() TO authenticated;
