-- AcademyOS V3 — Attendance Auto-Checkout and Safety Logic
-- 1. Automatic checkout function
CREATE OR REPLACE FUNCTION public.process_daily_attendance_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _yesterday date := (CURRENT_DATE - INTERVAL '1 day')::date;
BEGIN
    -- 1. Auto check-out students who forgot to check out yesterday.
    UPDATE public.attendance_marks
    SET 
        check_out_at = (_yesterday + INTERVAL '23 hours 59 minutes 59 seconds')::timestamptz,
        check_out_meta = check_out_meta || jsonb_build_object('auto_checkout', true, 'exclude_from_hours', true),
        source = 'auto'
    WHERE 
        check_out_at IS NULL 
        AND status = 'present'
        AND id IN (
            SELECT m.id 
            FROM public.attendance_marks m
            JOIN public.attendance_sessions s ON s.id = m.session_id
            WHERE s.session_date <= _yesterday
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_daily_attendance_cleanup() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_daily_attendance_cleanup() TO authenticated;

-- Drop views to redefine them with new columns
DROP VIEW IF EXISTS public.attendance_today;
DROP VIEW IF EXISTS public.attendance_visits;

CREATE OR REPLACE VIEW public.attendance_today AS
SELECT
  m.id           AS mark_id,
  m.tenant_id,
  m.student_id,
  m.session_id,
  s.session_date,
  s.batch_id,
  m.status,
  m.check_in_at,
  m.check_out_at,
  CASE 
    WHEN m.check_out_meta->>'exclude_from_hours' = 'true' THEN 0
    ELSE m.duration_minutes
  END AS duration_minutes,
  m.source,
  m.marked_by,
  CASE
    WHEN m.status = 'absent' THEN 'absent'
    WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NULL THEN 'in_academy'
    WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NOT NULL THEN 'checked_out'
    ELSE 'not_marked'
  END::text AS current_state,
  COALESCE((m.check_out_meta->>'auto_checkout' = 'true'), false) as auto_checked_out
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE s.session_date = CURRENT_DATE
  AND m.superseded_by IS NULL;

CREATE OR REPLACE VIEW public.attendance_visits AS
SELECT
  m.id           AS mark_id,
  m.tenant_id,
  m.student_id,
  m.session_id,
  s.session_date,
  s.batch_id,
  m.status,
  m.check_in_at,
  m.check_out_at,
  CASE 
    WHEN m.check_out_meta->>'exclude_from_hours' = 'true' THEN 0
    ELSE m.duration_minutes
  END AS duration_minutes,
  m.source,
  m.marked_by,
  m.visit_type,
  m.note,
  m.created_at
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE m.superseded_by IS NULL
  AND m.status = 'present';

-- Apply security invoker for the views
ALTER VIEW public.attendance_today SET (security_invoker = on);
ALTER VIEW public.attendance_visits SET (security_invoker = on);

GRANT SELECT ON public.attendance_today TO authenticated;
GRANT ALL    ON public.attendance_today TO service_role;
GRANT SELECT ON public.attendance_visits TO authenticated;
GRANT ALL    ON public.attendance_visits TO service_role;