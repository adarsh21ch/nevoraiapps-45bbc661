
-- =========================
-- Storage policies on storage.objects for bucket 'tenant-assets'
-- =========================
drop policy if exists "tenant-assets public read" on storage.objects;
create policy "tenant-assets public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'tenant-assets');

drop policy if exists "tenant-assets member insert" on storage.objects;
create policy "tenant-assets member insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tenant-assets'
  and public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

drop policy if exists "tenant-assets member update" on storage.objects;
create policy "tenant-assets member update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'tenant-assets'
  and public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'tenant-assets'
  and public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

drop policy if exists "tenant-assets member delete" on storage.objects;
create policy "tenant-assets member delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tenant-assets'
  and public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- =========================
-- approve_registration
-- =========================
create or replace function public.approve_registration(_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.registrations%rowtype;
  new_student_id uuid;
  fee_amount numeric;
begin
  select * into r from public.registrations where id = _registration_id;
  if not found then raise exception 'Registration not found'; end if;

  if not (public.is_tenant_member(auth.uid(), r.tenant_id) or public.is_platform_admin(auth.uid())) then
    raise exception 'Not authorized';
  end if;

  if r.status = 'approved' then
    raise exception 'Registration already approved';
  end if;

  insert into public.students (tenant_id, name, phone, dob, guardian_name, guardian_phone, batch_id, fee_plan_id, status)
  values (r.tenant_id, r.name, r.phone, r.dob, r.guardian_name, r.guardian_phone, r.batch_id, r.fee_plan_id, 'active')
  returning id into new_student_id;

  if r.fee_plan_id is not null and r.payment_status = 'verified' then
    select amount into fee_amount from public.fee_plans where id = r.fee_plan_id;
    if fee_amount is not null then
      insert into public.payments (tenant_id, student_id, amount, type, method, note, recorded_by)
      values (r.tenant_id, new_student_id, fee_amount, 'registration',
              coalesce(nullif(r.payment_ref, ''), 'upi'),
              'Auto-recorded on approval of registration ' || r.id::text,
              auth.uid());
    end if;
  end if;

  update public.registrations set status = 'approved' where id = _registration_id;
  return new_student_id;
end;
$$;

grant execute on function public.approve_registration(uuid) to authenticated;

-- =========================
-- Test owner user for Kirkland Cricket Academy
-- =========================
do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_email text := 'owner@kirklandcricket.test';
  v_password text := 'Kirkland@2026';
begin
  select id into v_tenant_id from public.tenants where slug = 'kirkland-cricket' limit 1;
  if v_tenant_id is null then
    raise notice 'Kirkland tenant not found; skipping test user creation';
    return;
  end if;

  select id into v_user_id from auth.users where email = v_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_user_id;
  end if;

  insert into public.profiles (user_id, tenant_id, role)
  values (v_user_id, v_tenant_id, 'owner')
  on conflict do nothing;
end $$;
