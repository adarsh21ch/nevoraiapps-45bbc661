-- updated_at helper (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Event bus
CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  source_module text,
  source_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO authenticated;
GRANT ALL ON public.automation_events TO service_role;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read events" ON public.automation_events FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE POLICY "tenant members insert events" ON public.automation_events FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE INDEX idx_automation_events_pending ON public.automation_events (created_at) WHERE status = 'pending';
CREATE INDEX idx_automation_events_tenant_type ON public.automation_events (tenant_id, event_type, created_at DESC);

-- Rules
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  event_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage rules" ON public.automation_rules FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE INDEX idx_automation_rules_lookup ON public.automation_rules (tenant_id, event_type, enabled, priority);

-- Executions
CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.automation_events(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  action_type text NOT NULL,
  provider text,
  status text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  duration_ms integer,
  result jsonb,
  error text,
  next_retry_at timestamptz,
  dedupe_key text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_executions TO authenticated;
GRANT ALL ON public.automation_executions TO service_role;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read executions" ON public.automation_executions FOR SELECT TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));
CREATE INDEX idx_automation_exec_queue ON public.automation_executions (status, next_retry_at) WHERE status IN ('queued','retrying');
CREATE INDEX idx_automation_exec_tenant ON public.automation_executions (tenant_id, created_at DESC);
CREATE UNIQUE INDEX idx_automation_exec_dedupe ON public.automation_executions (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Provider configs (never store raw secrets — reference names only)
CREATE TABLE public.automation_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_provider_configs TO authenticated;
GRANT ALL ON public.automation_provider_configs TO service_role;
ALTER TABLE public.automation_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members manage provider configs" ON public.automation_provider_configs FOR ALL TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()))
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id) OR is_platform_admin(auth.uid()));

CREATE TRIGGER trg_automation_rules_updated BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_automation_provider_configs_updated BEFORE UPDATE ON public.automation_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_events;