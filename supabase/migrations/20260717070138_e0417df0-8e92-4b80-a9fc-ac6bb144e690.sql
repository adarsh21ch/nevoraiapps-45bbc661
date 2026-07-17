-- Allow the freshly signed-up applicant to attach their auth user_id + email
-- + optional profile extras to the registration row they just created via
-- submit_registration. Runs as SECURITY DEFINER so it bypasses the tenant-scope
-- RLS on registrations, but only when the caller is signed in AND the target
-- row has no applicant_user_id yet (or already matches the caller).

CREATE OR REPLACE FUNCTION public.attach_applicant_to_registration(
  _registration_id uuid,
  _email text DEFAULT NULL,
  _address text DEFAULT NULL,
  _gender text DEFAULT NULL,
  _medical_notes text DEFAULT NULL,
  _documents jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _existing uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT applicant_user_id INTO _existing
    FROM public.registrations
   WHERE id = _registration_id;

  IF _existing IS NOT NULL AND _existing <> _uid THEN
    RAISE EXCEPTION 'Registration already linked to another applicant';
  END IF;

  UPDATE public.registrations
     SET applicant_user_id = _uid,
         email = COALESCE(NULLIF(btrim(_email), ''), email),
         address = COALESCE(NULLIF(btrim(_address), ''), address),
         gender = COALESCE(NULLIF(_gender, ''), gender),
         medical_notes = COALESCE(NULLIF(btrim(_medical_notes), ''), medical_notes),
         documents = COALESCE(_documents, documents)
   WHERE id = _registration_id;
END; $function$;

REVOKE ALL ON FUNCTION public.attach_applicant_to_registration(uuid, text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_applicant_to_registration(uuid, text, text, text, text, jsonb) TO authenticated;