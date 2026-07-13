## Goal

A **Demo Mode** toggle inside Match Center → Settings that overlays realistic sample data across every module. Real academy data is never written to or modified. When OFF, only real data is visible.

## Approach — client-side overlay (no DB writes)

Writing 150 players, 80 matches, ball events, careers, recognitions etc. into Supabase would (a) mix with real data, (b) require RLS/tenant-safe seeding, (c) break the "never touch real data" rule the moment a scorer edits the live demo match. Instead:

- Demo data lives in a deterministic **in-memory fixture module** (`src/lib/mc-demo/*`), generated once with a seeded PRNG and cached in `localStorage` (per-tenant key).
- A **`useDemoMode()` hook** reads a per-tenant flag from `localStorage` (`mc:demo:<tenantId>` = `on|off`, default `off`).
- Read paths (list pages, dashboards, profiles, website, parent portal, scorebook, performance) are wrapped by small **`withDemo()` selectors** that, when demo is ON, return `[...realData, ...demoData]` (or purely demo if the academy is empty). Real DB queries are unchanged.
- Write paths (create/update/delete, scorer ball events) short-circuit for demo IDs: mutations against a demo entity update the in-memory fixture and re-render, never hitting Supabase. All demo IDs are prefixed `demo-` so this is a cheap check.

This satisfies "reuse existing engines" — the Statistics Engine, Ball Event aggregator, Performance Analytics, Scorebook, Career calculator all run on the demo fixture the exact same way they run on real data.

## Fixture generator

`src/lib/mc-demo/generate.ts` — pure function, seeded by `tenantId`:

- 150 players (names, roles, DOB, photo URLs from a curated placeholder set, `player_id = DEMO001…`)
- 10 teams (Junior, Senior, Girls, U13/15/17/19, Practice, Tournament, Representative)
- 5 tournaments (Summer Cup, Winter Cup, Practice League, District League, State Qualifier) with fixtures + standings
- 80 completed matches — each with innings, ball events, POM, scorebook-ready data
- 3 upcoming matches
- **1 live match** — Sky Cricket Academy U16 vs Royal, 126/4 after 10.5 overs; ball events populated up to that point, `status = 'live'`
- Career rows derived by running the existing `calculateInningsStatistics` over demo ball events
- Academy records, recognitions, hall of fame, AI reports (canned but realistic text tied to actual stats), parent links

Cached in `localStorage` under `mc:demo:data:<tenantId>` (JSON, ~1–2 MB). Regenerated only on **Reset Demo Data** or version bump.

## UI touch points

1. **Settings → Demo Data card** (`src/routes/match-center.settings.tsx` or the settings surface used today) — toggle + "Reset Demo Data" button.
2. **Global demo badge** — `🟡 Demo Data` pill in `MatchCenterLayout` top bar when demo is ON.
3. **Read overlays** — thin wrappers in ~15 route/component files (matches list, teams, players, tournaments, dashboard, website public bundle preview, parent portal, performance center, scorebook, recognition, records, hall of fame). Each is a 3-5 line change: `const data = useDemoOverlay(realData, demoSlice)`.
4. **Scorer** — when `matchId.startsWith('demo-')`, ball-event writes go to the demo store; realtime subscriptions are replaced by a local event emitter. Score, scorebook, career, records, website, parent portal, performance all recompute because they read from the same fixture.

## Files

**Created**
- `src/lib/mc-demo/rng.ts` — seeded PRNG
- `src/lib/mc-demo/names.ts` — name/photo pools
- `src/lib/mc-demo/generate.ts` — fixture generator (players/teams/tournaments/matches/careers/etc.)
- `src/lib/mc-demo/store.ts` — localStorage-backed store, `useDemoMode`, `useDemoData`, `resetDemoData`, `isDemoId`
- `src/lib/mc-demo/overlay.ts` — `withDemo(list, demoList)` + per-entity selectors
- `src/lib/mc-demo/scorer.ts` — in-memory ball-event handler for `demo-*` matches
- `src/components/match-center/demo-badge.tsx`
- `src/components/match-center/demo-settings-card.tsx`

**Modified** (small, presentation-only)
- `src/components/match-center/MatchCenterLayout.tsx` — mount demo badge
- Settings route — mount `DemoSettingsCard`
- Matches / teams / players / tournaments / dashboard / performance / scorebook / website preview / parent portal routes — wrap reads with overlay
- Scorer route — branch on `isDemoId(matchId)` before Supabase writes

## Non-goals

- No DB migrations, no RLS changes, no engine edits, no new statistics, no new APIs.
- No demo data for platform-admin surfaces (out of scope).
- No server-side demo mode (per-tenant admin toggle is client-local; that is sufficient for a "make the product feel alive" demo).

## Deliverables at end

Files created / modified, list of demo entities generated, live-match walkthrough, reset behavior, perf note (fixture cached, generated once, ~50 ms), typecheck result.

---

**Scope check before I build:** this is a large surface (~15 files touched for overlays, plus the fixture generator itself). Approve the client-side overlay approach and I'll implement it. If instead you want demo data **actually seeded into Supabase under the current tenant** (so it appears identically on every device / to real logins), say so — that is a different, larger change with tenant-safety implications.