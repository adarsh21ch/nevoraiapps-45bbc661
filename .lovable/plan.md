# Match Center Restructure — Bottom Nav + Roles

Match Center becomes a self-contained mini-app with its own 5-tab bottom navigation. Owners keep full Academy access; Coaches are locked to Match Center only. No changes to scoring engine, ball events, or match schema.

## 1. Roles

Current state: `profiles.role` is a free-text column with only `"owner"` present. We formalize two values:

- `owner` — full Academy + full Match Center.
- `coach` — Match Center only.

Migration:
- Add CHECK constraint (or enum) restricting `profiles.role` to `owner | coach`.
- Add `has_role(uid, role)` SECURITY DEFINER helper (per user-roles guidance, kept on `profiles` since roles are already there and single-tenant-per-user).
- No data change for existing rows (all owners).
- Update RLS on finance-adjacent tables (`fee_plans`, `payments`, `students` financial fields, `tenants` settings columns exposed via UI) so coaches cannot read/write them — even though the UI hides them, backend must enforce.

## 2. Frontend Navigation

Delete:
- `SidebarInner` and the desktop `<aside>` in `src/components/match-center/MatchCenterLayout.tsx`.
- The `NativeMobileDrawer` sheet + hamburger `Menu` button in the top bar.
- The current shared `GlobalBottomNav` for Match Center routes (Academy OS still uses it on `/dashboard/*`).

Add: `MatchCenterBottomNav` (new file) with exactly five tabs:

```text
LIVE       MATCHES    PLAYERS    INSIGHTS   PROFILE
Radio      Swords     Users      LineChart  UserCircle
```

Each tab is a route parent that owns its sub-pages:

- **LIVE** → `/match-center/live` (index shows empty state or Resume card; deep links to `/match-center/create` when no live match).
- **MATCHES** → `/match-center/matches` (list + filter + search; card grid; opens `/match-center/scorebook/$matchId`).
- **PLAYERS** → `/match-center/players` (list, search; player detail unchanged).
- **INSIGHTS** → `/match-center/insights` (new umbrella page consolidating Leaderboards, Records, Performance, AI Insights, Recognition, Awards into tabbed sections).
- **PROFILE** → `/match-center/profile` (new): coach details, notifications, settings link, logout — **or** "Switch to Academy" for owners.

Routes to consolidate under Insights (kept as sub-routes, no data changes): `leaderboards`, `records`, `performance`, `recognition`, `awards`, `ai-insights`.

Routes to move / hide from top nav (still reachable via deep link but not on bottom bar): `tournaments`, `teams`, `scorers`, `website`, `settings`, `dashboard`. These become entries inside Matches (teams, tournaments), Profile (settings, scorers), or removed from Match Center surfaces.

## 3. Bottom Nav Component

Fixed at bottom, `env(safe-area-inset-bottom)`, 60px tall, five equal columns, active state uses the tenant brand accent bar + label color change. iOS-style: rounded top corners, soft top shadow, subtle blur backdrop. Large tap targets (min 48px). Live tab shows a pulsing red dot when a live match exists (reuses existing `mc-live-count` query).

Only rendered inside `/match-center/*` routes. The Academy OS bottom nav stays on `/dashboard/*`.

## 4. LIVE Tab Empty & Resume States

Empty state: centered illustration + "No Live Match" + primary `Create Match` button → `/match-center/create`.

Resume state (when a live match exists): score card with team scores, overs, venue, current batters, and `Resume Live Match` primary button → `/match-center/scorebook/$matchId`. Uses the existing live match query; no new data.

## 5. Owner vs Coach Routing

- Root Academy shell (`/dashboard/*`): coaches redirected to `/match-center/live` in a `beforeLoad` gate under `_authenticated/dashboard`.
- `/match-center/*`: allowed for both roles.
- Profile tab renders different footer based on role:
  - Owner: "Switch to Academy" button → `navigate({ to: "/dashboard" })`.
  - Coach: "Logout" button (existing `signOut`).
- Auth flow post-login: read role, redirect owner → `/dashboard`, coach → `/match-center/live`.

## 6. Backend Authorization

- Add SECURITY DEFINER `has_role(uid, role)` helper.
- Add RLS policies keyed on `has_role`:
  - `fee_plans`, `payments`, `tenant_price_changes` → owner only.
  - `tenants` writes → owner only (reads already scoped by tenant).
  - `students` financial columns → owner only (already partly enforced; verify).
- Match Center tables (`mc_*`) — no policy changes (both roles have full access as today).

## 7. Layout Cleanup

`MatchCenterLayout`:
- Remove desktop sidebar `<aside>`.
- Remove hamburger menu, drawer, and its Sheet.
- Keep top header (back to Academy for owners, hidden for coaches).
- Main content becomes full-width with `pb-[calc(env(safe-area-inset-bottom)+72px)]` to clear bottom nav.
- Replace `<GlobalBottomNav />` with `<MatchCenterBottomNav />`.

## 8. Out of Scope

- No changes to `mc_ball_events`, scoring engine, or MCC rules.
- No changes to match creation flow logic.
- Player, match, and scorebook detail pages keep their current internals.
- Academy OS (`/dashboard/*`) sidebar/nav for owners unchanged.

## Technical Details

**Files added**
- `src/components/match-center/MatchCenterBottomNav.tsx`
- `src/routes/match-center.insights.tsx` (umbrella with sub-tabs)
- `src/routes/match-center.profile.tsx`
- `src/lib/roles.ts` (typed helper: `isOwner(profile)`, `isCoach(profile)`)

**Files edited**
- `src/components/match-center/MatchCenterLayout.tsx` — strip sidebar/drawer, mount new bottom nav.
- `src/routes/_authenticated/route.tsx` (or existing gate) — post-auth redirect by role.
- `src/routes/dashboard.tsx` (Academy shell) — `beforeLoad` bounces coaches to `/match-center/live`.
- `src/routes/match-center.live.tsx` — empty/resume state.

**Migration**
- `role` CHECK constraint: `role IN ('owner','coach')`.
- Create `has_role(_uid uuid, _role text)` SECURITY DEFINER.
- Coach-forbidden RLS on finance tables via `has_role(auth.uid(),'owner')`.

**Non-goals**
- No new role table (single role per profile is sufficient here; can migrate later if multi-role is needed).
- No PWA / manifest changes.
