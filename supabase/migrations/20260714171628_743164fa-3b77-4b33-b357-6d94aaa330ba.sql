ALTER VIEW public.attendance_today SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.correct_attendance(uuid,timestamptz,timestamptz,public.attendance_status,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_attendance(uuid,timestamptz,timestamptz,public.attendance_status,text,jsonb,jsonb) TO authenticated;