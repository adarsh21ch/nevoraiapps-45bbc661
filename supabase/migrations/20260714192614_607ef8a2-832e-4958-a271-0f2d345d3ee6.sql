
-- 1. Per-academy toggle for parent billing visibility
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS show_billing_to_parents boolean NOT NULL DEFAULT false;

-- 2. Parent membership helper
CREATE OR REPLACE FUNCTION public.is_my_child(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mc_parent_links l
    WHERE l.parent_user_id = auth.uid()
      AND l.student_id = _student_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_my_child(uuid) TO authenticated;

-- 3. Parent SELECT policies (read-only, mirrors student self policies)

DROP POLICY IF EXISTS "parent read linked child" ON public.students;
CREATE POLICY "parent read linked child" ON public.students
  FOR SELECT TO authenticated
  USING (public.is_my_child(id));

DROP POLICY IF EXISTS "parent read child attendance marks" ON public.attendance_marks;
CREATE POLICY "parent read child attendance marks" ON public.attendance_marks
  FOR SELECT TO authenticated
  USING (public.is_my_child(student_id));

DROP POLICY IF EXISTS "parent read child attendance sessions" ON public.attendance_sessions;
CREATE POLICY "parent read child attendance sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attendance_marks m
    WHERE m.session_id = attendance_sessions.id
      AND public.is_my_child(m.student_id)
  ));

DROP POLICY IF EXISTS "parent read child athlete profile" ON public.mc_athlete_profiles;
CREATE POLICY "parent read child athlete profile" ON public.mc_athlete_profiles
  FOR SELECT TO authenticated
  USING (student_id IS NOT NULL AND public.is_my_child(student_id));

DROP POLICY IF EXISTS "parent read child cricket profile" ON public.mc_cricket_profiles;
CREATE POLICY "parent read child cricket profile" ON public.mc_cricket_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_cricket_profiles.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child career" ON public.mc_player_careers;
CREATE POLICY "parent read child career" ON public.mc_player_careers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_player_careers.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child remarks" ON public.mc_coach_remarks;
CREATE POLICY "parent read child remarks" ON public.mc_coach_remarks
  FOR SELECT TO authenticated
  USING (visible_to_parents = true AND public.is_my_child(student_id));

DROP POLICY IF EXISTS "parent read child squads" ON public.mc_match_squads;
CREATE POLICY "parent read child squads" ON public.mc_match_squads
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_match_squads.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child matches" ON public.mc_matches;
CREATE POLICY "parent read child matches" ON public.mc_matches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.mc_match_squads sq
    JOIN public.mc_athlete_profiles ap ON ap.id = sq.athlete_profile_id
    WHERE sq.match_id = mc_matches.id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child achievements" ON public.mc_athlete_achievements;
CREATE POLICY "parent read child achievements" ON public.mc_athlete_achievements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_achievements.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child awards" ON public.mc_athlete_awards;
CREATE POLICY "parent read child awards" ON public.mc_athlete_awards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_awards.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

DROP POLICY IF EXISTS "parent read child timeline" ON public.mc_athlete_timeline;
CREATE POLICY "parent read child timeline" ON public.mc_athlete_timeline
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mc_athlete_profiles ap
    WHERE ap.id = mc_athlete_timeline.athlete_profile_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  ));

-- 4. Billing visibility — parent can read invoices of linked child ONLY when
--    the academy has explicitly opted in.
DROP POLICY IF EXISTS "parent read child invoices when opted in" ON public.billing_invoices;
CREATE POLICY "parent read child invoices when opted in" ON public.billing_invoices
  FOR SELECT TO authenticated
  USING (
    public.is_my_child(student_id)
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = billing_invoices.tenant_id
        AND t.show_billing_to_parents = true
    )
  );
