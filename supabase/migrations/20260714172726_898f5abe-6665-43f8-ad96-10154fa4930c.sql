
-- Drop the hard uniqueness that prevented multiple visits/day
ALTER TABLE public.attendance_marks
  DROP CONSTRAINT IF EXISTS attendance_marks_session_id_student_id_key;
DROP INDEX IF EXISTS public.attendance_marks_session_id_student_id_key;
DROP INDEX IF EXISTS public.attendance_marks_active_uniq;

-- Only ONE open check-in per (session, student) at a time.
-- Multiple completed visits (check_out_at IS NOT NULL) are allowed.
CREATE UNIQUE INDEX attendance_marks_one_open_per_student
  ON public.attendance_marks (session_id, student_id)
  WHERE superseded_by IS NULL
    AND status = 'present'
    AND check_in_at IS NOT NULL
    AND check_out_at IS NULL;

-- Rebuild the live "attendance today" view: one row per (session, student).
DROP VIEW IF EXISTS public.attendance_today;
CREATE VIEW public.attendance_today AS
WITH today_marks AS (
  SELECT m.*
  FROM public.attendance_marks m
  JOIN public.attendance_sessions s ON s.id = m.session_id
  WHERE s.session_date = CURRENT_DATE
    AND m.superseded_by IS NULL
),
per_student AS (
  SELECT
    tenant_id,
    session_id,
    student_id,
    -- Latest mark id — used by UI to check-out the current visit
    (ARRAY_AGG(id ORDER BY COALESCE(check_in_at, created_at) DESC))[1] AS latest_mark_id,
    MIN(check_in_at)                                                  AS first_check_in_at,
    MAX(check_out_at)                                                 AS last_check_out_at,
    COALESCE(SUM(duration_minutes), 0)::int                           AS total_minutes,
    COUNT(*) FILTER (WHERE status = 'present' AND check_in_at IS NOT NULL) AS visit_count,
    BOOL_OR(status = 'present' AND check_in_at IS NOT NULL AND check_out_at IS NULL) AS has_open_visit,
    BOOL_OR(status = 'present' AND check_in_at IS NOT NULL)           AS has_any_visit,
    BOOL_OR(status = 'absent')                                        AS has_absent_row,
    MAX(source::text)                                                 AS last_source,
    (ARRAY_AGG(marked_by ORDER BY COALESCE(check_in_at, created_at) DESC))[1] AS last_marked_by
  FROM today_marks
  GROUP BY tenant_id, session_id, student_id
)
SELECT
  ps.latest_mark_id AS mark_id,
  ps.tenant_id,
  ps.student_id,
  ps.session_id,
  s.session_date,
  s.batch_id,
  CASE
    WHEN ps.has_open_visit                     THEN 'in_academy'
    WHEN ps.has_any_visit                      THEN 'checked_out'
    WHEN ps.has_absent_row                     THEN 'absent'
    ELSE 'not_marked'
  END                                          AS current_state,
  ps.first_check_in_at                         AS check_in_at,
  ps.last_check_out_at                         AS check_out_at,
  ps.total_minutes                             AS duration_minutes,
  ps.visit_count,
  ps.last_source                               AS source,
  ps.last_marked_by                            AS marked_by,
  CASE WHEN ps.has_absent_row AND NOT ps.has_any_visit THEN 'absent'::attendance_status
       ELSE 'present'::attendance_status END   AS status
FROM per_student ps
JOIN public.attendance_sessions s ON s.id = ps.session_id;
GRANT SELECT ON public.attendance_today TO authenticated, service_role;

-- Chronological visit list per student (used by Player Timeline / Daily Summary).
CREATE OR REPLACE VIEW public.attendance_visits AS
SELECT
  m.id            AS mark_id,
  m.tenant_id,
  m.student_id,
  m.session_id,
  s.session_date,
  s.batch_id,
  m.status,
  m.check_in_at,
  m.check_out_at,
  m.duration_minutes,
  m.source,
  m.marked_by,
  m.note,
  m.created_at
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE m.superseded_by IS NULL
ORDER BY s.session_date DESC, m.check_in_at ASC NULLS LAST;
GRANT SELECT ON public.attendance_visits TO authenticated, service_role;
