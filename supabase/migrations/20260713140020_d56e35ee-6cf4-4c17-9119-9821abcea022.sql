DROP POLICY IF EXISTS "tenant-assets public read" ON storage.objects;

CREATE POLICY "tenant-assets public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'tenant-assets'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = ((storage.foldername(name))[1])::uuid
      AND t.status = 'active'
  )
);