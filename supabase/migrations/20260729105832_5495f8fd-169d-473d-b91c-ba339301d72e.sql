-- =====================================================================
-- 1. Public academy directory view
-- The view was security_invoker=on, so anon reads were evaluated against
-- the tenants table RLS/grants (which anon no longer has) => the whole
-- public website failed to resolve its tenant. Recreate it as an owner-
-- rights (security_invoker=off) view exposing ONLY marketing-safe
-- columns, and drop upi_id / upi_qr_url from that surface.
-- =====================================================================
DROP VIEW IF EXISTS public.tenants_public_directory;

CREATE VIEW public.tenants_public_directory
WITH (security_invoker = off) AS
SELECT
  id, slug, name, short_name, tagline, custom_domain, logo_url,
  primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  status, fee_cycle, player_prefix, registration_pdf_url,
  page_hero_images, show_fees_tab
FROM public.tenants
WHERE status = 'active';

REVOKE ALL ON public.tenants_public_directory FROM anon, authenticated;
GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;
GRANT ALL ON public.tenants_public_directory TO service_role;

-- =====================================================================
-- 2. Policies that inline-queried public.tenants
-- Same root cause: anon has no privilege on public.tenants, so every
-- policy with an inline EXISTS(... FROM tenants ...) evaluated false.
-- Swap in the existing SECURITY DEFINER helper is_active_tenant().
-- Behaviour is identical; only the evaluation path changes.
-- =====================================================================

-- site_content
DROP POLICY IF EXISTS "public read site_content" ON public.site_content;
CREATE POLICY "public read site_content" ON public.site_content
  FOR SELECT TO anon
  USING (public.is_active_tenant(tenant_id));

DROP POLICY IF EXISTS "auth read site_content" ON public.site_content;
CREATE POLICY "auth read site_content" ON public.site_content
  FOR SELECT TO authenticated
  USING (public.is_active_tenant(tenant_id));

-- mc_public_matches
DROP POLICY IF EXISTS "Public reads visible matches" ON public.mc_public_matches;
CREATE POLICY "Public reads visible matches" ON public.mc_public_matches
  FOR SELECT TO anon
  USING (is_public = true AND public.is_active_tenant(academy_id));

-- mc_public_settings
DROP POLICY IF EXISTS "Public reads settings" ON public.mc_public_settings;
CREATE POLICY "Public reads settings" ON public.mc_public_settings
  FOR SELECT TO anon
  USING (public.is_active_tenant(academy_id));

DROP POLICY IF EXISTS "Auth reads settings" ON public.mc_public_settings;
CREATE POLICY "Auth reads settings" ON public.mc_public_settings
  FOR SELECT TO authenticated
  USING (
    public.is_active_tenant(academy_id)
    OR public.is_tenant_member(auth.uid(), academy_id)
    OR public.is_platform_admin(auth.uid())
  );

-- registrations (anon + authenticated insert)
DROP POLICY IF EXISTS "public insert registration" ON public.registrations;
CREATE POLICY "public insert registration" ON public.registrations
  FOR INSERT TO anon
  WITH CHECK (
    status = 'new'
    AND payment_status = ANY (ARRAY['pending','verified'])
    AND public.is_active_tenant(tenant_id)
    AND (batch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = registrations.batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true))
    AND (fee_plan_id IS NULL OR EXISTS (
      SELECT 1 FROM public.fee_plans f
      WHERE f.id = registrations.fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true))
  );

DROP POLICY IF EXISTS "auth insert registration" ON public.registrations;
CREATE POLICY "auth insert registration" ON public.registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'new'
    AND payment_status = ANY (ARRAY['pending','verified'])
    AND public.is_active_tenant(tenant_id)
    AND (batch_id IS NULL OR EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = registrations.batch_id AND b.tenant_id = registrations.tenant_id AND b.active = true))
    AND (fee_plan_id IS NULL OR EXISTS (
      SELECT 1 FROM public.fee_plans f
      WHERE f.id = registrations.fee_plan_id AND f.tenant_id = registrations.tenant_id AND f.active = true))
  );

