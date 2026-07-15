
-- Helper: assert tenant access
CREATE OR REPLACE FUNCTION public._agg_assert_tenant(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id required'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), _tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized for tenant';
  END IF;
END;
$$;

-- =============================================================
-- 1. Dashboard summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  month_start date := date_trunc('month', today)::date;
  week_ago timestamptz := now() - interval '7 days';
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  SELECT jsonb_build_object(
    'total_students', (SELECT count(*) FROM students WHERE tenant_id = _tenant_id AND archived_at IS NULL),
    'active_students', (SELECT count(*) FROM students WHERE tenant_id = _tenant_id AND status = 'active' AND archived_at IS NULL),
    'archived_students', (SELECT count(*) FROM students WHERE tenant_id = _tenant_id AND archived_at IS NOT NULL),
    'present_today', (
      SELECT count(DISTINCT am.student_id) FROM attendance_marks am
      JOIN attendance_sessions s ON s.id = am.session_id
      WHERE am.tenant_id = _tenant_id AND s.session_date = today
        AND am.superseded_by IS NULL AND am.status IN ('present','late')
    ),
    'absent_today', (
      SELECT count(DISTINCT am.student_id) FROM attendance_marks am
      JOIN attendance_sessions s ON s.id = am.session_id
      WHERE am.tenant_id = _tenant_id AND s.session_date = today
        AND am.superseded_by IS NULL AND am.status = 'absent'
    ),
    'sessions_today', (SELECT count(*) FROM attendance_sessions WHERE tenant_id = _tenant_id AND session_date = today),
    'pending_registrations', (SELECT count(*) FROM registrations WHERE tenant_id = _tenant_id AND status = 'new'),
    'new_registrations_7d', (SELECT count(*) FROM registrations WHERE tenant_id = _tenant_id AND created_at >= week_ago),
    'collected_this_month', (
      SELECT COALESCE(SUM(amount),0)::numeric FROM payments
      WHERE tenant_id = _tenant_id AND created_at >= month_start
    ),
    'collected_billing_this_month', (
      SELECT COALESCE(SUM(amount),0)::numeric FROM billing_payments
      WHERE tenant_id = _tenant_id AND status = 'succeeded' AND collected_at >= month_start
    ),
    'outstanding_balance', (
      SELECT COALESCE(SUM(balance),0)::numeric FROM billing_invoices
      WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid')
    ),
    'overdue_invoices', (
      SELECT count(*) FROM billing_invoices
      WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid')
        AND due_date IS NOT NULL AND due_date < today
    ),
    'live_matches', (SELECT count(*) FROM mc_matches WHERE tenant_id = _tenant_id AND status = 'live'),
    'upcoming_matches', (SELECT count(*) FROM mc_matches WHERE tenant_id = _tenant_id AND status IN ('scheduled','upcoming') AND scheduled_date >= today),
    'active_batches', (SELECT count(*) FROM batches WHERE tenant_id = _tenant_id),
    'unread_leads', (SELECT count(*) FROM leads WHERE tenant_id = _tenant_id AND status IN ('new','contacted')),
    'as_of', now()
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 2. Attendance summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_attendance_summary(_tenant_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL, _batch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d_from date := COALESCE(_from, (now() AT TIME ZONE 'Asia/Kolkata')::date - 30);
  d_to date := COALESCE(_to, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH marks AS (
    SELECT am.*, s.session_date, s.batch_id
    FROM attendance_marks am
    JOIN attendance_sessions s ON s.id = am.session_id
    WHERE am.tenant_id = _tenant_id
      AND am.superseded_by IS NULL
      AND s.session_date BETWEEN d_from AND d_to
      AND (_batch_id IS NULL OR s.batch_id = _batch_id)
  ), by_status AS (
    SELECT status::text AS status, count(*)::int AS n FROM marks GROUP BY status
  ), trend AS (
    SELECT session_date,
      count(*) FILTER (WHERE status IN ('present','late'))::int AS present,
      count(*) FILTER (WHERE status = 'absent')::int AS absent,
      count(*)::int AS total
    FROM marks GROUP BY session_date ORDER BY session_date
  ), at_risk AS (
    SELECT m.student_id, st.name,
      count(*) FILTER (WHERE m.status = 'absent')::int AS absences,
      count(*)::int AS total,
      round(100.0 * count(*) FILTER (WHERE m.status = 'absent') / NULLIF(count(*),0), 1) AS absent_pct
    FROM marks m JOIN students st ON st.id = m.student_id
    GROUP BY m.student_id, st.name
    HAVING count(*) FILTER (WHERE m.status = 'absent') >= 3
    ORDER BY absent_pct DESC NULLS LAST
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', d_from, 'to', d_to),
    'total_marks', (SELECT count(*) FROM marks),
    'present', COALESCE((SELECT n FROM by_status WHERE status='present'),0),
    'late',    COALESCE((SELECT n FROM by_status WHERE status='late'),0),
    'absent',  COALESCE((SELECT n FROM by_status WHERE status='absent'),0),
    'excused', COALESCE((SELECT n FROM by_status WHERE status='excused'),0),
    'attendance_pct', (
      SELECT round(100.0 * count(*) FILTER (WHERE status IN ('present','late')) / NULLIF(count(*),0), 1) FROM marks
    ),
    'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', session_date, 'present', present, 'absent', absent, 'total', total)) FROM trend), '[]'::jsonb),
    'at_risk', COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id', student_id, 'name', name, 'absences', absences, 'total', total, 'absent_pct', absent_pct)) FROM at_risk), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 3. Finance summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_finance_summary(_tenant_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  d_from date := COALESCE(_from, today - 180);
  d_to date := COALESCE(_to, today);
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH pays AS (
    SELECT amount::numeric, collected_at::date AS d
    FROM billing_payments
    WHERE tenant_id = _tenant_id AND status = 'succeeded'
      AND collected_at::date BETWEEN d_from AND d_to
    UNION ALL
    SELECT amount::numeric, created_at::date AS d
    FROM payments
    WHERE tenant_id = _tenant_id AND created_at::date BETWEEN d_from AND d_to
  ), monthly AS (
    SELECT to_char(date_trunc('month', d), 'YYYY-MM') AS month,
           SUM(amount)::numeric AS collected
    FROM pays GROUP BY 1 ORDER BY 1
  ), inv_status AS (
    SELECT status, count(*)::int AS n, COALESCE(SUM(total),0)::numeric AS total
    FROM billing_invoices WHERE tenant_id = _tenant_id
      AND issue_date BETWEEN d_from AND d_to
    GROUP BY status
  ), top_def AS (
    SELECT bi.student_id, s.name,
      COALESCE(SUM(bi.balance),0)::numeric AS outstanding,
      count(*)::int AS invoices,
      max(bi.due_date) AS latest_due
    FROM billing_invoices bi JOIN students s ON s.id = bi.student_id
    WHERE bi.tenant_id = _tenant_id AND bi.status IN ('issued','partially_paid')
    GROUP BY bi.student_id, s.name
    HAVING SUM(bi.balance) > 0
    ORDER BY outstanding DESC LIMIT 10
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', d_from, 'to', d_to),
    'collected', COALESCE((SELECT SUM(amount)::numeric FROM pays), 0),
    'outstanding', COALESCE((SELECT SUM(balance) FROM billing_invoices WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid')), 0),
    'overdue_count', (SELECT count(*) FROM billing_invoices WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid') AND due_date < today),
    'overdue_amount', COALESCE((SELECT SUM(balance) FROM billing_invoices WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid') AND due_date < today), 0),
    'invoice_status', COALESCE((SELECT jsonb_object_agg(status, jsonb_build_object('count', n, 'total', total)) FROM inv_status), '{}'::jsonb),
    'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'collected', collected)) FROM monthly), '[]'::jsonb),
    'top_defaulters', COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id', student_id, 'name', name, 'outstanding', outstanding, 'invoices', invoices, 'latest_due', latest_due)) FROM top_def), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 4. Registration summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_registration_summary(_tenant_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  d_from date := COALESCE(_from, today - 90);
  d_to date := COALESCE(_to, today);
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH regs AS (
    SELECT * FROM registrations
    WHERE tenant_id = _tenant_id AND created_at::date BETWEEN d_from AND d_to
  ), by_status AS (
    SELECT status, count(*)::int AS n FROM regs GROUP BY status
  ), by_source AS (
    SELECT COALESCE(source, 'unknown') AS source, count(*)::int AS n FROM regs GROUP BY 1
  ), weekly AS (
    SELECT to_char(date_trunc('week', created_at), 'YYYY-"W"IW') AS wk,
           count(*)::int AS n
    FROM regs GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', d_from, 'to', d_to),
    'total', (SELECT count(*) FROM regs),
    'pending', (SELECT count(*) FROM regs WHERE status = 'new'),
    'approved', (SELECT count(*) FROM regs WHERE status = 'approved'),
    'rejected', (SELECT count(*) FROM regs WHERE status = 'rejected'),
    'conversion_pct', (SELECT round(100.0 * count(*) FILTER (WHERE status='approved') / NULLIF(count(*),0), 1) FROM regs),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM by_status), '{}'::jsonb),
    'by_source', COALESCE((SELECT jsonb_object_agg(source, n) FROM by_source), '{}'::jsonb),
    'trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('week', wk, 'count', n)) FROM weekly), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 5. Communication summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_communication_summary(_tenant_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  d_from date := COALESCE(_from, today - 90);
  d_to date := COALESCE(_to, today);
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH camps AS (
    SELECT * FROM comm_campaigns
    WHERE tenant_id = _tenant_id AND created_at::date BETWEEN d_from AND d_to
  ), recent AS (
    SELECT id, title, category, status, recipient_count, delivered_count, failed_count, sent_at, created_at
    FROM camps ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 10
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', d_from, 'to', d_to),
    'total_campaigns', (SELECT count(*) FROM camps),
    'sent', (SELECT count(*) FROM camps WHERE status = 'sent'),
    'failed', (SELECT count(*) FROM camps WHERE status = 'failed'),
    'draft', (SELECT count(*) FROM camps WHERE status = 'draft'),
    'total_recipients', COALESCE((SELECT SUM(recipient_count)::int FROM camps), 0),
    'total_delivered', COALESCE((SELECT SUM(delivered_count)::int FROM camps), 0),
    'total_failed', COALESCE((SELECT SUM(failed_count)::int FROM camps), 0),
    'delivery_pct', (SELECT round(100.0 * SUM(delivered_count) / NULLIF(SUM(recipient_count),0), 1) FROM camps),
    'by_category', COALESCE((SELECT jsonb_object_agg(category, n) FROM (SELECT category, count(*)::int AS n FROM camps GROUP BY category) x), '{}'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(to_jsonb(recent)) FROM recent), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 6. Students summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_students_summary(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH s AS (
    SELECT * FROM students WHERE tenant_id = _tenant_id
  ), by_status AS (
    SELECT COALESCE(status,'unknown') AS k, count(*)::int AS n FROM s WHERE archived_at IS NULL GROUP BY 1
  ), by_gender AS (
    SELECT COALESCE(gender,'unknown') AS k, count(*)::int AS n FROM s WHERE archived_at IS NULL GROUP BY 1
  ), by_batch AS (
    SELECT COALESCE(b.name, 'Unassigned') AS name, count(*)::int AS n
    FROM s LEFT JOIN batches b ON b.id = s.batch_id
    WHERE s.archived_at IS NULL GROUP BY b.name ORDER BY n DESC
  ), age_buckets AS (
    SELECT
      count(*) FILTER (WHERE date_part('year', age(dob)) < 10)::int AS u10,
      count(*) FILTER (WHERE date_part('year', age(dob)) BETWEEN 10 AND 12)::int AS a10_12,
      count(*) FILTER (WHERE date_part('year', age(dob)) BETWEEN 13 AND 15)::int AS a13_15,
      count(*) FILTER (WHERE date_part('year', age(dob)) BETWEEN 16 AND 18)::int AS a16_18,
      count(*) FILTER (WHERE date_part('year', age(dob)) > 18)::int AS a18p
    FROM s WHERE archived_at IS NULL AND dob IS NOT NULL
  ), joined_trend AS (
    SELECT to_char(date_trunc('month', joined_at), 'YYYY-MM') AS month, count(*)::int AS n
    FROM s WHERE joined_at >= (now() - interval '12 months') GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM s WHERE archived_at IS NULL),
    'archived', (SELECT count(*) FROM s WHERE archived_at IS NOT NULL),
    'by_status', COALESCE((SELECT jsonb_object_agg(k, n) FROM by_status), '{}'::jsonb),
    'by_gender', COALESCE((SELECT jsonb_object_agg(k, n) FROM by_gender), '{}'::jsonb),
    'by_batch', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'count', n)) FROM by_batch), '[]'::jsonb),
    'age_buckets', COALESCE((SELECT to_jsonb(age_buckets) FROM age_buckets), '{}'::jsonb),
    'joined_trend', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', month, 'count', n)) FROM joined_trend), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 7. Academy health composite
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_academy_health(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  att_pct numeric; coll_pct numeric; retention_pct numeric; adm_momentum numeric; deliv_pct numeric;
  score numeric;
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  SELECT round(100.0 * count(*) FILTER (WHERE am.status IN ('present','late')) / NULLIF(count(*),0), 1)
    INTO att_pct
  FROM attendance_marks am JOIN attendance_sessions s ON s.id = am.session_id
  WHERE am.tenant_id = _tenant_id AND am.superseded_by IS NULL
    AND s.session_date >= today - 30;

  SELECT round(100.0 * SUM(amount_paid) / NULLIF(SUM(total),0), 1)
    INTO coll_pct
  FROM billing_invoices
  WHERE tenant_id = _tenant_id AND status IN ('issued','partially_paid','paid')
    AND issue_date >= today - 90;

  SELECT round(100.0 * count(*) FILTER (WHERE archived_at IS NULL) / NULLIF(count(*),0), 1)
    INTO retention_pct
  FROM students WHERE tenant_id = _tenant_id;

  SELECT round(100.0 *
    (SELECT count(*) FROM registrations WHERE tenant_id = _tenant_id AND created_at >= now() - interval '30 days')::numeric /
    NULLIF((SELECT count(*) FROM registrations WHERE tenant_id = _tenant_id AND created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days'), 0)
  , 1) INTO adm_momentum;

  SELECT round(100.0 * SUM(delivered_count) / NULLIF(SUM(recipient_count),0), 1)
    INTO deliv_pct
  FROM comm_campaigns WHERE tenant_id = _tenant_id AND created_at >= now() - interval '90 days';

  score := (
    COALESCE(att_pct,0) * 0.30
    + COALESCE(coll_pct,0) * 0.30
    + COALESCE(retention_pct,0) * 0.20
    + LEAST(COALESCE(adm_momentum,0),200) * 0.10
    + COALESCE(deliv_pct,0) * 0.10
  ) / 100 * 100;

  result := jsonb_build_object(
    'score', round(score, 1),
    'attendance_pct', att_pct,
    'collection_pct', coll_pct,
    'retention_pct', retention_pct,
    'admissions_momentum_pct', adm_momentum,
    'delivery_pct', deliv_pct,
    'as_of', now()
  );
  RETURN result;
END;
$$;

-- =============================================================
-- 8. Tournament summary + 9. Points table + 10. Top performers
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_tournament_summary(_tenant_id uuid, _tournament_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH m AS (
    SELECT * FROM mc_matches
    WHERE tenant_id = _tenant_id
      AND (_tournament_id IS NULL OR tournament_id = _tournament_id)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM m),
    'completed', (SELECT count(*) FROM m WHERE match_locked = true),
    'live', (SELECT count(*) FROM m WHERE status = 'live'),
    'upcoming', (SELECT count(*) FROM m WHERE status IN ('scheduled','upcoming')),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*)::int n FROM m GROUP BY status) s), '{}'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_points_table(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  result jsonb;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM mc_tournaments WHERE id = _tournament_id;
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH teams AS (
    SELECT tt.team_id, t.name, t.short_name, t.logo_url
    FROM mc_tournament_teams tt JOIN mc_teams t ON t.id = tt.team_id
    WHERE tt.tournament_id = _tournament_id
  ), finalized AS (
    SELECT * FROM mc_matches
    WHERE tournament_id = _tournament_id AND match_locked = true
  ), stats AS (
    SELECT
      te.team_id, te.name, te.short_name, te.logo_url,
      count(f.*) FILTER (WHERE te.team_id IN (f.team_a_id, f.team_b_id))::int AS played,
      count(f.*) FILTER (WHERE f.winner_team = te.team_id)::int AS won,
      count(f.*) FILTER (WHERE te.team_id IN (f.team_a_id, f.team_b_id) AND f.winner_team IS NOT NULL AND f.winner_team <> te.team_id)::int AS lost,
      count(f.*) FILTER (WHERE te.team_id IN (f.team_a_id, f.team_b_id) AND f.result IN ('tie','no_result'))::int AS tied
    FROM teams te LEFT JOIN finalized f ON te.team_id IN (f.team_a_id, f.team_b_id)
    GROUP BY te.team_id, te.name, te.short_name, te.logo_url
  )
  SELECT jsonb_agg(jsonb_build_object(
    'team_id', team_id, 'name', name, 'short_name', short_name, 'logo_url', logo_url,
    'played', played, 'won', won, 'lost', lost, 'tied', tied,
    'points', won * 2 + tied
  ) ORDER BY (won * 2 + tied) DESC, won DESC, name)
  INTO result FROM stats;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_top_performers(_tenant_id uuid, _kind text DEFAULT 'batting', _limit int DEFAULT 10, _tournament_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  IF _kind = 'batting' THEN
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.runs DESC NULLS LAST) INTO result FROM (
      SELECT c.athlete_profile_id, st.name,
             c.total_runs AS runs, c.matches_played AS matches,
             c.highest_score, c.batting_average AS average, c.strike_rate
      FROM mc_player_careers c
      JOIN mc_athlete_profiles ap ON ap.id = c.athlete_profile_id
      JOIN students st ON st.id = ap.student_id
      WHERE c.tenant_id = _tenant_id
      ORDER BY c.total_runs DESC NULLS LAST
      LIMIT _limit
    ) x;
  ELSIF _kind = 'bowling' THEN
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.wickets DESC NULLS LAST) INTO result FROM (
      SELECT c.athlete_profile_id, st.name,
             c.total_wickets AS wickets, c.matches_played AS matches,
             c.best_bowling, c.bowling_average AS average, c.economy_rate
      FROM mc_player_careers c
      JOIN mc_athlete_profiles ap ON ap.id = c.athlete_profile_id
      JOIN students st ON st.id = ap.student_id
      WHERE c.tenant_id = _tenant_id
      ORDER BY c.total_wickets DESC NULLS LAST
      LIMIT _limit
    ) x;
  ELSE
    result := '[]'::jsonb;
  END IF;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- =============================================================
-- 11. Academy records summary
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_academy_records_summary(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM mc_academy_records WHERE tenant_id = _tenant_id),
    'top', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (
      SELECT id, record_type, title, value, holder_name, achieved_at
      FROM mc_academy_records WHERE tenant_id = _tenant_id
      ORDER BY achieved_at DESC NULLS LAST LIMIT 10
    ) r), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- 12. AI report inputs (compact bundle)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_ai_report_inputs(_tenant_id uuid, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  result := jsonb_build_object(
    'dashboard', public.get_dashboard_summary(_tenant_id),
    'health', public.get_academy_health(_tenant_id),
    'attendance', public.get_attendance_summary(_tenant_id, _from, _to),
    'finance', public.get_finance_summary(_tenant_id, _from, _to),
    'registrations', public.get_registration_summary(_tenant_id, _from, _to),
    'communication', public.get_communication_summary(_tenant_id, _from, _to)
  );
  RETURN result;
END;
$$;

-- Grants: authenticated calls RPC; SECURITY DEFINER handles the rest.
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_summary(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_communication_summary(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_health(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tournament_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_points_table(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_performers(uuid, text, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_academy_records_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_report_inputs(uuid, date, date) TO authenticated;
