CREATE OR REPLACE FUNCTION public.update_my_student_profile(_patch jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  SELECT id INTO _id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'No student record linked to this account';
  END IF;

  UPDATE public.students SET
    phone = COALESCE(NULLIF(_patch->>'phone',''), phone),
    email = COALESCE(NULLIF(_patch->>'email',''), email),
    dob = COALESCE(NULLIF(_patch->>'dob','')::date, dob),
    gender = COALESCE(NULLIF(_patch->>'gender',''), gender),
    address = COALESCE(NULLIF(_patch->>'address',''), address),
    city = COALESCE(NULLIF(_patch->>'city',''), city),
    state = COALESCE(NULLIF(_patch->>'state',''), state),
    pincode = COALESCE(NULLIF(_patch->>'pincode',''), pincode),
    guardian_name = COALESCE(NULLIF(_patch->>'guardian_name',''), guardian_name),
    guardian_phone = COALESCE(NULLIF(_patch->>'guardian_phone',''), guardian_phone),
    emergency_contact_name = COALESCE(NULLIF(_patch->>'emergency_contact_name',''), emergency_contact_name),
    emergency_contact_phone = COALESCE(NULLIF(_patch->>'emergency_contact_phone',''), emergency_contact_phone),
    blood_group = COALESCE(NULLIF(_patch->>'blood_group',''), blood_group),
    school_college = COALESCE(NULLIF(_patch->>'school_college',''), school_college),
    playing_role = COALESCE(NULLIF(_patch->>'playing_role',''), playing_role),
    batting_style = COALESCE(NULLIF(_patch->>'batting_style',''), batting_style),
    bowling_style = COALESCE(NULLIF(_patch->>'bowling_style',''), bowling_style),
    medical_notes = COALESCE(NULLIF(_patch->>'medical_notes',''), medical_notes),
    profile_completed_at = COALESCE(profile_completed_at, now()),
    updated_at = now()
  WHERE id = _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_student_profile(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_student_profile(jsonb) TO authenticated;