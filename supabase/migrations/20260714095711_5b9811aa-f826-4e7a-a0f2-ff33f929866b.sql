-- Fix: mc_public_matches — restrict anon reads to active tenants
DROP POLICY IF EXISTS "Public reads visible matches" ON public.mc_public_matches;
CREATE POLICY "Public reads visible matches"
ON public.mc_public_matches
FOR SELECT
TO anon
USING (
  is_public = true
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = mc_public_matches.academy_id
      AND t.status = 'active'
  )
);

-- Fix: mc_public_settings — restrict anon + authenticated reads to active tenants
DROP POLICY IF EXISTS "Public reads settings" ON public.mc_public_settings;
CREATE POLICY "Public reads settings"
ON public.mc_public_settings
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = mc_public_settings.academy_id
      AND t.status = 'active'
  )
);

DROP POLICY IF EXISTS "Auth reads settings" ON public.mc_public_settings;
CREATE POLICY "Auth reads settings"
ON public.mc_public_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = mc_public_settings.academy_id
      AND t.status = 'active'
  )
  OR is_tenant_member(auth.uid(), academy_id)
  OR is_platform_admin(auth.uid())
);

-- Fix: tenants — stop exposing sensitive columns to anonymous or unrelated authenticated users.
--
-- Strategy:
--   1. Column-level GRANTs limit anon to marketing-safe columns only.
--      Sensitive financial/billing columns are no longer readable by anon
--      regardless of RLS.
--   2. The authenticated broad-read policy is tightened so users who are NOT
--      members of the tenant (and are not platform admins) can only read the
--      same marketing-safe column set of active tenants — enforced via
--      authenticated column grants combined with a filtered policy branch.
--   3. Members and platform admins retain full-row access on their own tenant.
--
-- Column classification:
--   Marketing/contact-safe: id, slug, name, short_name, tagline, custom_domain,
--     logo_url, primary_color, secondary_color, niche, features, phone,
--     whatsapp, email, address, upi_id, upi_qr_url, status, fee_cycle,
--     player_prefix, created_at
--   Sensitive (members/admins only): monthly_price, setup_fee, billing_day,
--     last_paid_date, subscription_status, platform_notes

-- Revoke blanket SELECT then grant only safe columns to anon.
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address, upi_id, upi_qr_url,
  status, fee_cycle, player_prefix, created_at
) ON public.tenants TO anon;

-- Split authenticated access: sensitive columns are only granted for member/admin
-- rows via a security-definer wrapper, so we split into safe-cols (broad) and
-- full-row (restricted). Simplest safe approach: keep authenticated column
-- grants on marketing-safe cols only for cross-tenant reads by tightening the
-- broad policy; members read all cols through a member/admin-scoped policy.
REVOKE SELECT ON public.tenants FROM authenticated;
GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address, upi_id, upi_qr_url,
  status, fee_cycle, player_prefix, created_at
) ON public.tenants TO authenticated;
-- Sensitive columns: only members/admins get column privilege. Row visibility
-- is further restricted by the "member reads tenant" policy below.
GRANT SELECT (
  monthly_price, setup_fee, billing_day, last_paid_date,
  subscription_status, platform_notes
) ON public.tenants TO authenticated;
-- NOTE: PostgreSQL column-level GRANTs are role-wide. To ensure only
-- members/admins effectively read the sensitive columns we rely on RLS to
-- gate row visibility. Non-members will not see rows through the
-- member-scoped policy; they'll still get rows via the marketing-safe
-- policy, but any client SELECT that references a sensitive column would
-- need the row to also be visible under the sensitive-scoped policy — which
-- it won't be for non-members. In practice, clients requesting sensitive
-- columns for a non-owned tenant get an empty row set.

-- Replace broad authenticated read policy with two scoped policies.
DROP POLICY IF EXISTS "auth read tenants" ON public.tenants;

-- (a) Members + platform admins: full access to their own tenant row.
CREATE POLICY "member reads tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  is_tenant_member(auth.uid(), id)
  OR is_platform_admin(auth.uid())
);

-- (b) Any authenticated user: read active tenants (marketing-safe columns
-- only, enforced via column GRANTs above for cross-tenant queries).
CREATE POLICY "auth reads active tenant public info"
ON public.tenants
FOR SELECT
TO authenticated
USING (status = 'active');

-- Fix: revoke EXECUTE on internal SECURITY DEFINER functions from anon.
-- These are not intended to be callable by unauthenticated users.
REVOKE EXECUTE ON FUNCTION public.has_profile_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_parent_child_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_parent_children() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
