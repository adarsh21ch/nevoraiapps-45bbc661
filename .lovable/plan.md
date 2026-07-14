# Phase 03.6 — Platform Admin Operating System

Only **extend** the existing `/platform-admin` surface (Overview, Tenants list & detail, Subscriptions, Onboard, Settings). Every new capability reuses `tenants`, `platform_admins`, `platform_settings`, `pqk`, `fetchTenants`, and the existing dark `PlatformShell`. No academy-side redesign.

## What already exists (kept as-is)
- `platform-admin.index.tsx` — MRR, tenant list, collection bar
- `platform-admin.tenants.index.tsx` — filtered tenant grid
- `platform-admin.tenants.$id.tsx` — branding, features, domain, price
- `platform-admin.subscriptions.tsx` — mark-paid workflow
- `platform-admin.new.tsx`, `platform-admin.settings.tsx`
- `PlatformShell`, `PlatformProvider`, `isPlatformAdmin`, `pqk`

## Database (one migration)

```
-- 1. platform-scoped audit log
CREATE TABLE public.platform_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid NOT NULL,                       -- platform admin
  tenant_id    uuid,                                -- affected tenant (nullable)
  target_type  text NOT NULL,                       -- 'tenant' | 'subscription' | 'impersonation' | 'flag' | 'support_note'
  target_id    text,
  action       text NOT NULL,                       -- 'update' | 'suspend' | 'activate' | 'archive' | 'impersonate_start' | 'impersonate_end' | 'flag_toggle' | 'note_add'
  before_state jsonb,
  after_state  jsonb,
  ip           text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.platform_audit_log TO authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can read audit log"
  ON public.platform_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can write audit log"
  ON public.platform_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND actor_id = auth.uid());

-- 2. platform-scoped support notes (internal, per-tenant)
CREATE TABLE public.platform_support_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL,
  body       text NOT NULL,
  priority   text NOT NULL DEFAULT 'normal',        -- 'low' | 'normal' | 'high' | 'urgent'
  status     text NOT NULL DEFAULT 'open',          -- 'open' | 'resolved'
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_support_notes TO authenticated;
GRANT ALL ON public.platform_support_notes TO service_role;
ALTER TABLE public.platform_support_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage support notes"
  ON public.platform_support_notes FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3. Two RPCs (SECURITY DEFINER, gated by is_platform_admin)
--    log_platform_action(_tenant_id, _target_type, _target_id, _action, _before, _after)
--    set_tenant_feature(_tenant_id uuid, _key text, _enabled boolean)  -- merges into tenants.features JSONB, writes audit
```

No new tables for subscription tiers, flags, or usage — all derived from `tenants.features` and existing tables.

## New files (extensions only)

| Path | Purpose |
| --- | --- |
| `src/lib/platform-audit.ts` | `logPlatformAction`, `fetchAuditLog`, `useAudit` |
| `src/lib/platform-analytics.ts` | Global KPI query fanning across `students`, `profiles`, `payments`, `notifications`, `comm_campaigns` (owner already trusts `is_platform_admin`) |
| `src/lib/platform-impersonation.ts` | Client-side impersonation session helpers (see Security) |
| `src/lib/platform-support.ts` | CRUD on `platform_support_notes` |
| `src/routes/platform-admin.health.tsx` | System health tiles (DB latency probe, realtime ping, storage bucket count, error rate) |
| `src/routes/platform-admin.audit.tsx` | Audit log viewer with filters (actor / tenant / action) |
| `src/routes/platform-admin.search.tsx` | Global search (academies, owners, students, domains, subscriptions) — reuses existing queries |
| `src/routes/platform-admin.flags.tsx` | Feature-flag matrix across all tenants (`features` column) |
| `src/routes/platform-admin.usage.tsx` | Per-tenant usage: students, admins, notifications sent, comms delivered, storage counts |
| `src/components/platform/ImpersonationBanner.tsx` | Sticky banner shown across whole app while impersonating |
| `src/components/platform/AuditFeed.tsx` | Reusable audit list (used on tenant detail + audit page) |

### Extended files

