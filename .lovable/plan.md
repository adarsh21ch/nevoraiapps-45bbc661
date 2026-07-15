# Phase 1 — Performance Foundation

## Reality check before we start

I inspected the codebase before writing this plan. Two of the three requested items are **already in place**, so the honest scope is smaller than the brief implies. I don't want to fake work.

### 1. Route-level code splitting — **already enabled**
- TanStack Router's `autoCodeSplitting` is on by default (Vite plugin).
- Across all 109 route files, only **3** non-Route exports exist (`platform-admin.index.tsx` StatusChip/SubChip, `parent.tsx` useParentChild) — everything else is already being split into per-route chunks automatically.
- What the brief actually needs is **not** wrapping routes in `lazy()`, but ensuring heavy shared libraries (`mc-statistics-engine` 1050 lines, `mc-career-engine` 627, `mc-recognition-engine` 851, `mc-tournament-engine` 550, `mc-academy-records` 1373, `mc-ai-engine` 753, `mc-finalization` 586) don't get pulled into unrelated chunks via static imports.

### 3. React Query optimization — **defaults are already good**
`src/router.tsx` currently has:
```
staleTime: 60_000, gcTime: 600_000,
refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 1
defaultPreloadStaleTime: 0
```
That's already near-optimal. The real gap is **over-broad invalidation** — 15+ sites call `invalidateQueries` with root-level keys.

### 2. Virtualization — **genuinely missing**
Zero installations of `react-window` / `@tanstack/react-virtual`. This is the one big win.

---

## Scope of this phase

### A. Virtualization
Install `@tanstack/react-virtual` and virtualize the six lists that break at 500+ rows:
1. `dashboard.attendance.tsx` — attendance-today list (mark present/absent)
2. `dashboard.students.tsx` — full student list with search/filter
3. `dashboard.registrations.tsx` — pending registrations
4. `dashboard.billing.tsx` — invoices/payments table
5. `match-center.scorebook.$matchId.tsx` — ball-by-ball feed
6. `match-center.matches.tsx` — historical matches

Constraints preserved: search, filters, selection, bulk actions, realtime.

Build a small reusable `VirtualList` wrapper so we don't repeat overscan / measurement logic six times.

### B. Heavy engine dynamic imports
Convert static imports of the 7 heavy `mc-*-engine` files to dynamic imports inside handler / effect bodies (not at module scope), so a route only pays the parse cost when its user actually opens live scoring / finalization / stats. Files touched:
- `match-center.dashboard.tsx`, `match-center.records.tsx`, `match-center.ai-insights.tsx`, `match-center.recognition.tsx`, `match-center.players.$athleteId.tsx`, `match-center.tournaments.$tournamentId.tsx`, `match.$slug.tsx`, `scorer.$matchId.tsx`
- `components/match-center/{official-scorebook, mobile-scorer, live-scorecard, over-history-sheet, scorecard-detail-sheets, finalization-ui}.tsx`

Where an engine result is needed for first paint, keep the import static — dynamic-import only computation triggered by user action (finalize match, generate report, compute stats on demand).

### C. Query invalidation tightening
Audit the 15 highest-invalidation files. Replace root-level `invalidateQueries({queryKey: ['x']})` with specific keys when the mutation only touches one record. Highest priority:
- `dashboard.registrations.tsx` (6 invalidations)
- `communications.ts` (6)
- `match-center.players.$athleteId.tsx` (11)
- `platform-admin.tenants.$id.tsx` (10)
- `attendance/queries.ts`, `notifications.ts` (realtime invalidations — narrow to affected row)

Also add per-query `staleTime` overrides for expensive report/aggregation queries (`reports.ts` keys) so date-range changes don't refetch untouched aggregates.

### D. Remove the 3 non-Route exports
Move `StatusChip`/`SubChip` out of `platform-admin.index.tsx` into a sibling `-status-chips.tsx` component; move `useParentChild` out of `parent.tsx` into `src/hooks/use-parent-child.ts`. Restores auto-splitting for those routes.

---

## Deliverables

1. New `src/components/ds/VirtualList.tsx` reusable wrapper.
2. 6 route files updated to use it (attendance, students, registrations, billing, scorebook, matches).
3. 14 files converted to dynamic-import heavy engines.
4. ~15 invalidation call sites tightened.
5. 3 non-Route exports relocated.
6. Engineering report with:
   - Bundle-size before/after per chunk (via `vite build --mode development` output).
   - Which lists were virtualized and their row-count safe ceiling.
   - Query invalidations tightened, before/after key.
   - Honest verdict on whether we can now handle 1,000 students/academy.

---

## Not in this phase (spelled out so we agree)

- Server-side aggregation for Reports (still runs in browser) — **Priority 2, next phase**. Without this, reports will still OOM at 6+ months of data on a 1,000-student academy.
- Table partitioning, materialized views, rollup tables.
- Realtime consolidation (still 12+ ad-hoc channels).
- Roles migration off `profiles.role`.
- Service worker / offline attendance.

If you want the Reports server-side push in this phase too, say so — it's another day of work but it's the single biggest remaining scaling risk after virtualization.

---

## Risk and rollback

- Virtualization changes DOM structure inside scroll containers — sticky headers, drag-to-reorder, and any `getBoundingClientRect` measurement can regress. I'll spot-check each of the 6 lists visually via Playwright after the change.
- Dynamic-import conversion can regress SSR if an engine is (accidentally) needed in a loader. All 7 engines are pure-JS with no server-fn callers — safe.
- Query invalidation tightening is the highest-risk item for silent bugs (a mutation that no longer refreshes a related view). I'll flag every widened→narrowed key in the report so you can eyeball them.

## Honest verdict up-front

Even after Phase 1, **the app will not comfortably handle 1,000 students** yet, because Reports still aggregates client-side. Phase 1 gets you to ~500 students smoothly and removes the DOM-choke class of bugs. Phase 2 (server-side reports + rollups) is what unlocks 1,000+.

Approve this scope and I'll execute; or tell me to include the Reports server push and I'll expand the plan.
