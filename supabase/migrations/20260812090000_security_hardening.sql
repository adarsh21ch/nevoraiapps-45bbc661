-- Security Hardening Phase 1: Fix SECURITY DEFINER search paths and tighten RLS

-- 1) Fix SECURITY DEFINER functions missing search_path
-- Path hijacking protection

CREATE OR REPLACE FUNCTION public.admin_set_student_password(
  _tenant_id UUID,
  _student_id UUID,
  _new_password TEXT
)
RETURNS VOID AS $$
DECLARE
  _user_id UUID;
BEGIN
  -- Verify caller is owner or admin of this tenant
  IF NOT (public.has_role(auth.uid(), 'owner', _tenant_id) OR public.has_role(auth.uid(), 'admin', _tenant_id)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get user_id from student
  SELECT user_id INTO _user_id FROM public.students WHERE id = _student_id AND tenant_id = _tenant_id;
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Student user not found';
  END IF;

  -- Update auth.users directly. 
  UPDATE auth.users 
  SET encrypted_password = crypt(_new_password, gen_salt('bf')) 
  WHERE id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.upsert_match_draft_selection(
    p_tenant_id uuid,
    p_match_id uuid,
    p_innings_id uuid,
    p_striker_athlete_id uuid DEFAULT NULL,
    p_striker_name text DEFAULT NULL,
    p_non_striker_athlete_id uuid DEFAULT NULL,
    p_non_striker_name text DEFAULT NULL,
    p_bowler_athlete_id uuid DEFAULT NULL,
    p_bowler_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.mc_match_draft_selections (
        tenant_id,
        match_id,
        innings_id,
        striker_athlete_id,
        striker_name,
        non_striker_athlete_id,
        non_striker_name,
        bowler_athlete_id,
        bowler_name,
        updated_at
    )
    VALUES (
        p_tenant_id,
        p_match_id,
        p_innings_id,
        p_striker_athlete_id,
        p_striker_name,
        p_non_striker_athlete_id,
        p_non_striker_name,
        p_bowler_athlete_id,
        p_bowler_name,
        now()
    )
    ON CONFLICT (innings_id)
    DO UPDATE SET
        striker_athlete_id = EXCLUDED.striker_athlete_id,
        striker_name = EXCLUDED.striker_name,
        non_striker_athlete_id = EXCLUDED.non_striker_athlete_id,
        non_striker_name = EXCLUDED.non_striker_name,
        bowler_athlete_id = EXCLUDED.bowler_athlete_id,
        bowler_name = EXCLUDED.bowler_name,
        updated_at = now();
END;
$$;

-- 2) Tighten site_content RLS: Ensure only active tenants' content is visible to public
DROP POLICY IF EXISTS "public read site_content" ON public.site_content;
CREATE POLICY "public read site_content" ON public.site_content
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = site_content.tenant_id AND t.status = 'active'));

-- 3) Privilege Cleanup: Revoke EXECUTE on internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.admin_set_student_password(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_password(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_match_draft_selection(uuid, uuid, uuid, uuid, text, uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_match_draft_selection(uuid, uuid, uuid, uuid, text, uuid, text, uuid, text) TO authenticated;

