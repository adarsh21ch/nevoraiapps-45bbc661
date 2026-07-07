
-- Allow platform admins to upload/update/delete logos & assets for any tenant.
-- Previously only tenant members could write to tenant-assets, so owners logging in
-- from the Platform Admin panel couldn't upload logos for the academies they manage.

drop policy if exists "tenant-assets member insert" on storage.objects;
create policy "tenant-assets member insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tenant-assets'
  and (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

drop policy if exists "tenant-assets member update" on storage.objects;
create policy "tenant-assets member update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'tenant-assets'
  and (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
)
with check (
  bucket_id = 'tenant-assets'
  and (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

drop policy if exists "tenant-assets member delete" on storage.objects;
create policy "tenant-assets member delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tenant-assets'
  and (
    public.is_platform_admin(auth.uid())
    or public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
