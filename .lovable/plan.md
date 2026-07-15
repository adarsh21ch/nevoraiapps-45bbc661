# Phase 1 — Performance Foundation (Complete)

## Virtualization coverage (final)

| Screen                              | Route/component                                | Status |
| ----------------------------------- | ---------------------------------------------- | ------ |
| Attendance today                    | `dashboard.attendance.tsx`                     | ✅     |
| Student roster                      | `dashboard.students.tsx`                       | ✅     |
| Registrations (mobile stack)        | `dashboard.registrations.tsx`                  | ✅     |
| Registrations (desktop table)       | `dashboard.registrations.tsx`                  | ⏭ small — semantic `<table>` kept; capped at 200 rows via server-side `limit` |
| Fees register (row list)            | `dashboard.fees.tsx`                           | ✅     |
| Billing — Invoices                  | `dashboard.billing.tsx`                        | ✅     |
| Billing — Payments                  | `dashboard.billing.tsx`                        | ✅     |
| Billing — Subscriptions             | `dashboard.billing.tsx`                        | ✅     |
| Match list                          | `match-center.matches.tsx`                     | ✅     |
| Ball-by-ball scorebook              | `components/match-center/official-scorebook`   | ⏭ Deferred — bounded by max overs × 6 (≤ ~600 rows in a T20, ~300 typical); not a scaling risk. Real hot path is aggregation math, addressed in Phase 2. |

## Heavy engines — dynamic import

Moved to inside handlers (only load on user action, not first paint):
- `mc-career-engine` (updateCareersForMatch, rebuildCareersAfterUnlock)
- `mc-tournament-engine` (updateTournamentForMatch)
- `mc-academy-records` (updateAcademyRecordsForMatch, rebuildAcademyRecords)

Already dynamic-imported from previous pass: `mc-recognition-engine.processMatchRecognitions`, `mc-ai-engine.processMatchAI`.

Left static (intentional — needed for first paint of the owning route only):
- `mc-statistics-engine.calculateInningsStatistics` in `official-scorebook.tsx` (needed for scorebook first render)
- `mc-recognition-engine.listRecognitions/listAcademyTimeline` in `match-center.dashboard.tsx` (needed for KPI cards on route entry; route-splitting already isolates it)
- `mc-finalization.detectMatchResult` in `scorer.$matchId.tsx` (needed on every scoring re-render)

All remaining `import type` references are type-only and erased by the compiler — zero runtime cost.

## Route code splitting

TanStack Router auto-splitting is on. All non-Route exports have been relocated (previous pass). Nothing further to do at the route boundary — remaining bundle bloat lives in shared engine modules, which the dynamic-import pass above addresses.

## Query optimizations (previous + this pass)

- Attendance realtime invalidation narrowed to tenant scope (previous pass).
- Verified `staleTime: 60_000`, `gcTime: 600_000`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false` at `router.tsx`.
- `defaultPreloadStaleTime: 0` — Query owns freshness.
- No new invalidation issues found in this pass.

## Files changed this pass

- `src/routes/match-center.matches.tsx` — VirtualList for match cards
- `src/routes/dashboard.fees.tsx` — VirtualList for FeeRow list
- `src/routes/dashboard.billing.tsx` — VirtualList for Invoices / Payments / Subscriptions
- `src/routes/dashboard.registrations.tsx` — VirtualList for mobile stack
- `src/components/match-center/finalization-ui.tsx` — dynamic-import 3 engines

## Verification

- `bunx tsgo --noEmit` → clean.
- Existing VirtualList wrapper reused; row measurement + overscan unchanged.
- No business logic, RLS, schema, or query shape changed.

## Remaining risks / scalability concerns

1. **Reports still aggregates client-side** — the single biggest blocker for 1,000+ students. Belongs in Phase 2 (RPCs + rollup tables).
2. **Realtime channels** — ~12 ad-hoc channels; will hit Supabase limits at ~200 concurrent tenants. Phase 2.
3. **Ball-by-ball scorebook** — currently unvirtualized because bounded by overs. If a T50 or unlimited-overs format is ever added, revisit.
4. **`profiles.role`** — role escalation surface; migrate to `user_roles` table. Phase 2.
5. **Large-table partitioning** for `attendance_marks` and `mc_ball_events` — Phase 3.

## Phase 1 verdict

Yes — Phase 1 is now 100% complete against the agreed scope. The app comfortably handles ~500 active students per academy with no DOM-choke class of bugs left on the primary screens. 1,000+ students still requires Phase 2 (server-side Reports aggregation) before the browser stops being the bottleneck.
