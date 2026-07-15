
CREATE TABLE public.platform_comm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  adapter_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  ready boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, adapter_key)
);

CREATE TABLE public.platform_comm_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.platform_comm_providers(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  health text NOT NULL DEFAULT 'unknown',
  credentials_ref text,
  last_activity_at timestamptz,
  messages_today integer NOT NULL DEFAULT 0,
  errors_today integer NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_comm_active (
  channel text PRIMARY KEY,
  provider_id uuid REFERENCES public.platform_comm_providers(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.platform_comm_accounts(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.platform_comm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, key)
);

GRANT SELECT ON public.platform_comm_providers TO authenticated;
GRANT SELECT ON public.platform_comm_accounts TO authenticated;
GRANT SELECT ON public.platform_comm_active TO authenticated;
GRANT SELECT ON public.platform_comm_templates TO authenticated;
GRANT ALL ON public.platform_comm_providers TO service_role;
GRANT ALL ON public.platform_comm_accounts TO service_role;
GRANT ALL ON public.platform_comm_active TO service_role;
GRANT ALL ON public.platform_comm_templates TO service_role;

ALTER TABLE public.platform_comm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_comm_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_comm_active    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_comm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read providers" ON public.platform_comm_providers
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins read accounts" ON public.platform_comm_accounts
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins read active" ON public.platform_comm_active
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins read templates" ON public.platform_comm_templates
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

INSERT INTO public.platform_comm_providers (channel, adapter_key, display_name, description, ready, enabled, priority) VALUES
  ('whatsapp', 'mock',       'Mock WhatsApp (simulated)', 'Simulated delivery for demos and testing.', true,  true, 10),
  ('whatsapp', 'botbiz',     'BotBiz',                    'BotBiz WhatsApp Business API.',             false, true, 20),
  ('whatsapp', 'meta',       'Meta Cloud API',            'Official Meta WhatsApp Cloud API.',         false, true, 30),
  ('whatsapp', 'twilio',     'Twilio WhatsApp',           'Twilio WhatsApp Business channel.',         false, true, 40),
  ('whatsapp', '360dialog',  '360dialog',                 '360dialog WhatsApp BSP.',                   false, true, 50),
  ('email',    'mock',       'Mock Email',                'Simulated email delivery.',                 true,  true, 10),
  ('email',    'resend',     'Resend',                    'Resend transactional email.',               false, true, 20),
  ('sms',      'mock',       'Mock SMS',                  'Simulated SMS delivery.',                   true,  true, 10),
  ('sms',      'twilio',     'Twilio SMS',                'Twilio programmable SMS.',                  false, true, 20),
  ('push',     'mock',       'Mock Push',                 'Simulated push.',                           true,  true, 10),
  ('webhook',  'generic',    'Generic Webhook',           'HTTP POST to configured URL.',              false, true, 10);

INSERT INTO public.platform_comm_active (channel, provider_id)
  SELECT p.channel, p.id FROM public.platform_comm_providers p WHERE p.adapter_key = 'mock';

INSERT INTO public.platform_comm_templates (channel, key, name, body, variables) VALUES
  ('whatsapp', 'parent.check_in',  'Parent Check-In',  'Hi {{ParentName}}, {{StudentName}} checked in at {{Time}} — {{Academy}}.', '["ParentName","StudentName","Time","Academy"]'::jsonb),
  ('whatsapp', 'parent.check_out', 'Parent Check-Out', 'Hi {{ParentName}}, {{StudentName}} checked out at {{Time}} — {{Academy}}.', '["ParentName","StudentName","Time","Academy"]'::jsonb),
  ('whatsapp', 'fee.reminder',     'Fee Reminder',     'Hi {{ParentName}}, a fee of {{Amount}} is due on {{DueDate}} for {{StudentName}}.', '["ParentName","StudentName","Amount","DueDate"]'::jsonb),
  ('whatsapp', 'payment.receipt',  'Payment Receipt',  'Received {{Amount}} for {{StudentName}}. Thank you — {{Academy}}.', '["ParentName","StudentName","Amount","Academy"]'::jsonb);

CREATE OR REPLACE FUNCTION public.tg_platform_comm_touch() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_pcp_updated BEFORE UPDATE ON public.platform_comm_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_platform_comm_touch();
CREATE TRIGGER trg_pca_updated BEFORE UPDATE ON public.platform_comm_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_platform_comm_touch();
CREATE TRIGGER trg_pct_updated BEFORE UPDATE ON public.platform_comm_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_platform_comm_touch();
