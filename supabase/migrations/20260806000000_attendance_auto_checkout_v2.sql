-- AcademyOS V3 — Attendance Auto-Checkout and Safety Logic
-- 1. Automatic checkout at 12:00 AM (local time via CRON or periodic check)
-- 2. "Default checkout" does not count towards total hours.
-- 3. Reset all active states for the new day.

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
    -- We mark these with 'auto' source and a specific meta flag to exclude from hour calcs.
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

-- Grant access
GRANT EXECUTE ON FUNCTION public.process_daily_attendance_cleanup() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_daily_attendance_cleanup() TO authenticated;

-- Update the duration calculation logic to respect the exclusion flag
-- We need to drop and recreate the generated column or update the view.
-- Since duration_minutes is STORED, we'll update the view 'attendance_today' and historical logic instead 
-- to ensure consistency without a heavy table rebuild.

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
  -- Logic: If exclude_from_hours is true, duration is 0 for hour calculations
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
  (m.check_out_meta->>'auto_checkout' = 'true') as auto_checked_out
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE s.session_date = CURRENT_DATE
  AND m.superseded_by IS NULL;

-- Update attendance_visits view to also respect the exclude_from_hours flag
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

-- Apply security invoker for the view
ALTER VIEW public.attendance_visits SET (security_invoker = on);

GRANT SELECT ON public.attendance_visits TO authenticated;
GRANT ALL    ON public.attendance_visits TO service_role;
