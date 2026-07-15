# Push Notifications as the Primary Channel

Wire **Expo Push** into the existing Automation Engine + Communication Gateway so every business module reaches users through:

```text
Module → emitAutomationEvent → Engine → Gateway → notification.push → Expo → Device
```

Nothing about the engine, rule storage, retries, history, delivery logs, or provider registry changes shape. We add one new provider, one device table, one PWA shell, two notification-center surfaces (parent + owner), and one admin dashboard.

WhatsApp / SMS / Email stay in place as future / paid channels — the existing gateway already supports them and rules stay channel-agnostic.

---

## Phase 1 — Data + Push Provider (foundation)

**Migration (single file):**

- `push_devices` — `id, tenant_id, user_id, device_id UNIQUE, expo_push_token UNIQUE, platform (ios|android|web), app_version, locale, enabled, last_seen_at, disabled_reason, created_at, updated_at`.
  Grants + RLS: owner reads/writes own rows; service_role full. Trigger for `updated_at`.
- Extend `platform_comm_providers` with a `push` channel row (`adapter_key = 'expo'`, `priority = 0`, `ready = true`).
- Extend `platform_comm_channels` with a `push` row.
- Enum + type widen: add `"push"` to `CommChannel` (client + gateway) and add `notification.push` to `ActionType`.

**Push provider — `src/lib/automation/providers/push/`:**

- `types.ts` — `PushAdapter`, `PushMessage` shape (title, body, subtitle, data, categoryId, priority, sound, badge, threadId, collapseId, ttl).
- `adapters/expo.ts` — real Expo HTTP client (`https://exp.host/--/api/v2/push/send`) with **batch of 100**, chunk retry, ticket-receipts polling helper, `DeviceNotRegistered` detection → auto-disable token.
- `adapters/mock.ts` — logs only (for dev without Expo access key).
- `registry.ts` — `registerPushAdapter` + `DEFAULT_PUSH_ADAPTER = "expo"`.
- `index.ts` — registers the ActionProvider `notification.push` in the engine. `send()` resolves recipients → live tokens from `push_devices` → hands them to the active adapter. Records one `automation_deliveries` row per device with `channel:"push"`, `provider:"push"`, `adapter:"expo"`, `provider_message_id` = Expo ticket id.

**PushService (business-facing façade)** — `src/lib/automation/push-service.ts`:

- `sendToUser(userId, payload, opts)`, `sendToTenant(...)`, `sendToRole('parent'|'owner'|'coach'|'staff', ...)`. All internally emit a `notification.push` action through the gateway; no direct Expo call anywhere else.

---

## Phase 2 — Device Registration + Parent PWA

**Server functions** (`src/lib/notifications/push-devices.functions.ts`):

- `registerPushDevice({ deviceId, token, platform, appVersion, locale })` — upsert (unique on `device_id`), `enabled=true`, refresh `last_seen_at`. If token was previously auto-disabled elsewhere, re-enable.
- `unregisterPushDevice({ deviceId })` — soft-disable on logout.
- `listMyDevices()` — for parent settings screen.
- `pingDevice({ deviceId })` — updates `last_seen_at` on app open.
- Server cron helper `disableStaleDevices()` — > 90 days inactive → `enabled=false`.

**Parent PWA (per bundled `pwa` skill — offline path):**

- `public/manifest.webmanifest`, icons, `theme-color`, `apple-touch-icon` links in `__root.tsx`.
- `vite-plugin-pwa` with `generateSW`, `injectRegister: null`, `devOptions.enabled = false`.
- Guarded registrar (`src/pwa/register.ts`) refusing preview/dev/iframe/`?sw=off`.
- Web-push subscription flow: browser → Expo web push via VAPID (Expo supports web tokens); token stored via `registerPushDevice` with `platform:"web"`.
- One-time onboarding prompt after login on `/parent`, dismissible; never re-nags (localStorage flag).
- Native/webview permission handled by Expo SDK when the parent uses the mobile app.

---

## Phase 3 — Event Wiring (no new emitters)

Every event listed already emits somewhere in the codebase. We only add automation rules + payload adapters, not new emit sites:

| Event | Recipient | Deep link | Title / body template |
| --- | --- | --- | --- |
| `attendance.marked` (check-in) | parent, owner | `/parent/timeline`, `/dashboard/attendance` | 🟢 `{StudentName}` Checked In / "at {Time}. {AcademyName}" |
| `student.check_out` | parent | `/parent/timeline` | 🔴 Checked Out / "at {Time}" |
| `fee.generated` / `fee.due` | parent | `/parent` fees tab | 💰 Fee Due / "{StudentName} ₹{Amount} due {DueDate}" |
| `fee.overdue` | parent + owner | `/parent`, `/dashboard/fees` | 🔴 Fee Overdue |
| `fee.paid` | parent + owner | `/parent` receipt | ✅ Payment Received |
| `student.created` / `.archived` | owner | `/dashboard/students/$id` | 👤 |
| `match.started` / `match.finished` | parent (if child in squad), owner | `/parent/progress`, `/match-center` | 🏏 |
| `tournament.published` | parent, owner | `/match-center/tournaments/$id` | 🏆 |
| `announcement.created` | tenant-wide | `/parent` | 📣 |
| `lead.converted` | owner | `/dashboard/leads` | 🎯 |
| `daily.summary` / `weekly.summary` / `monthly.summary` | owner | `/dashboard` | 📊 (built from existing aggregations, triggered by cron route below) |

Templates land in `src/lib/automation/providers/push/templates.ts` — same shape as WhatsApp templates for consistency.

