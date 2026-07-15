-- Phase 2 completion: report-shaped RPCs so the browser stops aggregating.
-- Each function is SECURITY DEFINER, asserts tenant membership, and returns the
-- exact JSON shape the legacy fetch*Report functions used to compute client-side.

-- 1) Attendance report -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_attendance(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_from date := (_from AT TIME ZONE 'UTC')::date;
  d_to   date := (_to   AT TIME ZONE 'UTC')::date;
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH sess AS (
    SELECT s.id, s.session_date, s.batch_id, COALESCE(b.name,'Unassigned') AS batch_name
    FROM attendance_sessions s
    LEFT JOIN batches b ON b.id = s.batch_id
    WHERE s.tenant_id = _tenant_id
      AND s.session_date BETWEEN d_from AND d_to
  ), marks AS (
    SELECT m.status, m.student_id, se.session_date, se.batch_name,
           st.name AS student_name
    FROM attendance_marks m
    JOIN sess se ON se.id = m.session_id
    LEFT JOIN students st ON st.id = m.student_id
    WHERE m.tenant_id = _tenant_id
      AND m.superseded_by IS NULL
      AND m.created_at BETWEEN _from AND _to
  ), totals AS (
    SELECT
      count(*)::int AS total_marks,
      count(*) FILTER (WHERE status IN ('present','late'))::int AS present,
      count(*) FILTER (WHERE status = 'absent')::int AS absent,
      count(*) FILTER (WHERE status = 'late')::int AS late
    FROM marks
  ), daily AS (
    SELECT session_date::text AS date,
      count(*) FILTER (WHERE status IN ('present','late'))::int AS present,
      count(*) FILTER (WHERE status = 'absent')::int AS absent
    FROM marks GROUP BY session_date ORDER BY session_date
  ), per_batch AS (
    SELECT batch_name AS batch,
      count(*) FILTER (WHERE status IN ('present','late'))::int AS present,
      count(*) FILTER (WHERE status IN ('present','late','absent'))::int AS total
    FROM marks GROUP BY batch_name
  ), per_student AS (
    SELECT student_id, COALESCE(student_name,'—') AS name,
      count(*) FILTER (WHERE status IN ('present','late'))::int AS present,
      count(*) FILTER (WHERE status IN ('present','late','absent'))::int AS total
    FROM marks GROUP BY student_id, student_name
    HAVING count(*) FILTER (WHERE status IN ('present','late','absent')) >= 3
  ), top_students AS (
    SELECT name, present, total,
      round(100.0 * present / NULLIF(total,0))::int AS percent
    FROM per_student
    ORDER BY (1.0 * present / NULLIF(total,0)) DESC NULLS LAST, name
    LIMIT 10
  ), low_students AS (
    SELECT name, present, total,
      round(100.0 * present / NULLIF(total,0))::int AS percent
    FROM per_student
    ORDER BY (1.0 * present / NULLIF(total,0)) ASC NULLS LAST, name
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totalMarks', (SELECT total_marks FROM totals),
    'present', (SELECT present FROM totals),
    'absent',  (SELECT absent  FROM totals),
    'late',    (SELECT late    FROM totals),
    'percent', COALESCE((SELECT round(100.0 * present / NULLIF(present + absent,0))::int FROM totals), 0),
    'sessions', (SELECT count(*)::int FROM sess),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'date', date, 'present', present, 'absent', absent,
       'percent', CASE WHEN present+absent > 0 THEN round(100.0 * present / (present+absent))::int ELSE 0 END
    )) FROM daily), '[]'::jsonb),
    'perBatch', COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'batch', batch, 'present', present, 'total', total,
       'percent', CASE WHEN total > 0 THEN round(100.0 * present / total)::int ELSE 0 END
    ) ORDER BY (CASE WHEN total>0 THEN 1.0*present/total ELSE 0 END) DESC) FROM per_batch), '[]'::jsonb),
    'topStudents', COALESCE((SELECT jsonb_agg(to_jsonb(top_students)) FROM top_students), '[]'::jsonb),
    'lowStudents', COALESCE((SELECT jsonb_agg(to_jsonb(low_students)) FROM low_students), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;

-- 2) Billing report ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_billing(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur_period text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM');
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);

  WITH pays AS (
    SELECT amount::numeric AS amount, type::text, method::text, created_at
    FROM payments
    WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to
  ), totals AS (
    SELECT COALESCE(SUM(amount),0)::numeric AS revenue, count(*)::int AS n FROM pays
  ), by_month AS (
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS ym,
           to_char(date_trunc('month', created_at), 'Mon') AS label,
           SUM(amount)::numeric AS amount
    FROM pays GROUP BY 1,2 ORDER BY 1
  ), by_method AS (
    SELECT UPPER(COALESCE(method,'other')) AS label, SUM(amount)::numeric AS amount
    FROM pays GROUP BY 1 ORDER BY 2 DESC
  ), by_type AS (
    SELECT CASE type
             WHEN 'monthly' THEN 'Monthly fees'
             WHEN 'registration' THEN 'Registration'
             WHEN 'personal_coaching' THEN 'Personal coaching'
             ELSE 'Other' END AS label,
           SUM(amount)::numeric AS amount
    FROM pays GROUP BY 1 ORDER BY 2 DESC
  ), paid_this_period AS (
    SELECT DISTINCT student_id FROM payments
    WHERE tenant_id = _tenant_id AND period = cur_period
  ), pending AS (
    SELECT s.id, COALESCE(fp.amount,0)::numeric AS plan_amount
    FROM students s
    LEFT JOIN fee_plans fp ON fp.id = s.fee_plan_id
    WHERE s.tenant_id = _tenant_id AND s.status = 'active'
      AND s.id NOT IN (SELECT student_id FROM paid_this_period WHERE student_id IS NOT NULL)
  )
  SELECT jsonb_build_object(
    'revenue', (SELECT revenue FROM totals),
    'paymentsCount', (SELECT n FROM totals),
    'avgPayment', CASE WHEN (SELECT n FROM totals) > 0
                       THEN round((SELECT revenue FROM totals) / (SELECT n FROM totals))::int ELSE 0 END,
    'byMonth', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'amount', amount)) FROM by_month), '[]'::jsonb),
    'byMethod', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'amount', amount)) FROM by_method), '[]'::jsonb),
    'byType', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'amount', amount)) FROM by_type), '[]'::jsonb),
    'pendingStudents', (SELECT count(*)::int FROM pending),
    'pendingApprox',   COALESCE((SELECT SUM(plan_amount)::numeric FROM pending), 0),
    'collectionRate', CASE
      WHEN (SELECT revenue FROM totals) + COALESCE((SELECT SUM(plan_amount) FROM pending),0) > 0
      THEN round(100.0 * (SELECT revenue FROM totals) /
                 ((SELECT revenue FROM totals) + COALESCE((SELECT SUM(plan_amount) FROM pending),0)))::int
      ELSE 100 END
  ) INTO result;
  RETURN result;
