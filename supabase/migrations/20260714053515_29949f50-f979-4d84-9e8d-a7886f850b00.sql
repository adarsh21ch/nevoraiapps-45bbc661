
-- 1. Constrain profiles.role to owner|coach
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner','coach'));

-- 2. Role helper (SECURITY DEFINER, avoids recursive RLS)
create or replace function public.has_profile_role(_uid uuid, _role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = _uid and role = _role
  )
$$;

-- 3. Restrict finance tables: coaches CANNOT read/write
drop policy if exists "auth read fee_plans" on public.fee_plans;
drop policy if exists "member manages fee_plans" on public.fee_plans;
create policy "auth read fee_plans" on public.fee_plans
  for select using (
    active = true
    or (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  );
create policy "owner manages fee_plans" on public.fee_plans
  for all using (
    (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  ) with check (
    (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "tenant scope payments" on public.payments;
create policy "owner scope payments" on public.payments
  for all using (
    (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  ) with check (
    (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "admin or tenant read price changes" on public.tenant_price_changes;
create policy "owner reads price changes" on public.tenant_price_changes
  for select using (
    public.is_platform_admin(auth.uid())
    or (public.is_tenant_member(auth.uid(), tenant_id) and public.has_profile_role(auth.uid(),'owner'))
  );

-- 4. Restrict tenant settings updates to owners (coaches cannot mutate academy config)
drop policy if exists "member updates tenant" on public.tenants;
create policy "owner updates tenant" on public.tenants
  for update using (
    (public.is_tenant_member(auth.uid(), id) and public.has_profile_role(auth.uid(),'owner'))
    or public.is_platform_admin(auth.uid())
  );
