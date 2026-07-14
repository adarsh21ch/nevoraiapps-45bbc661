
# Match Center → Public Cricket Platform

Removed the bottom "Book a call / Register" CTA bar on the academy website already. Everything below is the larger refactor and needs your approval before I start, because it touches the scoring engine, database, realtime, routing, roles and public site — several weeks of surface area.

I want to ship this in reviewable phases, not a single mega-PR. Each phase leaves the app fully working.

## Guiding principles

- The scoring engine (`src/lib/mc-statistics-engine.ts`) is the ONE source of truth. Every screen (public match page, player profile, team profile, records, insights, website) derives numbers from the same reducer — no per-screen recalculation.
- One Supabase Realtime channel per match, shared via a provider; every consumer subscribes through it (no duplicate `channel(...)` calls).
- Every completed / live match, every player, every team gets a public, SEO-indexable URL with SSR head metadata.
- No off-by-one over labels. Legal-ball count is the only source; wides/no-balls never increment; byes/leg-byes do. Regression tests locked in.

## Phase 1 — Foundations (safe, invisible)

1. Consolidate the engine
   - Move any stray stat math out of components into `mc-statistics-engine`.
   - Export pure selectors: `computeInningsSummary`, `computeBatting`, `computeBowling`, `computePartnerships`, `computeFallOfWickets`, `computeOverHistory`, `computeCurrentOverStrip`, `formatOverLabel`.
   - Formal tests for over label at 1.1, 1.6, 2.1, 10.6, 11.1, wide, no-ball, byes/leg-byes, undo/redo, over transition, innings transition.
2. Single realtime provider
   - New `MatchRealtimeProvider` keyed by `matchId` — one Supabase channel for `mc_ball_events`, `mc_innings`, `mc_matches`, `mc_match_squads`.
   - Every screen consumes via `useMatchLive(matchId)` instead of subscribing itself.
3. Database audit (migration)
   - Add indexes: `mc_ball_events(match_id, created_at)`, `mc_ball_events(innings_id, over_number, ball_number)`, `mc_matches(tenant_id, status, scheduled_date)`, `mc_match_squads(match_id, team_id)`.
   - Unique guard on `(innings_id, over_number, ball_number, sequence)` to prevent duplicate deliveries.
   - Public read policies for match/player/team pages (`TO anon` narrow SELECT).
   - `mc_matches.public_slug` populated for every live/completed match (backfill).

## Phase 2 — Public URLs (SSR + SEO)

- New routes (all public, SSR head with title/description/OG/twitter/canonical + JSON-LD):
  - `/match/$slug` — full match page (summary, live/final score, batting, bowling, current partnership, FoW, recent overs, ball-by-ball, over-by-over, CRR/RRR, target, PoM, venue, date, XI).
  - `/player/$slug` — profile (matches, R, B, avg, SR, HS, 50s, 100s, 4s, 6s, bowling, fielding, career timeline, recent matches, form graph).
  - `/team/$slug` — profile (P, W, L, runs, wickets, recent, players, top batter, top bowler).
  - `/records` — academy records (auto-computed).
  - `/insights` — public leaderboards and charts.
- Public server functions (publishable-key client + narrow `TO anon` SELECT) — no `requireSupabaseAuth` in these loaders.
- Sitemap generator at `/api/public/sitemap.xml` listing every live/completed match, player, team; `robots.txt` allows all.
- Ball-by-ball UI mirrors Cricbuzz: collapsed over row (chips), tap to expand to per-ball narration.

## Phase 3 — Match Center app (roles + bottom nav only)

- Remove the Match Center sidebar; keep only bottom nav: Live / Matches / Players / Insights / Profile.
- Live tab: live cards (LIVE badge, teams, score, overs, target, need, CRR, RRR, "Open Scorecard") or "Create Match" empty state.
- Matches tab: only Live and Completed. Delete Upcoming/Scheduled/Cancelled/Archived/Abandoned UI (data stays; filter surfaces removed). Search across player / team / ground / date.
- Roles:
  - OWNER: existing full access.
  - COACH / SCORER: gated to Match Center only. Add a role check in `_authenticated` layout that redirects non-owners hitting `/fees`, `/finance`, `/academy`, `/settings`, `/website` back to `/match-center`.
- Current-over strip: on over end, clear to blank until next legal delivery. Bowler-required state: current bowler goes inactive, tapping a scoring button opens bowler picker then replays the intended action (no popup interrupt).

## Phase 4 — Website sync

- The tenant website's Live/Matches/Records/Players/Teams sections read from the SAME public server functions used by `/match/$slug` etc.
- Live widget uses `useMatchLive` on the match id, so a scored ball updates hero widget and match page simultaneously.
- Bottom "Book a call / Register" CTA already removed. Verify no other floating popups occupy the fold.

## Phase 5 — Perf & QA

- Route-level code split for scorer, match page, insights, records.
- Virtualize ball-by-ball (`@tanstack/react-virtual`).
- `useMemo` on engine selectors keyed by last event id.
- Playwright end-to-end: score a full over (with wide, no-ball, bye, wicket, undo, redo), assert public match page + player profile + records update live.

## Technical notes

- No new business logic in components — they call selectors from `mc-statistics-engine`.
- Server functions for public reads use the server publishable client from `tanstack-supabase-integration`, not `supabaseAdmin`.
- Slugs stored in `mc_matches.public_slug`, `students.public_slug`, `mc_teams.public_slug`; unique per tenant; backfilled with a migration.
- Head metadata set in each leaf route's `head()`, derived from loader data. `og:image` only at the leaf; never on `__root`.

## What I need from you before I start

1. Confirm you want this shipped in the 5 phases above (each phase is a separate turn / PR).
2. Slug format for public URLs — is `sai-u16-vs-sky-u16-2026-07-14` OK for matches, `firstname-lastname-<playerId>` for players, `team-slug` for teams? Prevents collisions and keeps SEO clean.
3. For COACH / SCORER, is "Match Center only" strict (no read access to student profiles outside a match)? Or can they view player profiles too?

Once you confirm, I'll start Phase 1 (engine consolidation + realtime provider + DB indexes) — that phase is invisible to end users but unlocks everything else.