END; $$;

-- 3) Admissions report -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_admissions(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  WITH leads_r AS (
    SELECT id, source, pipeline_stage, created_at
    FROM leads
    WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to
  ), by_stage AS (
    SELECT COALESCE(pipeline_stage,'new') AS stage, count(*)::int AS count
    FROM leads_r GROUP BY 1
  ), by_source AS (
    SELECT COALESCE(NULLIF(source,''),'manual') AS label, count(*)::int AS count
    FROM leads_r GROUP BY 1 ORDER BY 2 DESC
  ), totals AS (
    SELECT
      count(*)::int AS total_leads,
      count(*) FILTER (WHERE pipeline_stage IN ('trial','decision','approved','converted'))::int AS trials,
      count(*) FILTER (WHERE pipeline_stage = 'converted')::int AS converted,
      count(*) FILTER (WHERE pipeline_stage = 'rejected')::int AS rejected
    FROM leads_r
  ), conv_times AS (
    SELECT EXTRACT(EPOCH FROM (t.created_at - l.created_at))/86400.0 AS days
    FROM leads_r l
    JOIN admission_timeline t ON t.lead_id = l.id AND t.to_stage = 'converted'
    WHERE l.pipeline_stage = 'converted'
  )
  SELECT jsonb_build_object(
    'totalLeads', (SELECT total_leads FROM totals),
    'byStage',    COALESCE((SELECT jsonb_agg(jsonb_build_object('stage', stage, 'count', count)) FROM by_stage), '[]'::jsonb),
    'bySource',   COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_source), '[]'::jsonb),
    'conversion', CASE WHEN (SELECT total_leads FROM totals) > 0
                       THEN round(100.0 * (SELECT converted FROM totals) / (SELECT total_leads FROM totals))::int
                       ELSE 0 END,
    'avgConversionDays', (SELECT round((AVG(days))::numeric, 1) FROM conv_times WHERE days >= 0),
    'trials',    (SELECT trials    FROM totals),
    'converted', (SELECT converted FROM totals),
    'rejected',  (SELECT rejected  FROM totals)
  ) INTO result;
  RETURN result;
END; $$;

