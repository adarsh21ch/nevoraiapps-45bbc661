
ALTER TABLE public.platform_comm_templates ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.platform_comm_providers ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'primary';
-- role: 'primary' | 'secondary' | 'fallback' — surfaces in priority UI; failover not yet wired.

CREATE TABLE IF NOT EXISTS public.platform_comm_channels (
  channel text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_comm_channels TO authenticated;
GRANT ALL ON public.platform_comm_channels TO service_role;
ALTER TABLE public.platform_comm_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read channels" ON public.platform_comm_channels
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));

INSERT INTO public.platform_comm_channels (channel, display_name, description) VALUES
  ('whatsapp','WhatsApp','WhatsApp Business messaging'),
  ('email','Email','Transactional email'),
  ('sms','SMS','Text message'),
  ('push','Push','Mobile push notification'),
  ('webhook','Webhook','Generic HTTP webhook')
ON CONFLICT (channel) DO NOTHING;

-- Recategorize seeded templates
UPDATE public.platform_comm_templates SET category='attendance' WHERE key IN ('parent.check_in','parent.check_out');
UPDATE public.platform_comm_templates SET category='fees'       WHERE key IN ('fee.reminder','payment.receipt');

-- Seed the full canonical template set (no-op if already present)
INSERT INTO public.platform_comm_templates (channel, key, name, body, variables, category) VALUES
  ('whatsapp','fee.overdue','Fee Overdue','Hi {{ParentName}}, the fee of {{Amount}} for {{StudentName}} is overdue since {{DueDate}}.', '["ParentName","StudentName","Amount","DueDate"]'::jsonb, 'fees'),
  ('whatsapp','tournament.match_started','Match Started','{{TeamA}} vs {{TeamB}} has started at {{Venue}}.', '["TeamA","TeamB","Venue"]'::jsonb, 'tournament'),
  ('whatsapp','tournament.match_finished','Match Finished','{{TeamA}} {{ScoreA}} — {{TeamB}} {{ScoreB}}. Winner: {{Winner}}.', '["TeamA","TeamB","ScoreA","ScoreB","Winner"]'::jsonb, 'tournament'),
  ('whatsapp','tournament.published','Tournament Published','{{TournamentName}} is now live. See fixtures at {{Link}}.', '["TournamentName","Link"]'::jsonb, 'tournament'),
  ('whatsapp','report.daily','Daily Report','Daily summary for {{Academy}} — {{Date}}: {{Attendance}} attended, {{Absent}} absent.', '["Academy","Date","Attendance","Absent"]'::jsonb, 'reports'),
  ('whatsapp','report.weekly','Weekly Report','Weekly summary for {{Academy}} — week ending {{Date}}.', '["Academy","Date"]'::jsonb, 'reports'),
  ('whatsapp','report.monthly','Monthly Report','Monthly summary for {{Academy}} — {{Month}}.', '["Academy","Month"]'::jsonb, 'reports'),
  ('whatsapp','crm.lead_created','Lead Created','New lead: {{Name}} ({{Phone}}) interested in {{Program}}.', '["Name","Phone","Program"]'::jsonb, 'crm'),
  ('whatsapp','crm.registration_approved','Registration Approved','Welcome {{StudentName}}! Your registration at {{Academy}} is approved.', '["StudentName","Academy"]'::jsonb, 'crm')
ON CONFLICT (channel, key) DO NOTHING;
