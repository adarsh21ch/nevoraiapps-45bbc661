-- Seed default push notification rules for every existing tenant.
-- Idempotent: only inserts when a rule with the same (tenant_id, name) doesn't already exist.

WITH defs (name, description, event_type, actions) AS (
  VALUES
    (
      'Push: Attendance check-in',
      'Notify parent + owner when a student is marked present',
      'attendance.marked',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}, {"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Student check-out',
      'Notify parent when a student checks out',
      'student.check_out',
      '[{"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Fee generated',
      'Notify parent when a new fee is generated',
      'fee.generated',
      '[{"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Fee due tomorrow',
      'Remind parent one day before fee due date',
      'fee.due_tomorrow',
      '[{"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Fee overdue',
      'Alert parent + owner when a fee becomes overdue',
      'fee.overdue',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}, {"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Payment received',
      'Confirm payment to parent + owner',
      'fee.paid',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}, {"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Tournament published',
      'Notify all parents + owner when a tournament is published',
      'tournament.published',
      '[{"type":"notification.push","params":{"target_roles":["parent","owner"]}}]'::jsonb
    ),
    (
      'Push: Match finished',
      'Notify parent + owner when a match ends',
      'match.finished',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}, {"type":"notification.push","params":{}}]'::jsonb
    ),
    (
      'Push: Match started',
      'Notify owner when a match kicks off',
      'match.started',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    ),
    (
      'Push: New student',
      'Notify owner when a student is added',
      'student.created',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    ),
    (
      'Push: New lead',
      'Notify owner when a new lead is captured',
      'website.lead_received',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    ),
    (
      'Push: Announcement',
      'Broadcast announcements to every parent',
      'communication.sent',
      '[{"type":"notification.push","params":{"target_roles":["parent"]}}]'::jsonb
    ),
    (
      'Push: Daily summary',
      'Send daily academy summary to owner',
      'daily.summary',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    ),
    (
      'Push: Weekly summary',
      'Send weekly summary to owner',
      'weekly.summary',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    ),
    (
      'Push: Monthly summary',
      'Send monthly summary to owner',
      'monthly.summary',
      '[{"type":"notification.push","params":{"target_roles":["owner"]}}]'::jsonb
    )
)
INSERT INTO public.automation_rules
  (tenant_id, name, description, event_type, conditions, actions, enabled, priority)
SELECT
  t.id,
  d.name,
  d.description,
  d.event_type,
  '[]'::jsonb,
  d.actions,
  TRUE,
  100
FROM public.tenants t
CROSS JOIN defs d
WHERE NOT EXISTS (
  SELECT 1 FROM public.automation_rules r
  WHERE r.tenant_id = t.id AND r.name = d.name
);