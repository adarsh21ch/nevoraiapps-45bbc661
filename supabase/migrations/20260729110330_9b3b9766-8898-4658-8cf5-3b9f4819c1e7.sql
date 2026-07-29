-- Older published/cached frontend bundles still request upi_id / upi_qr_url
-- from this view. Dropping the columns made those clients fail with
-- "column does not exist" (HTTP 400), which broke tenant resolution and
-- rendered the "NOT CONNECTED" screen on the custom domain.
--
-- Keep the columns present for backward compatibility, but always NULL so no
-- payment collection detail is ever exposed anonymously. Real UPI details are
-- served to signed-in payers via the getManualPaymentSetup server fn.
DROP VIEW IF EXISTS public.tenants_public_directory;

CREATE VIEW public.tenants_public_directory
WITH (security_invoker = off) AS
SELECT
  id, slug, name, short_name, tagline, custom_domain, logo_url,
  primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  status, fee_cycle, player_prefix, registration_pdf_url,
  page_hero_images, show_fees_tab,
  NULL::text AS upi_id,
  NULL::text AS upi_qr_url
FROM public.tenants
WHERE status = 'active';

REVOKE ALL ON public.tenants_public_directory FROM anon, authenticated;
GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;
GRANT ALL ON public.tenants_public_directory TO service_role;