
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
GRANT SELECT ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conv_read" ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR public.is_platform_admin(auth.uid()));
CREATE INDEX idx_ai_conv_tenant ON public.ai_conversations(tenant_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_ai_conv_user ON public.ai_conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.ai_conversation_turns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_call_id TEXT,
  tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_conversation_turns TO authenticated;
GRANT ALL ON public.ai_conversation_turns TO service_role;
ALTER TABLE public.ai_conversation_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_turns_read" ON public.ai_conversation_turns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id
    AND (c.user_id = auth.uid()
      OR public.has_role(auth.uid(), c.tenant_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), c.tenant_id, 'owner'::app_role)
      OR public.is_platform_admin(auth.uid()))));
CREATE INDEX idx_ai_turns_conv ON public.ai_conversation_turns(conversation_id, created_at);

CREATE TABLE public.ai_conversation_summaries (
  conversation_id UUID NOT NULL PRIMARY KEY REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  content TEXT NOT NULL,
  replaced_turns INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_conversation_summaries TO authenticated;
GRANT ALL ON public.ai_conversation_summaries TO service_role;
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_summ_read" ON public.ai_conversation_summaries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id
    AND (c.user_id = auth.uid()
      OR public.has_role(auth.uid(), c.tenant_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), c.tenant_id, 'owner'::app_role)
      OR public.is_platform_admin(auth.uid()))));

CREATE TABLE public.ai_action_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  conversation_id UUID,
  tool_name TEXT NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  target TEXT,
  confirmation_title TEXT,
  confirmation_body TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  audit_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_action_queue TO authenticated;
GRANT ALL ON public.ai_action_queue TO service_role;
ALTER TABLE public.ai_action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_action_read" ON public.ai_action_queue FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR public.is_platform_admin(auth.uid()));
CREATE INDEX idx_ai_action_tenant_status ON public.ai_action_queue(tenant_id, status, created_at DESC);
CREATE INDEX idx_ai_action_user ON public.ai_action_queue(user_id, created_at DESC);

CREATE TABLE public.ai_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT NOT NULL,
  conversation_id UUID,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  failures INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  completion_status TEXT NOT NULL,
  confirmation_required BOOLEAN NOT NULL DEFAULT false,
  confirmation_approved BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_analytics TO authenticated;
GRANT ALL ON public.ai_analytics TO service_role;
ALTER TABLE public.ai_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analytics_read" ON public.ai_analytics FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR public.is_platform_admin(auth.uid()));
CREATE INDEX idx_ai_analytics_tenant ON public.ai_analytics(tenant_id, created_at DESC);
CREATE INDEX idx_ai_analytics_agent ON public.ai_analytics(tenant_id, agent_id, created_at DESC);

CREATE TABLE public.ai_rate_limits (
  bucket_key TEXT NOT NULL PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  tenant_id UUID,
  metric TEXT NOT NULL,
  time_window TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  used BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_rate_limits TO authenticated;
GRANT ALL ON public.ai_rate_limits TO service_role;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_rl_admin_read" ON public.ai_rate_limits FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND (
      public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
      OR public.has_role(auth.uid(), tenant_id, 'owner'::app_role))));
CREATE INDEX idx_ai_rl_scope ON public.ai_rate_limits(scope, scope_id, updated_at DESC);

CREATE TABLE public.ai_usage_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  day DATE NOT NULL,
  agent_id TEXT,
  model TEXT,
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, day, agent_id, model)
);
GRANT SELECT ON public.ai_usage_daily TO authenticated;
GRANT ALL ON public.ai_usage_daily TO service_role;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_read" ON public.ai_usage_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR public.has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR public.is_platform_admin(auth.uid()));
CREATE INDEX idx_ai_usage_daily ON public.ai_usage_daily(tenant_id, day DESC);

CREATE OR REPLACE FUNCTION public.ai_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ai_conv_touch BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER trg_ai_summ_touch BEFORE UPDATE ON public.ai_conversation_summaries
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER trg_ai_action_touch BEFORE UPDATE ON public.ai_action_queue
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER trg_ai_rl_touch BEFORE UPDATE ON public.ai_rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
CREATE TRIGGER trg_ai_usage_touch BEFORE UPDATE ON public.ai_usage_daily
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();
