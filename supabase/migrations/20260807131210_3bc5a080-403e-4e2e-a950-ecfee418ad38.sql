DROP POLICY IF EXISTS "tenant-assets anon registration read" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets anon registration upload" ON storage.objects;

CREATE POLICY "tenant-assets anon registration upload"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] = 'registration'
  AND is_active_tenant(((storage.foldername(name))[1])::uuid)
);