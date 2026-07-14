
-- Platform Audit Log
CREATE TABLE public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  tenant_id uuid,
  target_type text NOT NULL,
  target_id text,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.platform_audit_log TO authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read audit log"
  ON public.platform_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins insert audit log"
  ON public.platform_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND actor_id = auth.uid());
CREATE INDEX idx_platform_audit_tenant ON public.platform_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_platform_audit_actor ON public.platform_audit_log(actor_id, created_at DESC);

-- Platform Support Notes
CREATE TABLE public.platform_support_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_support_notes TO authenticated;
GRANT ALL ON public.platform_support_notes TO service_role;
ALTER TABLE public.platform_support_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage support notes"
  ON public.platform_support_notes FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE INDEX idx_platform_support_tenant ON public.platform_support_notes(tenant_id, created_at DESC);
CREATE TRIGGER trg_platform_support_notes_updated
  BEFORE UPDATE ON public.platform_support_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- log_platform_action RPC
CREATE OR REPLACE FUNCTION public.log_platform_action(
  _tenant_id uuid,
  _target_type text,
  _target_id text,
  _action text,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.platform_audit_log(actor_id, tenant_id, target_type, target_id, action, before_state, after_state)
  VALUES (auth.uid(), _tenant_id, _target_type, _target_id, _action, _before, _after)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- set_tenant_feature RPC (merge JSONB + audit)
CREATE OR REPLACE FUNCTION public.set_tenant_feature(
  _tenant_id uuid,
  _key text,
  _enabled boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE before_features jsonb; after_features jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT features INTO before_features FROM public.tenants WHERE id = _tenant_id;
  IF before_features IS NULL THEN before_features := '{}'::jsonb; END IF;
  after_features := before_features || jsonb_build_object(_key, _enabled);
  UPDATE public.tenants SET features = after_features WHERE id = _tenant_id;
  INSERT INTO public.platform_audit_log(actor_id, tenant_id, target_type, target_id, action, before_state, after_state)
  VALUES (auth.uid(), _tenant_id, 'flag', _key, 'flag_toggle',
          jsonb_build_object(_key, before_features->_key),
          jsonb_build_object(_key, _enabled));
END; $$;

-- get_platform_stats RPC
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'total_tenants', (SELECT count(*) FROM public.tenants),
    'active_tenants', (SELECT count(*) FROM public.tenants WHERE status = 'active'),
    'suspended_tenants', (SELECT count(*) FROM public.tenants WHERE status = 'suspended'),
    'trial_tenants', (SELECT count(*) FROM public.tenants WHERE status = 'trial'),
    'total_students', (SELECT count(*) FROM public.students WHERE archived_at IS NULL),
    'total_admins', (SELECT count(*) FROM public.profiles WHERE role IN ('owner','admin','coach','staff')),
    'total_parents', (SELECT count(*) FROM public.mc_parent_links),
    'campaigns_sent', (SELECT count(*) FROM public.comm_campaigns WHERE status = 'sent'),
    'notifications_30d', (SELECT count(*) FROM public.notifications WHERE created_at > now() - interval '30 days'),
    'mrr', (SELECT COALESCE(SUM(monthly_price),0) FROM public.tenants WHERE status = 'active'),
    'mrr_collected', (SELECT COALESCE(SUM(monthly_price),0) FROM public.tenants WHERE status = 'active' AND subscription_status = 'paid'),
    'latest_signups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'slug', slug, 'created_at', created_at, 'status', status
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (SELECT id, name, slug, created_at, status FROM public.tenants ORDER BY created_at DESC LIMIT 5) s
    )
  ) INTO result;
  RETURN result;
END; $$;
