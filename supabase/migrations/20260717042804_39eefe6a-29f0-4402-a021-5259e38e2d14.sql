ALTER VIEW public.tenants_public_directory SET (security_invoker = off);
GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;