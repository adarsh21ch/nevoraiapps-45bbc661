CREATE OR REPLACE FUNCTION public.is_active_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = _tenant_id
      AND t.status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_tenant(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "tenant-assets anon read public sections" ON storage.objects;
CREATE POLICY "tenant-assets anon read public sections"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] IN (
    'public', 'gallery', 'hero', 'logo_url', 'founder', 'cta', 'star_players', 'upi_qr_url'
  )
  AND public.is_active_tenant(((storage.foldername(name))[1])::uuid)
);