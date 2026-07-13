
REVOKE EXECUTE ON FUNCTION public.is_match_scorer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_match_scorer(uuid, uuid) TO authenticated, service_role;
