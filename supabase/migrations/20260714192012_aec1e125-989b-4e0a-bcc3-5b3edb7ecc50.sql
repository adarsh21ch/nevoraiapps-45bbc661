
-- 1. Optional auth link on students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_email_lower ON public.students(lower(email));

-- 2. Membership helper
CREATE OR REPLACE FUNCTION public.is_my_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND (
        s.user_id = auth.uid()
        OR (s.email IS NOT NULL AND auth.email() IS NOT NULL
            AND lower(s.email) = lower(auth.email()))
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_my_student(uuid) TO authenticated;

-- 3. SELECT policies scoped to the signed-in student

-- students: read own row
DROP POLICY IF EXISTS "student self read student" ON public.students;
CREATE POLICY "student self read student" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_my_student(id));

-- attendance_marks: read own marks
DROP POLICY IF EXISTS "student self read attendance marks" ON public.attendance_marks;
CREATE POLICY "student self read attendance marks" ON public.attendance_marks
  FOR SELECT TO authenticated
  USING (public.is_my_student(student_id));

-- attendance_sessions: read sessions that contain at least one of my marks
DROP POLICY IF EXISTS "student self read attendance sessions" ON public.attendance_sessions;
CREATE POLICY "student self read attendance sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attendance_marks m
    WHERE m.session_id = attendance_sessions.id
      AND public.is_my_student(m.student_id)
  ));

-- mc_athlete_profiles: read own
DROP POLICY IF EXISTS "student self read athlete profile" ON public.mc_athlete_profiles;
CREATE POLICY "student self read athlete profile" ON public.mc_athlete_profiles
  FOR SELECT TO authenticated
  USING (student_id IS NOT NULL AND public.is_my_student(student_id));

-- mc_cricket_profiles: read own (via athlete_profile_id)
DROP POLICY IF EXISTS "student self read cricket profile" ON public.mc_cricket_profiles;
CREATE POLICY "student self read cricket profile" ON public.mc_cricket_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_cricket_profiles.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_player_careers: read own
DROP POLICY IF EXISTS "student self read career" ON public.mc_player_careers;
CREATE POLICY "student self read career" ON public.mc_player_careers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_player_careers.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_coach_remarks: read own, only those marked visible to parents/students
DROP POLICY IF EXISTS "student self read remarks" ON public.mc_coach_remarks;
CREATE POLICY "student self read remarks" ON public.mc_coach_remarks
  FOR SELECT TO authenticated
  USING (visible_to_parents = true AND public.is_my_student(student_id));

-- mc_match_squads: read own squad rows
DROP POLICY IF EXISTS "student self read squads" ON public.mc_match_squads;
CREATE POLICY "student self read squads" ON public.mc_match_squads
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_match_squads.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_matches: read matches where I have a squad row
DROP POLICY IF EXISTS "student self read matches" ON public.mc_matches;
CREATE POLICY "student self read matches" ON public.mc_matches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.mc_match_squads sq
    JOIN public.mc_athlete_profiles ap ON ap.id = sq.athlete_profile_id
    WHERE sq.match_id = mc_matches.id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_athlete_achievements
DROP POLICY IF EXISTS "student self read achievements" ON public.mc_athlete_achievements;
CREATE POLICY "student self read achievements" ON public.mc_athlete_achievements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_achievements.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_athlete_awards
DROP POLICY IF EXISTS "student self read awards" ON public.mc_athlete_awards;
CREATE POLICY "student self read awards" ON public.mc_athlete_awards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_awards.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- mc_athlete_timeline
DROP POLICY IF EXISTS "student self read timeline" ON public.mc_athlete_timeline;
CREATE POLICY "student self read timeline" ON public.mc_athlete_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_timeline.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  ));

-- 4. Convenience RPC: return the signed-in student's context.
CREATE OR REPLACE FUNCTION public.get_my_student_context()
RETURNS TABLE (
  student_id uuid,
  tenant_id uuid,
  athlete_profile_id uuid,
  name text,
  player_id text,
  email text,
  photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS student_id,
    s.tenant_id,
    ap.id AS athlete_profile_id,
    s.name,
    s.player_id,
    s.email,
    s.photo_url
  FROM public.students s
  LEFT JOIN public.mc_athlete_profiles ap ON ap.student_id = s.id
  WHERE
    s.archived_at IS NULL
    AND (
      s.user_id = auth.uid()
      OR (s.email IS NOT NULL AND auth.email() IS NOT NULL
          AND lower(s.email) = lower(auth.email()))
    )
  ORDER BY s.joined_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_my_student_context() TO authenticated;
