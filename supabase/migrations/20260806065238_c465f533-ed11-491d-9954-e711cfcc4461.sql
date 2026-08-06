CREATE POLICY "tenant-assets anon registration upload"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] = 'aadhaar'
);

CREATE POLICY "tenant-assets anon registration read"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] = 'aadhaar'
);