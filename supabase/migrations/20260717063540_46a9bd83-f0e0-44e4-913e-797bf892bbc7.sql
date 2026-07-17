
-- platform_sports: split public read from admin override
DROP POLICY IF EXISTS "Anyone can read enabled sports" ON public.platform_sports;
DROP POLICY IF EXISTS "Platform admins manage sports" ON public.platform_sports;

CREATE POLICY "public read enabled sports"
  ON public.platform_sports FOR SELECT TO anon
  USING (status = 'enabled');

CREATE POLICY "auth read sports"
  ON public.platform_sports FOR SELECT TO authenticated
  USING (status = 'enabled' OR is_platform_admin(auth.uid()));

CREATE POLICY "platform admins manage sports"
  ON public.platform_sports FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- mc_player_careers: staff CRUD -> authenticated only
DROP POLICY IF EXISTS "Tenant members can view careers" ON public.mc_player_careers;
DROP POLICY IF EXISTS "Tenant members can insert careers" ON public.mc_player_careers;
DROP POLICY IF EXISTS "Tenant members can update careers" ON public.mc_player_careers;
DROP POLICY IF EXISTS "Tenant members can delete careers" ON public.mc_player_careers;

CREATE POLICY "Tenant members can view careers"
  ON public.mc_player_careers FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can insert careers"
  ON public.mc_player_careers FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can update careers"
  ON public.mc_player_careers FOR UPDATE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can delete careers"
  ON public.mc_player_careers FOR DELETE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- mc_tournaments: staff CRUD -> authenticated
DROP POLICY IF EXISTS "Tenant members can view tournaments" ON public.mc_tournaments;
DROP POLICY IF EXISTS "Tenant members can insert tournaments" ON public.mc_tournaments;
DROP POLICY IF EXISTS "Tenant members can update tournaments" ON public.mc_tournaments;
DROP POLICY IF EXISTS "Tenant members can delete tournaments" ON public.mc_tournaments;

CREATE POLICY "Tenant members can view tournaments"
  ON public.mc_tournaments FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can insert tournaments"
  ON public.mc_tournaments FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can update tournaments"
  ON public.mc_tournaments FOR UPDATE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can delete tournaments"
  ON public.mc_tournaments FOR DELETE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- mc_tournament_teams: staff CRUD -> authenticated
DROP POLICY IF EXISTS "Tenant members can view tournament teams" ON public.mc_tournament_teams;
DROP POLICY IF EXISTS "Tenant members can insert tournament teams" ON public.mc_tournament_teams;
DROP POLICY IF EXISTS "Tenant members can update tournament teams" ON public.mc_tournament_teams;
DROP POLICY IF EXISTS "Tenant members can delete tournament teams" ON public.mc_tournament_teams;

CREATE POLICY "Tenant members can view tournament teams"
  ON public.mc_tournament_teams FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can insert tournament teams"
  ON public.mc_tournament_teams FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can update tournament teams"
  ON public.mc_tournament_teams FOR UPDATE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "Tenant members can delete tournament teams"
  ON public.mc_tournament_teams FOR DELETE TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

-- tenants: owner update -> authenticated
DROP POLICY IF EXISTS "owner updates tenant" ON public.tenants;
CREATE POLICY "owner updates tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING ((is_tenant_member(auth.uid(), id) AND has_profile_role(auth.uid(), 'owner')) OR is_platform_admin(auth.uid()))
  WITH CHECK ((is_tenant_member(auth.uid(), id) AND has_profile_role(auth.uid(), 'owner')) OR is_platform_admin(auth.uid()));

-- payments: owner scope -> authenticated
DROP POLICY IF EXISTS "owner scope payments" ON public.payments;
CREATE POLICY "owner scope payments"
  ON public.payments FOR ALL TO authenticated
  USING ((is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner')) OR is_platform_admin(auth.uid()))
  WITH CHECK ((is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner')) OR is_platform_admin(auth.uid()));

-- tenant_price_changes: owner read -> authenticated
DROP POLICY IF EXISTS "owner reads price changes" ON public.tenant_price_changes;
CREATE POLICY "owner reads price changes"
  ON public.tenant_price_changes FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR (is_tenant_member(auth.uid(), tenant_id) AND has_profile_role(auth.uid(), 'owner')));
