-- Revoke anon EXECUTE on SECURITY DEFINER helpers that no public/anon path uses.
REVOKE EXECUTE ON FUNCTION public.attach_payment_ref(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_registration_payment(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mc_match_has_my_child(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mc_match_has_my_student(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mc_match_scorer_of(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mirror_billing_payment_to_legacy() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_post_login_route() FROM anon;

-- Ensure the roles that DO need them keep access.
GRANT EXECUTE ON FUNCTION public.attach_payment_ref(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_match_has_my_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_match_has_my_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_match_scorer_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_post_login_route() TO authenticated;