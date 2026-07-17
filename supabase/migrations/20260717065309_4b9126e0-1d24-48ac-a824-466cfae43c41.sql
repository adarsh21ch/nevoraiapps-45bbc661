CREATE OR REPLACE VIEW public.tenants_public_directory
WITH (security_invoker = off) AS
SELECT
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix,
  registration_pdf_url
FROM public.tenants
WHERE status = 'active';

GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;