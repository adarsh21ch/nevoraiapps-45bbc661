
-- 1. Revoke anon access to sensitive tenant columns (RLS + column grants combine)
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain, logo_url,
  primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix
) ON public.tenants TO anon;

-- 2. Platform settings: scope to anon+authenticated instead of `public` role
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anon and authenticated read platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Fix trigger functions missing search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.leads_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 4. Revoke EXECUTE from anon on internal SECURITY DEFINER helpers
-- (Keep public: submit_lead, submit_registration, attach_payment_ref, claim_registration_payment)
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_player_prefix(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_registration(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_player_id() FROM anon, public;

-- Ensure authenticated still has needed access to helpers used by RLS/policies
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_registration(uuid) TO authenticated;