**Owner summary cron** — extend the existing `src/routes/api/public/hooks/automation-tick.ts` (do NOT create a new hook route) with three new emit paths on a schedule, emitting `daily.summary` / `weekly.summary` / `monthly.summary` events per tenant. The engine picks them up like any other event.

---

## Phase 4 — Notification Centers (parent + owner + realtime)

Reuse existing `notifications` table. Add columns via migration only if missing: `category` (enum-ish text), `priority`, `deep_link`, `subtitle`, `archived_at`. Add index `(tenant_id, user_id, read_at nulls first, created_at desc)`.

- A tiny listener on `notification.push` writes one `notifications` row per recipient at delivery time — this powers the in-app center and lets deep-linking work when the OS notification is missed.
- Parent center: `src/routes/parent.tsx` gets a **Notifications** tab (uses `NotificationCenter.tsx`, already present). Adds filter chips (Unread / Attendance / Fees / Matches / Tournament), swipe-to-archive, tap → route to `deep_link`.
- Owner center: extend `src/routes/dashboard.notifications.tsx` with the same component, filters (Unread / Critical / Automation source).
- Realtime: Supabase realtime channel on `notifications` scoped to `user_id`; subscribe inside `useEffect` (mandatory cleanup). Unread badge in `NotificationBell.tsx` reads a `useQuery({ ... refetchOnWindowFocus })` count and updates on realtime insert.

---

## Phase 5 — Platform Admin + Rules + Validation

**Platform Admin — new "Push" tab** in `src/routes/platform-admin.communication.tsx`:

- Registered devices (count by platform, active in last 24h/7d/30d).
- Delivery stats (last 24h: queued / sending / delivered / failed) from `automation_deliveries` filtered on `channel='push'`.
- Failures table with error grouping (`DeviceNotRegistered`, `MessageRateExceeded`, …).
- Token cleanup — buttons for "Disable stale (>90d)" and "Purge disabled (>180d)".
- Retry queue view (existing) filtered to push.
- Provider health — pings `https://exp.host/--/api/v2/push/send` HEAD to confirm reachability + shows the last successful send timestamp.
- Rate monitoring — sends-per-minute chart.

**Rules UI** — the existing rule editor now treats **Push** as the default channel and shows recipient toggles (parent / owner / coach / staff). WhatsApp/SMS/Email remain selectable but greyed as "requires paid channel".

**Secret**: `EXPO_ACCESS_TOKEN` (optional — Expo works without it; token is only needed for higher rate limits & receipts). Added via `add_secret` as an optional configuration.

**Validation checklist run at end:**

1. `bun run typecheck`
2. `bun run build`
3. Playwright: mark attendance from `/dashboard/attendance` → assert new row in `automation_deliveries` (channel=push, status=delivered/failed) and a `notifications` row for the parent, then log in as parent and see the entry in the notification center with the correct deep-link.
4. Simulate `DeviceNotRegistered` (bad token) → the device auto-disables and doesn't retry indefinitely.
5. Multi-device: two tokens for one parent → both entries in delivery log.
6. PWA: install prompt only shows once (localStorage flag), no SW registration in preview.

---

## Technical Details

- **Files created:** `src/lib/automation/providers/push/{types,registry,index,templates}.ts`, `src/lib/automation/providers/push/adapters/{expo,mock}.ts`, `src/lib/automation/push-service.ts`, `src/lib/notifications/push-devices.functions.ts`, `src/lib/automation/push-admin.functions.ts`, `src/pwa/register.ts`, `public/manifest.webmanifest`, PWA icons.
- **Files edited:** `src/lib/automation/gateway.ts` (add `"push"` to `CommChannel` + action map), `src/lib/automation/types.ts` (add `notification.push` ActionType + summary event names), `src/lib/automation/engine.server.ts` (auto-register push provider), `src/routes/__root.tsx` (manifest links, one-time PWA install prompt after login), `src/routes/parent.tsx` (notifications tab), `src/routes/dashboard.notifications.tsx` (filters + realtime), `src/routes/platform-admin.communication.tsx` (Push tab), `src/routes/api/public/hooks/automation-tick.ts` (owner summary emits), `src/components/notifications/NotificationBell.tsx` (realtime badge), `vite.config.ts` (pwa plugin), `src/start.ts` (unchanged — bearer already attached).
- **Migrations (one file):** create `push_devices` (with grants, RLS, trigger), add push rows to `platform_comm_providers` + `platform_comm_channels`, add missing columns on `notifications` if absent, index `(tenant_id, user_id, read_at, created_at desc)`, `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications` (if not already published).
- **Secrets:** `EXPO_ACCESS_TOKEN` (optional).
- **No architecture is replaced:** business modules keep calling `emitAutomationEvent`; the engine keeps resolving rules; the gateway keeps dispatching; the only new adapter is `expo`.
- **Rollback:** disabling the `push` provider row in `platform_comm_active` reverts everything to the current channel behavior with zero code changes.

---

## Open Questions Before I Start

1. **Expo project setup** — do you already have an Expo project (accessKey / EAS project) whose `EXPO_ACCESS_TOKEN` I should add now, or should I ship with the mock adapter first and add the real token later? Everything else works either way.
2. **Owner summary schedule** — do you want daily / weekly / monthly, or just daily to start? I'll pick daily-only if you don't say.
3. **Web push** — Expo web push requires the parent's device to run inside your Expo React Native app to obtain tokens. For **PWA-only** parents (installed from browser, no native app), do you want me to (a) use the browser's native Web Push API + VAPID via a separate registration path and record the subscription in `push_devices` with `platform='web'`, or (b) restrict push to native devices for now and keep the PWA as the in-app notification center only?

Once you confirm those three, I'll ship Phase 1 first (migration + provider + service) and validate before moving to Phase 2.