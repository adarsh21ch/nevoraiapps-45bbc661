-- Part 1 & 2: Add tenant-level hero images + fees tab toggle
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS page_hero_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS show_fees_tab boolean NOT NULL DEFAULT true;

-- Refresh public directory view to expose the new fields
DROP VIEW IF EXISTS public.tenants_public_directory;
CREATE VIEW public.tenants_public_directory
WITH (security_invoker=on) AS
SELECT id, slug, name, short_name, tagline, custom_domain, logo_url,
       primary_color, secondary_color, niche, features, phone, whatsapp,
       email, address, upi_id, upi_qr_url, status, fee_cycle, player_prefix,
       registration_pdf_url, page_hero_images, show_fees_tab
FROM public.tenants
WHERE status = 'active';

GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;

-- Part 3: Backfill existing live + completed matches to public visibility so
-- Recent Results renders on the public matches page. Owner-created private
-- matches stay explicitly private only if scheduled/canceled.
UPDATE public.mc_matches
SET visibility = 'public'
WHERE visibility = 'private'
  AND status IN ('live','in_progress','completed','finalized');