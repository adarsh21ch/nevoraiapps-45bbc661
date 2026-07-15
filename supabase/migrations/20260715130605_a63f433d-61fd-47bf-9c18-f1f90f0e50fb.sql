-- Local updated_at helper (idempotent).
CREATE OR REPLACE FUNCTION public.automation_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.automation_rule_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'owner',
  event_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.automation_rule_templates TO authenticated;
GRANT SELECT ON public.automation_rule_templates TO anon;
GRANT ALL ON public.automation_rule_templates TO service_role;

ALTER TABLE public.automation_rule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are readable by everyone"
  ON public.automation_rule_templates
  FOR SELECT
  USING (true);

CREATE TRIGGER update_automation_rule_templates_updated_at
  BEFORE UPDATE ON public.automation_rule_templates
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();

INSERT INTO public.automation_rule_templates
  (template_key, name, description, category, audience, event_type, conditions, actions, default_enabled, priority)
VALUES
  ('parent.check_in',           'Student Check-In Notification',  'Notify parent when child checks in for practice.',      'attendance', 'parent', 'attendance.marked', '[{"path":"status","op":"eq","value":"present"}]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"parent_check_in","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.check_out',          'Student Check-Out Notification', 'Notify parent when child checks out.',                  'attendance', 'parent', 'student.check_out', '[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"parent_check_out","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.fee_due_tomorrow',   'Fee Reminder (1 day before)',    'Remind parent one day before due date.',                'fees',       'parent', 'fee.due_tomorrow',  '[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"fee_due_tomorrow","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.fee_overdue',        'Fee Overdue Reminder',           'Notify parent when fee is overdue.',                    'fees',       'parent', 'fee.overdue',       '[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"fee_overdue","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.payment_receipt',    'Payment Receipt',                'Send receipt to parent after payment is received.',     'fees',       'parent', 'fee.paid',          '[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"payment_receipt","to":"{{parent.phone}}"}},{"type":"pdf.generate","provider":"mock","params":{"template":"receipt"}}]'::jsonb, true, 100),
  ('parent.birthday',           'Birthday Wishes',                'Send birthday wishes to student.',                      'general',    'parent', 'person.birthday',   '[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"birthday","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.match_report',       'Practice Match Report',          'Send match summary to parent after a practice match.',  'match',      'parent', 'match.finished',    '[{"path":"kind","op":"eq","value":"practice"}]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"practice_match_report","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.tournament_report',  'Tournament Match Report',        'Send tournament match summary to parent.',              'match',      'parent', 'match.finished',    '[{"path":"kind","op":"eq","value":"tournament"}]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"tournament_match_report","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.coach_feedback',     'Coach Feedback',                 'Deliver coach feedback to parent.',                     'match',      'parent', 'coach.feedback_added','[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"coach_feedback","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.monthly_progress',   'Monthly Progress Report',        'Send monthly progress report to parent.',               'reports',    'parent', 'performance.report_generated','[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"monthly_progress","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('owner.daily_summary',       'Daily Academy Summary',          'Daily attendance, revenue and roster summary for owner.','reports',   'owner',  'schedule.daily',    '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"daily_summary"}},{"type":"notification.whatsapp","provider":"mock","params":{"template":"owner_daily_summary","to":"{{owner.phone}}"}}]'::jsonb, true, 100),
  ('owner.weekly_report',       'Weekly Academy Report',          'Weekly performance report for owner.',                  'reports',    'owner',  'schedule.weekly',   '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"weekly_report"}}]'::jsonb, true, 100),
  ('owner.monthly_business',    'Monthly Business Report',        'Monthly business report for owner (P&L, growth).',      'reports',    'owner',  'schedule.monthly',  '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"monthly_business"}}]'::jsonb, true, 100),
  ('owner.revenue_summary',     'Revenue Summary',                'Weekly revenue summary for owner.',                     'reports',    'owner',  'schedule.weekly',   '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"revenue_summary"}}]'::jsonb, true, 100),
  ('owner.attendance_summary',  'Attendance Summary',             'Daily attendance summary for owner.',                   'reports',    'owner',  'schedule.daily',    '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"attendance_summary"}}]'::jsonb, true, 100),
  ('owner.pending_fees',        'Pending Fees Summary',           'Weekly pending fees summary for owner.',                'reports',    'owner',  'schedule.weekly',   '[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"pending_fees"}}]'::jsonb, true, 100),
  ('owner.tournament_summary',  'Tournament Summary',             'Notify owner when a tournament is completed.',          'match',      'owner',  'tournament.finished','[]'::jsonb, '[{"type":"report.generate","provider":"mock","params":{"template":"tournament_summary"}}]'::jsonb, true, 100),
  ('owner.new_lead',            'New Registration Alert',         'Notify owner when a new lead arrives from website.',    'admissions', 'owner',  'website.lead_received','[]'::jsonb, '[{"type":"notification.push","provider":"mock","params":{"template":"new_lead"}}]'::jsonb, true, 100),
  ('owner.tournament_published','Tournament Published',           'Notify owner when a tournament is published.',          'match',      'owner',  'tournament.published','[]'::jsonb, '[{"type":"notification.push","provider":"mock","params":{"template":"tournament_published"}}]'::jsonb, true, 100),
  ('parent.registration_approved','Registration Approved',        'Send confirmation when registration is approved.',      'admissions', 'parent', 'admission.approved','[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"registration_approved","to":"{{parent.phone}}"}}]'::jsonb, true, 100),
  ('parent.campaign_broadcast', 'Campaign Broadcast',             'Deliver a communications campaign to parents.',         'communications','parent','communication.sent','[]'::jsonb, '[{"type":"notification.whatsapp","provider":"mock","params":{"template":"campaign","to":"{{parent.phone}}"}}]'::jsonb, true, 100);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_executions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;