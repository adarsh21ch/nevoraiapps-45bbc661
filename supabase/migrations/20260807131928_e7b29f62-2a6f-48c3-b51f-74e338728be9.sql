CREATE POLICY "tenant-assets student photo insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] IN ('players','registration')
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "tenant-assets student photo update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] IN ('players','registration')
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.tenant_id = ((storage.foldername(name))[1])::uuid
  )
)
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] IN ('players','registration')
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid()
      AND s.tenant_id = ((storage.foldername(name))[1])::uuid
  )
);

CREATE POLICY "tenant-assets authenticated registration upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[2] = 'registration'
  AND public.is_active_tenant(((storage.foldername(name))[1])::uuid)
);