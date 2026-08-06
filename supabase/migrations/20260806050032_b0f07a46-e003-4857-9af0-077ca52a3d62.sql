DROP VIEW IF EXISTS public.tenants_public_directory;

CREATE VIEW public.tenants_public_directory
WITH (security_invoker = off) AS
SELECT
  id, slug, name, short_name, tagline, custom_domain, logo_url,
  primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  status, fee_cycle, player_prefix, registration_pdf_url,
  page_hero_images, show_fees_tab,
  gender_pricing_enabled,
  admission_fee_enabled,
  NULL::text AS upi_id,
  NULL::text AS upi_qr_url
FROM public.tenants
WHERE status = 'active';

REVOKE ALL ON public.tenants_public_directory FROM anon, authenticated;
GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;
GRANT ALL ON public.tenants_public_directory TO service_role;