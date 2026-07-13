
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
        'badge', r.badge, 'image_url', r.image_url
      ) ORDER BY r.awarded_at DESC NULLS LAST)
      FROM public.mc_recognitions r
      WHERE r.athlete_profile_id = ap_id AND r.status = 'published'
    ), '[]'::jsonb),
    'achievements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'title', a.title,
        'description', a.description, 'event_date', a.event_date
      ) ORDER BY a.event_date DESC NULLS LAST)
      FROM public.mc_athlete_achievements a
      WHERE a.athlete_profile_id = ap_id
    ), '[]'::jsonb),
    'timeline', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'description', t.description,
        'event_date', t.event_date, 'image_url', t.image_url
      ) ORDER BY t.event_date DESC NULLS LAST)
      FROM public.mc_athlete_timeline t
      WHERE t.athlete_profile_id = ap_id
    ), '[]'::jsonb),
    'recent_matches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'match_id', mm.id, 'scheduled_date', mm.scheduled_date,
        'team_a_id', mm.team_a_id, 'team_b_id', mm.team_b_id,
        'winner_team', mm.winner_team, 'result', mm.result,
        'match_locked', mm.match_locked
      ) ORDER BY mm.scheduled_date DESC NULLS LAST)
      FROM public.mc_matches mm
      WHERE mm.id IN (
        SELECT DISTINCT sq.match_id FROM public.mc_match_squads sq WHERE sq.athlete_profile_id = ap_id
      )
    ), '[]'::jsonb)
  );
  RETURN result;
END;
$$;
