-- Restore table-level privileges on public.tenants.
-- The 20260714181302 migration replaced these with a fixed column allow-list,
-- which broke every SELECT * (Platform Admin list + owner tenant resolver)
-- as soon as a new column (show_billing_to_parents) was added.
-- RLS policies remain the true row-level gate.

-- Full access for authenticated (RLS restricts rows to members/platform admins,
-- plus active marketing rows via the "auth read active tenant marketing cols" policy).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

-- anon stays column-scoped: marketing fields only on active tenants (RLS ensures status='active').
-- Re-issue in case future columns are added; explicit list acts as the anon safety net.
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix
) ON public.tenants TO anon;
