# Phase 03.0 — Match Center Polish & Integration

## Architecture Review (challenges before coding)

The Match Center is already mature: 27 routes, 23 `mc-*` library modules (Ball, Stats, Rules, Career, Finalization, Recognition, Tournament engines all present), and a rich `match-center.dashboard` page. Rebuilding is unnecessary. What is missing is **integration across shells** and **shared, cached primitives**.

Concrete gaps found:

1. **No shared "match feeds" module.** Owner Dashboard, Student App, Parent Portal each fetch matches differently, so cache keys and RLS-safe scopes diverge. Result: duplicate queries and inconsistent shapes.
2. **`match-center.dashboard.tsx` is the only place matches surface in a dashboard shell.** The Owner Dashboard (`/dashboard`), Admin panels, `/student`, and `/parent` don't yet show live/upcoming/recent match cards.
3. **Realtime is duplicated.** `mobile-scorer.tsx`, `live-scorecard.tsx`, and `match.$slug.tsx` each open their own `mc_ball_events` channel. Should route through one hook.
4. **Match Center home is a redirect to `/live`.** Spec asks for a proper home surface — but `match-center.dashboard.tsx` already implements it. Fix by pointing the index redirect at `/dashboard` (or renaming) instead of building a third home.
5. **Player Profile timeline events**: Career & Recognition engines already write `mc_athlete_timeline` on finalization. Verify wiring exists; add missing event types (Debut, Milestone) via a small append-only helper — do NOT modify the Finalization engine.
6. **Insights**: `mc-performance-analytics.ts` already computes highest partnership, top scorer, best bowling, etc. Expose as reusable `useMatchInsights(...)` hooks; don't rewrite math.
7. **Search & filters**: `match-center.matches.tsx` has filtering — extend with URL search params (`validateSearch` + `zodValidator`) so links/back-button work.

## What will be built

### 1. Shared match feeds (`src/lib/match-feeds.ts`) — NEW
One small module exporting typed React Query hooks reused everywhere:
- `useLiveMatches(tenantId)` — status = 'live'
- `useUpcomingMatches(tenantId, limit)` — status = 'scheduled', future
- `useRecentMatches(tenantId, limit)` — status = 'completed', last N
- `useTodaysMatches(tenantId)`
- `useMatchesForStudent(studentId)` — squads join → my matches
- `useMatchesForParentChild(studentId)` — same, RLS-scoped
- `useTopPerformerToday(tenantId)` — thin wrapper over existing analytics

All hooks reuse existing loaders in `mc-matches.ts`, `mc-athletes.ts`, `mc-performance-analytics.ts`. Cache keys share prefixes (`["mc","matches",tenantId,…]`) so a single fetch warms every shell.

### 2. Shared realtime hook (`src/lib/mc-realtime.ts`) — NEW
- `useMatchRealtime(matchId)` — one Supabase channel per match, ref-counted across mounts; invalidates the shared match queries.
- `useTenantMatchesRealtime(tenantId)` — one channel for status/score changes on the tenant's matches, invalidates feed queries.

Refactor `live-scorecard.tsx`, `match.$slug.tsx`, `mobile-scorer.tsx` to consume the hook instead of opening channels themselves. Scoring engine files untouched.

### 3. Cross-shell match widgets (`src/components/match-center/widgets/`) — NEW, tiny presentational
- `LiveMatchCard`, `UpcomingMatchCard`, `RecentResultCard`, `TopPerformerCard`, `MyNextMatchCard`, `MyRecentPerformanceCard`.
- Reuse existing `StatusChip`, `DashboardCard`, `SectionTitle` from `components/match-center/ui.tsx`. No new design tokens.

### 4. Dashboard integration (no redesign of frozen shells)
- `src/routes/dashboard.index.tsx` — inject a **"Cricket today"** section: `LiveMatchCard` + `TopPerformerCard` + `RecentResultCard` list. Only added if the tenant has matches; otherwise section hides.
- `src/routes/student.index.tsx` — inject `MyNextMatchCard` + `MyRecentPerformanceCard` below existing motivational content.
- `src/routes/parent.index.tsx` — inject the same two cards scoped by `is_my_child`.
- All additions are additive; no reordering or replacement.

### 5. Match Center home polish
- Change `match-center.index.tsx` redirect target from `/match-center/live` to `/match-center/dashboard` so the polished home is the default.
- Add a **Recent Highlights** strip to `match-center.dashboard.tsx` (reuses `mc_athlete_timeline` from existing recognition engine).

### 6. Match list — URL-driven search & filters
- Convert `match-center.matches.tsx` filter state to `validateSearch` (zod) with `q`, `status`, `format`, `tournament`, `venue`, `player`, `dateFrom`, `dateTo`.
- Read via `Route.useSearch()`, mutate via `navigate({ search: prev => ... })`. Fully shareable/back-button-safe URLs.

### 7. Insights primitives (`src/lib/mc-insights.ts`) — NEW thin wrapper
- Re-exports `computeHighestPartnership`, `computeTopScorer`, `computeTopWicketTaker`, `computeBestBowling`, `computeFastestFifty`, `computeLongestWinStreak` — all delegating to the existing statistics engine. No new math; no AI.

### 8. Timeline completeness
- Verify Career engine writes: `scored_50`, `scored_100`, `four_wickets`, `player_of_match`, `debut`, `tournament_win`.
- Add ONLY the missing event helpers to `mc-recognition-engine.ts` via non-breaking exports (append-only, called from existing finalization; no engine rewrite).

## Data & security

- No schema changes required.
- All new hooks respect existing RLS: match reads via `mc_matches` (tenant scoped), student-scoped reads via `is_my_student` / `is_my_child` helpers already installed.
- No new tables, policies, or grants.

## Performance

- Single React Query cache; feed hooks share keys with existing list pages so opening any shell warms subsequent pages.
- One realtime channel per (tenant | match) via ref-counted subscribe.
- Long match lists get windowed rendering via `@tanstack/react-virtual` in `match-center.matches.tsx` only (already installed? — verify; add if missing).

## Files changed

Created:
- `src/lib/match-feeds.ts`
- `src/lib/mc-realtime.ts`
- `src/lib/mc-insights.ts`
- `src/components/match-center/widgets/*.tsx` (~6 cards)

Edited:
- `src/routes/match-center.index.tsx` (redirect target)
- `src/routes/match-center.dashboard.tsx` (recent highlights)
- `src/routes/match-center.matches.tsx` (URL search params + virtual list)
- `src/routes/dashboard.index.tsx` (cricket today section)
- `src/routes/student.index.tsx` (match cards)
- `src/routes/parent.index.tsx` (match cards)
- `src/components/match-center/live-scorecard.tsx`, `mobile-scorer.tsx`, `src/routes/match.$slug.tsx` (swap realtime to shared hook)

Not touched: Ball, Statistics, Rules, Career, Finalization, Recognition, Tournament engines; Attendance; Billing; Registration; Design System; Player Operating System; Academy Workspace; frozen route shells.

## Deliverables after implementation

1. Architecture review (this section, refined)
2. Database changes → **none**
3. Files changed
4. Components created
5. Components reused
6. Performance improvements (query dedup, channel dedup, virtualized list)
7. Security review (RLS unchanged)
8. UX improvements (shareable filter URLs, cross-shell match presence, one home)
9. Production readiness score
10. Top 10 recommendations
11. Phase 03.1 suggestions (Notifications & Communication reusing widgets)

Approve to proceed.
