REVOKE EXECUTE ON FUNCTION public.acquire_match_scoring_lock(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_match_scoring_lock(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_my_username(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_post_login_route() FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_platform_snapshot() FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.attach_applicant_to_registration(uuid, text, text, text, text, jsonb) FROM anon;