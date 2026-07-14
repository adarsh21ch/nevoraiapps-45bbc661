# Phase 03.4 — Communication & Broadcast OS

## Architecture (reuse-first)

The notification platform already handles per-user delivery, channel fan-out, dedupe, prefs, and realtime. This phase adds a **campaign layer** on top — it does NOT re-implement delivery.

```
Campaign  ──►  audience resolver  ──►  publish_notification (per recipient, per channel)
   │                                            │
   │                                            ▼
   └─ template + variables            notifications + notification_outbox + notification_deliveries
```

Campaigns are the "source" record. Deliveries are the existing tables. Every campaign row links to N notifications via a new `campaign_id` column on `notifications` — one join, full delivery analytics for free.

## Database Changes (1 migration)

New tables (all tenant-scoped, RLS on):

- `comm_templates` — `id, tenant_id, name, category (notification_category), title_template, body_template, default_channels, variables_used jsonb, created_by, created_at, updated_at`
- `comm_campaigns` — `id, tenant_id, name, template_id (null=ad-hoc), category, title, body, deep_link, priority, channels[], audience jsonb ({kind, batch_ids, student_ids, parent_ids, admin_ids, lead_stages}), status (draft|scheduled|sending|sent|failed|cancelled), scheduled_for, sent_at, recipient_count, delivered_count, failed_count, is_recurring, recurrence_rule text, created_by, created_at, updated_at`
- `comm_campaign_recipients` — audit rows: `campaign_id, recipient_user_id, notification_id, resolved_at` (append-only)

Column add:
- `notifications.campaign_id uuid null` + index. Backfill NULL. Existing publishers unaffected.

RPCs (SECURITY DEFINER, tenant-member gated):
- `send_campaign(_campaign_id)` — resolves audience via SQL joins over `profiles`, `mc_parent_links`, `students`, `batches`, `leads`; renders `{{vars}}` per recipient; loops `publish_notification` with `_channels`, tags with `campaign_id`; updates counts + status. Owner-only if `category='billing'`.
- `schedule_campaign(_campaign_id, _when)` — status→scheduled, scheduled_for=_when. Cron picks up.
- `cancel_campaign(_campaign_id)` — draft/scheduled only.
- `render_template(_template_id, _vars jsonb)` — preview.

Scheduler: extend existing cron (or add `/api/public/hooks/dispatch-campaigns`) that selects `scheduled` campaigns where `scheduled_for<=now()` and calls `send_campaign`.

Grants + RLS: tenant_id-scoped SELECT/INSERT/UPDATE for `authenticated`; billing campaigns gated by `is_tenant_owner` in RPC.

## Files Changed

**New:**
- `src/lib/communications.ts` — types, queries, mutations (React Query), audience helpers, variable list
- `src/routes/dashboard.communications.tsx` — hub with tabs: Announcements / Broadcasts / Scheduled / Templates / History
- `src/components/dashboard/comms/CampaignComposer.tsx` — one modal: audience picker + channel toggles + template select + variable preview + schedule/send
- `src/components/dashboard/comms/TemplateEditor.tsx`
- `src/components/dashboard/comms/CampaignCard.tsx` — timeline card w/ delivery bars
- `src/components/dashboard/comms/AudiencePicker.tsx` — batch/student/parent/admin/lead-stage selects (reuses existing queries)
- `src/components/dashboard/comms/DeliveryStats.tsx` — reads `notification_deliveries` grouped by campaign
- `src/routes/api/public/hooks/dispatch-campaigns.ts` — cron target
- Migration file

**Extended:**
- `src/lib/nav-config.ts` — add "Communications" for owner+admin
- `src/routes/dashboard.tsx` — global search: templates + campaigns
- `src/lib/notification-publishers.functions.ts` — accept optional `campaign_id`

**Reused as-is:** `publish_notification` RPC, `notifications`/`outbox`/`deliveries`/`preferences` tables, `NotificationBell`, `useNotifications*`, dashboard-context, `<OwnerOnly>`, `PersonAvatar`, DS Card/Button/Badge/Drawer/Tabs, `use-toast`, admissions timeline pattern.

## Permissions

- Admin: all categories except `billing`. RPC rejects; UI hides Fee Reminder type.
- Owner: everything.
- Enforced in RPC + client-side `<OwnerOnly>` on billing-category composer.

## Automation

No new triggers. Existing publishers (attendance, billing, registration, match finalization, admissions timeline) keep calling `publish_notification` directly. Communication Hub is for **human-initiated** campaigns; automations remain module-owned.

## Out of scope (defer)

- Real WhatsApp/SMS/Email dispatch workers (outbox rows already queue; a worker plugs in later without schema change)
- Open/click tracking
- Recurring cron beyond simple daily/weekly (store `recurrence_rule`, but generator runs a v0 daily/weekly parser only)
- Rich text editor (plain text + variable chips in v1)

## Deliverables after build

Architecture / DB / Files / Components created + reused / Security / Performance / UX / Readiness score / Top 10 recs / Updated completion % / Remaining phases.

**Ready to implement — reply with any adjustment or leave empty to proceed.**
