
ALTER TABLE public.attendance_marks ADD COLUMN IF NOT EXISTS visit_type text;

COMMENT ON COLUMN public.attendance_marks.visit_type IS
  'Optional visit classification (practice, match, fitness, trial, camp, tournament, personal_coaching, other, or any future value). Set at check-in, immutable thereafter.';

DROP VIEW IF EXISTS public.attendance_visits;
DROP VIEW IF EXISTS public.attendance_today;

CREATE VIEW public.attendance_visits AS
SELECT m.id AS mark_id, m.tenant_id, m.student_id, m.session_id,
       s.session_date, s.batch_id, m.status,
       m.check_in_at, m.check_out_at, m.duration_minutes,
       m.source, m.marked_by, m.visit_type, m.note, m.created_at
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE m.superseded_by IS NULL
ORDER BY s.session_date DESC, m.check_in_at;

CREATE VIEW public.attendance_today AS
WITH today_marks AS (
  SELECT m.*
  FROM public.attendance_marks m
  JOIN public.attendance_sessions s ON s.id = m.session_id
  WHERE s.session_date = CURRENT_DATE AND m.superseded_by IS NULL
), per_student AS (
  SELECT
    tm.tenant_id, tm.session_id, tm.student_id,
    (array_agg(tm.id ORDER BY COALESCE(tm.check_in_at, tm.created_at) DESC))[1] AS latest_mark_id,
    min(tm.check_in_at) AS first_check_in_at,
    max(tm.check_out_at) AS last_check_out_at,
    (COALESCE(sum(tm.duration_minutes), 0))::int AS total_minutes,
    count(*) FILTER (WHERE tm.status = 'present' AND tm.check_in_at IS NOT NULL) AS visit_count,
    bool_or(tm.status = 'present' AND tm.check_in_at IS NOT NULL AND tm.check_out_at IS NULL) AS has_open_visit,
    bool_or(tm.status = 'present' AND tm.check_in_at IS NOT NULL) AS has_any_visit,
    bool_or(tm.status = 'absent') AS has_absent_row,
    max(tm.source::text) AS last_source,
    (array_agg(tm.marked_by ORDER BY COALESCE(tm.check_in_at, tm.created_at) DESC))[1] AS last_marked_by,
    array_agg(tm.visit_type ORDER BY COALESCE(tm.check_in_at, tm.created_at) DESC)
      FILTER (WHERE tm.visit_type IS NOT NULL) AS visit_types_desc
  FROM today_marks tm
  GROUP BY tm.tenant_id, tm.session_id, tm.student_id
)
SELECT
  ps.latest_mark_id AS mark_id,
  ps.tenant_id, ps.student_id, ps.session_id,
  s.session_date, s.batch_id,
  CASE
    WHEN ps.has_open_visit THEN 'in_academy'
    WHEN ps.has_any_visit THEN 'checked_out'
    WHEN ps.has_absent_row THEN 'absent'
    ELSE 'not_marked'
  END AS current_state,
  ps.first_check_in_at AS check_in_at,
  ps.last_check_out_at AS check_out_at,
  ps.total_minutes AS duration_minutes,
  ps.visit_count,
  ps.last_source AS source,
  ps.last_marked_by AS marked_by,
  (ps.visit_types_desc)[1] AS last_visit_type,
  CASE
    WHEN ps.has_absent_row AND NOT ps.has_any_visit THEN 'absent'::attendance_status
    ELSE 'present'::attendance_status
  END AS status
FROM per_student ps
JOIN public.attendance_sessions s ON s.id = ps.session_id;

CREATE OR REPLACE FUNCTION public.attendance_marks_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.check_out_at IS NOT NULL AND NEW.check_in_at IS NOT NULL AND NEW.check_out_at <= NEW.check_in_at THEN
      RAISE EXCEPTION 'Check-out must be after check-in';
    END IF;
    IF NEW.source = 'correction' AND NEW.corrects_id IS NULL THEN
      RAISE EXCEPTION 'Correction rows must reference the record they correct';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.session_id IS DISTINCT FROM OLD.session_id
   OR NEW.student_id IS DISTINCT FROM OLD.student_id
   OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
   OR NEW.source IS DISTINCT FROM OLD.source
   OR NEW.corrects_id IS DISTINCT FROM OLD.corrects_id
   OR NEW.check_in_at IS DISTINCT FROM OLD.check_in_at
   OR NEW.check_in_meta IS DISTINCT FROM OLD.check_in_meta
   OR NEW.visit_type IS DISTINCT FROM OLD.visit_type THEN
    RAISE EXCEPTION 'Attendance identity/check-in fields are immutable. Create a correction record instead.';
  END IF;

  IF (OLD.check_out_at IS NOT NULL) OR (OLD.status = 'absent') THEN
    IF NEW.check_out_at IS DISTINCT FROM OLD.check_out_at
     OR NEW.check_out_meta IS DISTINCT FROM OLD.check_out_meta
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.note IS DISTINCT FROM OLD.note THEN
      RAISE EXCEPTION 'Completed attendance is immutable. Create a correction record instead.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.check_out_at IS NOT NULL AND NEW.check_in_at IS NOT NULL AND NEW.check_out_at <= NEW.check_in_at THEN
    RAISE EXCEPTION 'Check-out must be after check-in';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.correct_attendance(
  _original_id uuid, _check_in_at timestamptz, _check_out_at timestamptz,
  _status attendance_status, _note text DEFAULT NULL,
  _check_in_meta jsonb DEFAULT '{}'::jsonb, _check_out_meta jsonb DEFAULT '{}'::jsonb,
  _visit_type text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE orig public.attendance_marks%ROWTYPE; new_id uuid;
BEGIN
  SELECT * INTO orig FROM public.attendance_marks WHERE id = _original_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original attendance not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), orig.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF orig.superseded_by IS NOT NULL THEN RAISE EXCEPTION 'Record already corrected'; END IF;

  INSERT INTO public.attendance_marks
    (tenant_id, session_id, student_id, status, check_in_at, check_out_at,
     source, marked_by, corrects_id, note, check_in_meta, check_out_meta, visit_type)
  VALUES
    (orig.tenant_id, orig.session_id, orig.student_id, _status,
     _check_in_at, _check_out_at, 'correction', auth.uid(), _original_id,
     _note, COALESCE(_check_in_meta,'{}'::jsonb), COALESCE(_check_out_meta,'{}'::jsonb),
     COALESCE(_visit_type, orig.visit_type))
  RETURNING id INTO new_id;

  UPDATE public.attendance_marks SET superseded_by = new_id WHERE id = _original_id;
  RETURN new_id;
END;
$function$;
