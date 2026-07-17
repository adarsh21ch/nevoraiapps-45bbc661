
-- Security-definer helpers that bypass RLS on mc_match_squads / mc_athlete_profiles
-- so that parent/student read policies on mc_matches don't recursively re-check
-- policies on mc_match_squads (which itself references mc_matches).

CREATE OR REPLACE FUNCTION public.mc_match_has_my_child(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mc_match_squads sq
    JOIN public.mc_athlete_profiles ap ON ap.id = sq.athlete_profile_id
    WHERE sq.match_id = _match_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_child(ap.student_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.mc_match_has_my_student(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mc_match_squads sq
    JOIN public.mc_athlete_profiles ap ON ap.id = sq.athlete_profile_id
    WHERE sq.match_id = _match_id
      AND ap.student_id IS NOT NULL
      AND public.is_my_student(ap.student_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.mc_match_has_my_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_match_has_my_student(uuid) TO authenticated;

-- Replace the recursive policies on mc_matches with non-recursive ones.
DROP POLICY IF EXISTS "parent read child matches" ON public.mc_matches;
CREATE POLICY "parent read child matches" ON public.mc_matches
  FOR SELECT TO authenticated
  USING (public.mc_match_has_my_child(id));

DROP POLICY IF EXISTS "student self read matches" ON public.mc_matches;
CREATE POLICY "student self read matches" ON public.mc_matches
  FOR SELECT TO authenticated
  USING (public.mc_match_has_my_student(id));

-- Similarly, the "scorers rw match squads" policy on mc_match_squads references
-- mc_matches; replace with a security-definer helper.
CREATE OR REPLACE FUNCTION public.mc_match_scorer_of(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mc_matches m
    WHERE m.id = _match_id
      AND public.is_match_scorer(auth.uid(), m.tenant_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.mc_match_scorer_of(uuid) TO authenticated;

DROP POLICY IF EXISTS "scorers rw match squads" ON public.mc_match_squads;
CREATE POLICY "scorers rw match squads" ON public.mc_match_squads
  FOR ALL TO authenticated
  USING (public.mc_match_scorer_of(match_id))
  WITH CHECK (public.mc_match_scorer_of(match_id));
