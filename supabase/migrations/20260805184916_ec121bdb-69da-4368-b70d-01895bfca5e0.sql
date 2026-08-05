CREATE OR REPLACE FUNCTION public.process_daily_attendance_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Auto check-out students who forgot to check out on any PREVIOUS day.
    -- We set check-out to the end of their respective session date.
    UPDATE public.attendance_marks m
    SET 
        check_out_at = (s.session_date + INTERVAL '23 hours 59 minutes 59 seconds')::timestamptz,
        check_out_meta = COALESCE(m.check_out_meta, '{}'::jsonb) || jsonb_build_object('auto_checkout', true, 'exclude_from_hours', true),
        source = 'auto'
    FROM public.attendance_sessions s
    WHERE m.session_id = s.id
        AND m.check_out_at IS NULL 
        AND m.status = 'present'
        AND s.session_date < CURRENT_DATE;
END;
$$;