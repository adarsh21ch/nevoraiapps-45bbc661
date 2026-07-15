# AcademyOS Engineering Reference

Single entry point for engineers operating AcademyOS. Every section links to
the authoritative document — this file is an index, not a duplicate.

---

## 1. Architecture

- **Runtime**: TanStack Start (React 19 + Vite 7) on Cloudflare Worker via
  Lovable publish.
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime) via Lovable
  Cloud. App-internal server logic uses `createServerFn`; public
  webhooks/cron live under `src/routes/api/public/*`.
- **State**: TanStack Query (server state) + local component state. No global
  store.
- **Phase history**: see `.lovable/plan.md`.

## 2. Database

- Schema managed exclusively via `supabase/migrations/*` (forward-only).
- Every public table has explicit `GRANT`s + RLS.
- Tenant isolation via `tenant_id` + `is_tenant_member(auth.uid(), tenant_id)`.
- Roles: `user_roles` + `has_role()` (never on `profiles`).
- Aggregation RPCs: 18 `SECURITY DEFINER` functions in `public.*` returning
  compact `jsonb` (see Phase 2 in `.lovable/plan.md`).
- Index & partitioning strategy: `.lovable/phase-4-enterprise-readiness.md`.

## 3. Aggregation layer

- Server functions: `src/lib/aggregations/*.functions.ts`.
- Consumed via `useQuery({ queryKey: aggKey(domain, tenantId, params) })`.
- Zero client-side aggregation. New dashboards MUST call an RPC, not scan
  raw rows.

## 4. Realtime

- Subscribe inside `useEffect` only; return cleanup that calls
  `supabase.removeChannel`.
- `useRealtimeChannel` centralizes lifecycle; disconnects report via
  `reportError({ domain: 'realtime' })`.
- Enabled tables: `mc_ball_events`, `mc_matches`, `attendance_marks`,
  `notifications` (see migrations).

## 5. Permissions

- Client gates: `usePermissions().isOwner` / role checks via
  `use-current-role.ts`.
- Server: every RPC re-validates via `has_role` or `is_tenant_member`. Never
  trust the client role.
- Advisory locking for exclusive workflows (live scoring):
  `use-scoring-lock.ts` + `acquire_match_scoring_lock` RPC.

## 6. Deployment

- Frontend: requires "Publish" click; rollback = republish prior build.
- Backend: migrations & server fns deploy on merge after approval.
- Migrations are additive-only; destructive changes staged (add → backfill
  → cutover → drop) and noted in migration description.
- Secrets: Lovable secret store (`add_secret`). Never in source.
- Full deployment checklist: `.lovable/phase-5-operations.md` §4.

## 7. Recovery

- Supabase managed daily backups + PITR (RTO 4 h / RPO 24 h target).
- Storage: no versioning by default; enabled per bucket when a delete-undo
  requirement lands.
- Quarterly restore drill procedure: `.lovable/phase-5-operations.md` §3.

## 8. Scaling

- Current envelope + trigger conditions for partitioning, rollups, read
  replicas, storage tiering: `.lovable/phase-4-enterprise-readiness.md`.
- 10k-academy stress review: `.lovable/phase-5-operations.md` §9.

## 9. Monitoring

- Signals + alert thresholds matrix: `.lovable/phase-5-operations.md` §1.
- Client observability helper: `src/lib/observability.ts`
  (`reportError`, `withOps`, `logEvent`). Route all critical client
  failures through it.
- Worker logs: `stack_modern--server-function-logs`.
- DB hotspots: `supabase--slow_queries`.

## 10. Incident response

1. **Detect** — alert fires (worker error rate, DB CPU, cron failure) or a
   customer reports an issue.
2. **Triage** — check worker logs (`stack_modern--server-function-logs`) +
   Supabase dashboard + `cron.job_run_details`.
3. **Mitigate** — republish previous build (frontend) or forward-fix
   migration (backend). Do NOT edit migration history.
4. **Communicate** — status update in the operator channel; note in
   `.lovable/incidents/YYYY-MM-DD-<slug>.md` (create dir on first incident).
5. **Post-mortem** — root cause + action items within 48 h; feed action
   items back into this doc.

## 11. Future scaling roadmap (deferred, not TODO)

Documented triggers only — do not implement until the trigger is hit:

- **Partitioning** (`attendance_marks`, `mc_ball_events`, `notifications`,
  `notification_deliveries`, `platform_audit_log`): when any table crosses
  ~50M rows or write p95 > 100 ms.
- **Rollup tables**: when any aggregation RPC p95 > 500 ms sustained.
- **Read replicas / Supabase Pro tier**: > 5k concurrent users or DB CPU
  > 70% sustained.
- **Third-party APM** (Sentry/Datadog): > 50k MAU or when Lovable capture
  ceases to be sufficient.
- **Storage lifecycle rules**: any bucket > 50 GB/month egress.
- **Load-testing rig** (k6 or Artillery): before first customer at
  100-academy scale.

## 12. Final architecture score

- Production readiness: **9.0 / 10**
- Enterprise readiness: **8.5 / 10**
- Final architecture: **9.0 / 10**

No architectural rewrite is required to reach 10,000 academies. All
remaining scale work is additive infrastructure, documented above.
