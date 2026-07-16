-- Section-aware storage RLS for tenant-assets bucket.
-- Anonymous & authenticated public read is limited to known public-by-function
-- section folders. Authenticated tenant members (+ platform admins) can read
-- everything under their tenant, covering private sections like students/ and
-- payments/proofs/.
--
-- Path convention: {tenant_id}/{section}/{filename}
-- storage.foldername(name)[1] = tenant_id, [2] = section
--
-- upi_qr_url is included in the anon allowlist because parents (authenticated
-- but NOT tenant members) fetch it via signedUrl on /parent/billing, and the
-- QR encodes the same UPI ID the academy prints on posters — public-by-function.
-- Genuinely private paths: students/*, payments/proofs/*.
--
-- Future public sections MUST write under the 'public/' prefix (already
-- allowlisted) rather than adding a new root folder here.
--
-- Rollback:
--   DROP POLICY "tenant-assets anon read public sections" ON storage.objects;
--   DROP POLICY "tenant-assets member read all" ON storage.objects;
--   CREATE POLICY "tenant-assets public read" ON storage.objects FOR SELECT TO public
--     USING (bucket_id = 'tenant-assets' AND EXISTS (
--       SELECT 1 FROM tenants t
--       WHERE t.id = ((storage.foldername(objects.name))[1])::uuid
--         AND t.status = 'active'));

DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;

CREATE POLICY "tenant-assets anon read public sections"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] IN (
    'public', 'gallery', 'hero', 'logo_url', 'founder', 'cta', 'star_players', 'upi_qr_url'
  )
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = ((storage.foldername(objects.name))[1])::uuid
      AND t.status = 'active'
  )
);

CREATE POLICY "tenant-assets member read all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (
    public.is_platform_admin(auth.uid())
    OR public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);