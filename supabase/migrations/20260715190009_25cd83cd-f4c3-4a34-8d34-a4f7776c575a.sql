
-- Break the RLS recursion cycle between attendance_marks <-> attendance_sessions.
-- Parent/student SELECT policies on attendance_sessions queried attendance_marks,
-- whose "coach access" policy queries attendance_sessions -> infinite recursion.
-- Wrap the cross-table check in SECURITY DEFINER helpers that bypass RLS.

CREATE OR REPLACE FUNCTION public.parent_can_read_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_marks m
    WHERE m.session_id = _session_id
      AND public.is_my_child(m.student_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_read_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_marks m
    WHERE m.session_id = _session_id
      AND public.is_my_student(m.student_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.parent_can_read_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_can_read_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parent_can_read_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_read_session(uuid) TO authenticated;

DROP POLICY IF EXISTS "parent read child attendance sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "student self read attendance sessions" ON public.attendance_sessions;

CREATE POLICY "parent read child attendance sessions"
  ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (public.parent_can_read_session(id));

CREATE POLICY "student self read attendance sessions"
  ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (public.student_can_read_session(id));
