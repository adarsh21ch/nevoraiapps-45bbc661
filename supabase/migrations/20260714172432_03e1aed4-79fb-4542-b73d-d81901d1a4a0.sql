
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-auto-close') THEN
    PERFORM cron.unschedule('attendance-auto-close');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.auto_close_overdue_sessions();
DROP FUNCTION IF EXISTS public.close_attendance_session(uuid, boolean);

DROP TRIGGER IF EXISTS attendance_marks_session_lock_ins ON public.attendance_marks;
DROP FUNCTION IF EXISTS public.attendance_marks_session_lock();

DROP TRIGGER IF EXISTS attendance_session_autoclose_ins ON public.attendance_sessions;
DROP FUNCTION IF EXISTS public.attendance_session_set_autoclose();

DROP INDEX IF EXISTS public.idx_attendance_sessions_open_autoclose;

DROP VIEW IF EXISTS public.attendance_today;

ALTER TABLE public.attendance_sessions
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS closed_by,
  DROP COLUMN IF EXISTS close_source,
  DROP COLUMN IF EXISTS auto_close_at;

ALTER TABLE public.batches DROP COLUMN IF EXISTS end_time;

CREATE VIEW public.attendance_today AS
SELECT m.id AS mark_id,
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
    CASE
        WHEN m.status = 'absent' THEN 'absent'
        WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NULL THEN 'in_academy'
        WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NOT NULL THEN 'checked_out'
        ELSE 'not_marked'
    END AS current_state
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE s.session_date = CURRENT_DATE
  AND m.superseded_by IS NULL;
GRANT SELECT ON public.attendance_today TO authenticated, service_role;
