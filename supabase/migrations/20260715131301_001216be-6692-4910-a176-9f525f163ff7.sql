ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS parent_mobile text,
  ADD COLUMN IF NOT EXISTS parent_whatsapp text,
  ADD COLUMN IF NOT EXISTS guardian_whatsapp text,
  ADD COLUMN IF NOT EXISTS preferred_notification_channel text NOT NULL DEFAULT 'whatsapp';

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.automation_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  execution_id uuid REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.automation_events(id) ON DELETE SET NULL,
  student_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp',
  provider text NOT NULL DEFAULT 'whatsapp',
  adapter text NOT NULL DEFAULT 'mock',
  recipient_name text,
  recipient_number text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error text,
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_deliveries_tenant_created
  ON public.automation_deliveries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_deliveries_student
  ON public.automation_deliveries(student_id);
CREATE INDEX IF NOT EXISTS idx_automation_deliveries_execution
  ON public.automation_deliveries(execution_id);

GRANT SELECT ON public.automation_deliveries TO authenticated;
GRANT ALL ON public.automation_deliveries TO service_role;

ALTER TABLE public.automation_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view own deliveries" ON public.automation_deliveries;
CREATE POLICY "Tenant members can view own deliveries"
  ON public.automation_deliveries FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Service role manages deliveries" ON public.automation_deliveries;
CREATE POLICY "Service role manages deliveries"
  ON public.automation_deliveries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_automation_deliveries_updated ON public.automation_deliveries;
CREATE TRIGGER trg_automation_deliveries_updated
  BEFORE UPDATE ON public.automation_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_deliveries;
