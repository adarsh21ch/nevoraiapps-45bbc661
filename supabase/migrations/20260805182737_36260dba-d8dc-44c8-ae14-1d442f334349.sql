-- Defensive overload for has_role to prevent "function does not exist" errors
-- when called with only 2 arguments (common in quick checks or incorrectly updated code)
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid, _role public.app_role
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Checks if user has the role in ANY tenant (or platform-wide)
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