-- =====================================================================
-- 3. attach_payment_ref — close the overwrite hole.
-- Previously any caller who guessed a registration id could rewrite the
-- payment reference of any pending registration in any academy.
-- Now: first write wins, and only while payment is still pending.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.attach_payment_ref(
  _registration_id uuid,
  _payment_ref text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _payment_ref IS NULL OR btrim(_payment_ref) = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  UPDATE public.registrations
     SET payment_ref = btrim(_payment_ref)
   WHERE id = _registration_id
     AND status = 'new'
     AND payment_status = 'pending'
     AND payment_ref IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_payment_ref(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_payment_ref(uuid, text) TO anon, authenticated;

-- =====================================================================
-- 4. Abuse protection on the two public write RPCs, using the existing
-- check_rate_limit() primitive. Limits are deliberately generous so a
-- real applicant retrying a form is never blocked.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.submit_lead(
  _tenant_id uuid, _name text, _phone text,
  _message text DEFAULT NULL::text, _source text DEFAULT 'site'::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF _phone IS NULL OR btrim(_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'Academy not accepting enquiries';
  END IF;

  -- 10 enquiries per phone per academy per 10 minutes.
  IF NOT public.check_rate_limit(
       'lead:' || _tenant_id::text || ':' || regexp_replace(btrim(_phone), '\D', '', 'g'),
       10, 600) THEN
    RAISE EXCEPTION 'Too many enquiries submitted. Please try again in a few minutes.';
  END IF;

  INSERT INTO public.leads (tenant_id, name, phone, message, source)
  VALUES (_tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_message),''),
          COALESCE(NULLIF(btrim(_source),''),'site'))
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_registration(
  _tenant_id uuid, _name text, _phone text, _fee_plan_id uuid,
  _batch_id uuid DEFAULT NULL::uuid, _dob date DEFAULT NULL::date,
  _guardian_name text DEFAULT NULL::text, _guardian_phone text DEFAULT NULL::text,
  _whatsapp text DEFAULT NULL::text, _policy_acceptances jsonb DEFAULT '[]'::jsonb,
  _lead_id uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF _phone IS NULL OR btrim(_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF _fee_plan_id IS NULL THEN RAISE EXCEPTION 'Fee plan is required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'Academy not accepting registrations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fee_plans WHERE id = _fee_plan_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid fee plan';
  END IF;
  IF _batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.batches WHERE id = _batch_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid batch';
  END IF;

  -- 8 registration submissions per phone per academy per 10 minutes.
  IF NOT public.check_rate_limit(
       'reg:' || _tenant_id::text || ':' || regexp_replace(btrim(_phone), '\D', '', 'g'),
       8, 600) THEN
    RAISE EXCEPTION 'Too many submissions. Please try again in a few minutes.';
  END IF;

  INSERT INTO public.registrations (
    tenant_id, name, phone, whatsapp, guardian_name, guardian_phone,
    dob, batch_id, fee_plan_id, status, payment_status, policy_acceptances
  ) VALUES (
    _tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_whatsapp),''),
    NULLIF(btrim(_guardian_name),''), NULLIF(btrim(_guardian_phone),''),
    _dob, _batch_id, _fee_plan_id, 'new', 'pending',
    COALESCE(_policy_acceptances, '[]'::jsonb)
  ) RETURNING id INTO new_id;

  IF _lead_id IS NOT NULL THEN
    UPDATE public.leads
       SET converted_registration_id = new_id,
           pipeline_stage = CASE WHEN pipeline_stage IN ('converted','rejected') THEN pipeline_stage ELSE 'approved' END
     WHERE id = _lead_id AND tenant_id = _tenant_id;

    INSERT INTO public.admission_timeline
      (tenant_id, lead_id, registration_id, event_type, to_stage, remark)
    VALUES
      (_tenant_id, _lead_id, new_id, 'registration_submitted', 'approved', 'Registration form submitted');
  END IF;

  RETURN new_id;
END; $$;