- `PlatformShell.tsx` — new nav entries: Overview / Tenants / Subscriptions / Flags / Usage / Health / Audit / Support / Onboard / Settings
- `platform-admin.index.tsx` — swap current KPI grid for **8 executive tiles** (Total / Active / Trial / Suspended academies · MRR · Total students · Total admins · Comms sent · Latest signups)
- `platform-admin.tenants.$id.tsx` — add sidebar: **Audit for this tenant**, **Support notes**, **Impersonate**, **Suspend / Activate / Archive** action row
- `__root.tsx` — mount `<ImpersonationBanner />` globally

## Secure impersonation (no server session forgery)

Impersonation must NOT mint a Supabase session for another user (Supabase JS has no admin-issue-session endpoint from the browser, and the service role must never touch the client). Instead:

1. Admin clicks **Impersonate** → confirmation dialog (typed academy name).
2. `logPlatformAction('impersonate_start', tenant_id, { reason })` writes a row before switching context.
3. Client sets `sessionStorage['platform.impersonation']` = `{ tenant_id, tenant_name, started_at, actor_id }`.
4. `dashboard-context.tsx` is extended so, when the current user IS a platform admin AND that key is present, `tenant` is loaded from the impersonated tenant instead of the admin's own profile row. All writes remain gated by RLS (platform admin already passes `is_platform_admin(auth.uid())` or tenant-member policies — verified per table).
5. `<ImpersonationBanner />` is always rendered at the very top of `<body>` (`__root.tsx`) with red border + "Stop impersonation" button. Session-storage-only → tab close ends impersonation; audit row logged on explicit stop as well.
6. Impersonated writes carry `actor_id = auth.uid()` (still the admin) — no identity spoofing.

This is a read-first "view-as" that reuses the admin's own JWT. It never bypasses audit and never survives a browser close.

## Global KPIs (derived, no new tables)

Reuse `fetchTenants` + one platform aggregate:

```
SELECT
  (SELECT count(*) FROM students WHERE archived_at IS NULL)          AS total_students,
  (SELECT count(*) FROM profiles WHERE role IN ('owner','admin'))    AS total_admins,
  (SELECT count(*) FROM mc_parent_links)                             AS total_parents,
  (SELECT count(*) FROM comm_campaigns WHERE status = 'sent')        AS campaigns_sent,
  (SELECT count(*) FROM notifications WHERE created_at > now() - interval '30 days') AS recent_notifs
```

Exposed as `get_platform_stats()` RPC (SECURITY DEFINER, `is_platform_admin` gate) — one round trip, no client-side fan-out over all tenants.

## System health

- DB latency: timed `select 1`
- Realtime: `supabase.channel('ping').subscribe()` round-trip
- Storage: `list buckets` count via server fn using `supabaseAdmin`
- Errors: last 24h `platform_audit_log` rows with `action LIKE 'error_%'` (reserved for future publishers)

Simple green/amber/red tile grid.

## Permissions & security

- Every new route/RPC gated by `is_platform_admin(auth.uid())`.
- `platform_audit_log` cannot be updated or deleted (no policies for UPDATE/DELETE).
- Impersonation banner cannot be dismissed without calling `stopImpersonation()` which writes `impersonate_end`.
- No service-role key ever ships to the browser.

## UX

- Keep the existing dark executive theme (`bg-neutral-950`, white text, gradient icon tiles).
- 8-tile KPI grid at top of Overview, dense.
- New nav shown in the order above; icons: `Sparkles` (Flags), `BarChart3` (Usage), `Activity` (Health), `ScrollText` (Audit), `LifeBuoy` (Support).

## Out of scope for this phase

- Real per-request rate limits / bandwidth metering (needs infra outside DB)
- Per-tenant per-plan subscription tiers UI beyond price + status (already covered by `monthly_price` + `subscription_status`)
- Support ticketing conversation threads (notes only; ticket threading = Phase 03.7)
- Cross-project storage metering (would require a scheduled job — surfaced as "coming soon")

## Deliverables after implementation

1. Architecture review · 2. DB changes · 3. Files changed · 4. Components created · 5. Components reused · 6. Security review · 7. Performance review · 8. UX improvements · 9. Production readiness · 10. Top 10 recommendations · 11. Updated AcademyOS completion % · 12. Remaining work before V1 launch · plus the requested audit of duplicate/dead code and merge opportunities across the whole codebase.
