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
  -- Note: This requires the function owner (usually postgres) to have permission to write to auth.users.
  UPDATE auth.users 
  SET encrypted_password = crypt(_new_password, gen_salt('bf')) 
  WHERE id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