-- 4) Players report ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_players(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  WITH s AS (
    SELECT st.id, st.status, st.dob, st.playing_role, st.created_at,
           COALESCE(b.name,'Unassigned') AS batch_name
    FROM students st
    LEFT JOIN batches b ON b.id = st.batch_id
    WHERE st.tenant_id = _tenant_id
  ), totals AS (
    SELECT
      count(*) FILTER (WHERE status = 'active')::int AS active,
      count(*) FILTER (WHERE status = 'inactive')::int AS inactive,
      count(*) FILTER (WHERE status = 'graduated')::int AS graduated,
      count(*) FILTER (WHERE created_at BETWEEN _from AND _to)::int AS new_in_range
    FROM s
  ), by_batch AS (
    SELECT batch_name AS label, count(*)::int AS count FROM s GROUP BY 1 ORDER BY 2 DESC
  ), by_role AS (
    SELECT COALESCE(playing_role::text,'unspecified') AS label, count(*)::int AS count
    FROM s GROUP BY 1 ORDER BY 2 DESC
  ), by_age AS (
    SELECT CASE
             WHEN age_years < 8  THEN 'Under 8'
             WHEN age_years < 12 THEN '8–11'
             WHEN age_years < 15 THEN '12–14'
             WHEN age_years < 18 THEN '15–17'
             ELSE '18+'
           END AS label,
           count(*)::int AS count
    FROM (
      SELECT FLOOR(EXTRACT(EPOCH FROM (now() - dob))/(365.25*86400))::int AS age_years
      FROM s WHERE dob IS NOT NULL
    ) a
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'active',    (SELECT active FROM totals),
    'inactive',  (SELECT inactive FROM totals),
    'graduated', (SELECT graduated FROM totals),
    'newInRange',(SELECT new_in_range FROM totals),
    'byBatch',   COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_batch), '[]'::jsonb),
    'byAgeGroup',COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_age), '[]'::jsonb),
    'byRole',    COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_role), '[]'::jsonb),
    'retention', CASE
      WHEN (SELECT active+inactive+graduated FROM totals) > 0
      THEN round(100.0 * (SELECT active FROM totals) / (SELECT active+inactive+graduated FROM totals))::int
      ELSE 0 END
  ) INTO result;
  RETURN result;
END; $$;

-- 5) Matches report ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_matches(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_from date := (_from AT TIME ZONE 'UTC')::date;
  d_to   date := (_to   AT TIME ZONE 'UTC')::date;
  result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  WITH m AS (
    SELECT status::text AS status, result::text AS result
    FROM mc_matches
    WHERE tenant_id = _tenant_id
      AND scheduled_date BETWEEN d_from AND d_to
  ), buckets AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      count(*) FILTER (WHERE status = 'live')::int AS live,
      count(*) FILTER (WHERE status IN ('scheduled','upcoming'))::int AS upcoming
    FROM m
  ), by_result AS (
    SELECT COALESCE(result, status, 'unknown') AS label, count(*)::int AS count
    FROM m GROUP BY 1 ORDER BY 2 DESC
  )
  SELECT jsonb_build_object(
    'total',     (SELECT total FROM buckets),
    'completed', (SELECT completed FROM buckets),
    'upcoming',  (SELECT upcoming FROM buckets),
    'live',      (SELECT live FROM buckets),
    'byResult',  COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_result), '[]'::jsonb),
    'topScorers','[]'::jsonb
  ) INTO result;
  RETURN result;
END; $$;

-- 6) Website report ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_website(
  _tenant_id uuid, _from timestamptz, _to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._agg_assert_tenant(_tenant_id);
  WITH regs AS (
    SELECT id FROM registrations
    WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to
  ), ld AS (
    SELECT COALESCE(NULLIF(source,''),'website') AS label
    FROM leads WHERE tenant_id = _tenant_id AND created_at BETWEEN _from AND _to
  ), by_source AS (
    SELECT label, count(*)::int AS count FROM ld GROUP BY 1 ORDER BY 2 DESC
  )
  SELECT jsonb_build_object(
    'webRegistrations', (SELECT count(*)::int FROM regs),
    'webLeads',         (SELECT count(*)::int FROM ld),
    'bySource', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'count', count)) FROM by_source), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END; $$;

-- Grants (RPCs; authenticated only — tenant assertion inside)
REVOKE ALL ON FUNCTION public.get_report_attendance(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_report_billing(uuid, timestamptz, timestamptz)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_report_admissions(uuid, timestamptz, timestamptz)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_report_players(uuid, timestamptz, timestamptz)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_report_matches(uuid, timestamptz, timestamptz)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_report_website(uuid, timestamptz, timestamptz)     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_report_attendance(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_billing(uuid, timestamptz, timestamptz)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_admissions(uuid, timestamptz, timestamptz)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_players(uuid, timestamptz, timestamptz)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_matches(uuid, timestamptz, timestamptz)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_website(uuid, timestamptz, timestamptz)     TO authenticated;
