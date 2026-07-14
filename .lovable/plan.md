## Phase 03.1 — Notifications & Communication Platform

### Architecture Review & Challenge

**Proposed model:** single append-only `notifications` table + per-channel outbox tables (queued for future workers). Events are published by modules via a single `publish_notification()` SECURITY DEFINER RPC — no module owns delivery logic. Realtime reuses Supabase `postgres_changes` on the `notifications` table filtered by `recipient_user_id` (one channel per signed-in user across the whole app).

**Challenge / simpler alternative considered:**
- *Event log + fan-out worker* (Kafka-style): overkill for current scale, adds a worker dependency. Rejected.
- *Per-module notification tables*: duplicates logic, breaks unified center. Rejected.
- *Direct row inserts from each module*: too easy to drift on shape/RLS. Rejected in favor of one `publish_notification` RPC that stamps type, priority, payload, dedupe key.

**Chosen design (recommended):**
```
notifications              → canonical user-facing row (read/unread/archived)
notification_preferences   → per-user per-type per-channel opt-in (future)
notification_deliveries    → per-channel attempt log (in_app | push | email | whatsapp)
notification_outbox        → queued rows for future push/email/whatsapp workers
```
- `publish_notification(recipient_user_id, tenant_id, type, title, body, deep_link, priority, payload, dedupe_key, expires_at)` is the ONE write path.
- In-app delivery: row insert into `notifications`; realtime pushes to client.
- Other channels: also insert into `notification_outbox` with `channel` + `status='queued'`. Workers (Phase 03.2+) drain it. No provider code yet.
- Role scoping: notifications are recipient-scoped by `user_id` — role is implicit (owner/admin/coach/student/parent all use the same table). Module publishers decide who gets what.

### Database Changes (one migration)

Tables (all with GRANTs + RLS + `updated_at` trigger):
- `public.notifications` — id, recipient_user_id, tenant_id, type, category, title, body, deep_link, priority (`low|normal|high|urgent`), payload jsonb, read_at, archived_at, dedupe_key, expires_at, created_at
- `public.notification_deliveries` — id, notification_id, channel (`in_app|push|email|whatsapp`), status (`queued|sent|delivered|failed|skipped`), attempted_at, error
- `public.notification_outbox` — id, notification_id, channel, status, scheduled_for, attempts, last_error, payload
- `public.notification_preferences` — user_id, type, channel, enabled (default true)

Enums: `notification_priority`, `notification_channel`, `notification_delivery_status`, `notification_type` (open text kept as text for extensibility — enum on category only).

RLS:
- `notifications`: SELECT/UPDATE where `recipient_user_id = auth.uid()`; INSERT blocked (must go through RPC).
- `notification_deliveries` / `outbox`: no client access; service_role only.
- `notification_preferences`: user-owned.

RPCs (SECURITY DEFINER):
- `publish_notification(...)` — validates tenant membership of publisher OR platform admin OR self; upserts on `dedupe_key`; inserts deliveries + outbox rows per enabled channel.
- `mark_notification_read(_id)`, `mark_all_read(_tenant_id?)`, `archive_notification(_id)`.
- `unread_notification_count(_tenant_id?)`.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications`.

**No changes** to Attendance / Billing / Registration / Match Center schemas. Modules call `publish_notification` from existing server functions (Phase 03.2 will wire more; this phase wires a curated first set).

### Files Created

- `src/lib/notifications.ts` — types, `queryOptions`, React Query hooks (`useNotifications`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead`, `useArchive`), realtime subscription hook `useNotificationsRealtime()` (one channel per user).
- `src/lib/notifications.functions.ts` — server fns wrapping the RPCs above (`listNotifications`, `getUnreadCount`, `markRead`, `markAllRead`, `archive`, `publish` — internal helper reused by other server fns).
- `src/lib/notification-publishers.ts` — typed helpers (`notifyAttendance*`, `notifyBilling*`, `notifyMatch*`, `notifyRegistration*`, `notifyCoach*`, `notifySystem*`) that call `publish` server-side only. Wired to existing hooks where trivial.
- `src/components/notifications/NotificationBell.tsx` — bell + unread badge (top nav).
- `src/components/notifications/NotificationCenter.tsx` — sheet/drawer with filter + search + groups (Today / Yesterday / Earlier).
- `src/components/notifications/NotificationCard.tsx` — single card, priority accent, deep-link, mark-read on click, archive swipe.
- `src/routes/notifications.tsx` — full-page center for mobile / power users (reuses components).
- One migration file (via `supabase--migration`).

### Files Edited (minimal, non-frozen surface only)

- `src/components/app-shell/*` (top nav) — inject `<NotificationBell />` for authenticated users. If the shell is frozen, the bell mounts via the existing header slot only.
- `src/routes/__root.tsx` — mount `useNotificationsRealtime()` once inside authenticated context.

**No edits** to frozen module UIs. Publishing is wired in the existing server functions that already own writes (billing invoice issue, registration approval, match finalization, attendance check-in/out) — those files call `notify*` helpers as a side effect only.

### Reuse

- Design system: `Card`, `Sheet`, `Badge`, `Button`, `ScrollArea`, `Tabs`, `Input`, `Separator` — no new primitives.
- Realtime: `useMatchRealtime` pattern (ref-counted single channel) generalized into `notifications-realtime` — one channel per `auth.uid()`.
- React Query cache: single key prefix `["notifications", userId]`; mutations invalidate list + count together.

### Security

- All writes go through SECURITY DEFINER RPCs with membership checks.
- No direct INSERT policy on `notifications`.
- Recipients see only their own rows.
- Outbox / deliveries are service_role only.

### Performance

- Cursor pagination on `created_at desc`; page size 30.
- Composite index `(recipient_user_id, archived_at, created_at desc)` + partial index for unread.
- Single realtime channel per user; badge count derived from cached list + separate lightweight count query invalidated on realtime INSERT.
- `expires_at` filter server-side; cleanup cron (Phase 03.2).

### Out of scope this phase

- Actual push/email/whatsapp providers (only queue rows written).
- Preference UI (schema ready, UI in 03.2).
- Digest / batching.
- Cron cleanup (schema ready).

Approve to proceed with the migration + code.