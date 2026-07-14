
# AcademyOS V2 — Architecture Review

No code will change until you approve. This is a pure audit + plan.

---

## 1. Architecture Review (what's here today)

**Stack**
- TanStack Start v1 + React 19 + Vite 7, Tailwind v4 (`src/styles.css`)
- Supabase (Postgres + Auth + Realtime + Storage `tenant-assets`)
- Server logic via `createServerFn` (`src/lib/*.functions.ts`) + `requireSupabaseAuth`
- Multi-tenant via `tenants.slug` / `custom_domain`, resolved in `TenantGate` + `tenant-context`

**Frontend surfaces (66 route files, ~22k LOC)**
- **Public site**: `index`, `about`, `contact`, `fees`, `register`, `academy.$slug`, `match.$slug`, `m.$slug`, `star-players`
- **Auth**: `auth.tsx`
- **Dashboard (Owner/Admin)**: `dashboard.*` — students, batches, fees, attendance, leads, registrations, reminders, reports, insights, site, settings, profile
- **Match Center**: `match-center.*` (23 files) — dashboard, live, matches, create, scorebook, teams, tournaments, players, performance, recognition, records, awards, insights, ai-insights, website, scorers, settings
- **Scorer**: `scorer.$matchId.tsx` (1,853 LOC — largest file)
- **Platform Admin**: `platform-admin.*` — tenants, subscriptions, settings
- **Parent Portal**: `parent-portal.tsx`

**Backend**
- 46 tables (audited in schema summary), mostly RLS'd via `is_tenant_member` / `is_platform_admin` / `is_match_scorer` / `has_role` security-definer functions
- Public read paths via SECURITY DEFINER RPCs: `get_public_match_bundle`, `get_public_academy_bundle`, `get_parent_child_summary`, `list_parent_children`
- Slug + player_id auto-assignment triggers
- Realtime enabled on match tables; consolidated through new `useMatchLive` ref-counted hook ✅

**Engines (protected — do not rewrite)**
- `mc-ball-events-core.ts` + `mc-ball-events.ts` (ball append/undo, extras derivation)
- `mc-statistics-engine.ts` + `.format.test.ts` (has tests)
- `mc-rules-engine.ts`, `mc-finalization.ts`, `mc-career-engine.ts`, `mc-recognition-engine.ts`, `mc-tournament-engine.ts`, `mc-ai-engine.ts`, `mc-commentary.ts`, `mc-performance-analytics.ts`

---

## 2. Problems Found

**Architecture & duplication**
- Three parallel shells: `DashboardShell`, `PlatformShell`, `MatchCenterLayout` — no unified `AppShell`. Each re-implements header/nav/safe-area.
- Two bottom navs: `GlobalBottomNav` + `MatchCenterBottomNav` — inconsistent.
- Design system folder exists (`components/design-system/`) but many routes bypass it and hand-roll cards, KPIs, empty states.
- Match Center has 6 "demo-*" files (`demo-badge`, `demo-player-profile`, `demo-settings-card`, `demo-team-profile`, `demo-tournament-detail`) mixed with real UI — unclear which are shipped.
- `scorer.$matchId.tsx` is 1,853 LOC — one file owns scoring UI, state, dialogs, keyboard, undo. Needs decomposition (not rewrite).
- Two scoring session hooks (`use-scoring-session`, `use-demo-scoring-session`) with overlapping logic.
- Public match views split across `match.$slug.tsx` and `m.$slug.tsx` — duplicate routing surface.

**Design consistency**
- No enforced token layer. Some components risk hardcoded colors (`text-white`, `bg-black`) — needs sweep.
- Typography scale scattered; `design-system/typography.tsx` exists but underused.
- Spacing/radius/shadow tokens partially defined; not universally applied.

**Mobile**
- Native-app feel is inconsistent: some pages have desktop-first tables (dashboard.students, dashboard.fees, platform-admin.tenants.$id) that horizontal-scroll on mobile.
- Safe-area (`env(safe-area-inset-*)`) only partially wired — bottom navs overlap iOS home indicator on some routes.
- Sheets vs Dialogs used inconsistently; mobile should prefer bottom sheets.
- `FloatingWhatsApp` + `MobileCtaBar` compete for bottom real estate on public site (already partially addressed).

**Performance**
- Many routes fetch in `useEffect` + `useState` instead of loader + `useSuspenseQuery`. Causes waterfalls and blank flashes.
- Some Match Center pages likely re-subscribe to realtime per component before the new `useMatchLive` hook — needs adoption sweep.
- No route-level `staleTime`/`gcTime` policy; queries refetch aggressively.
- `types.ts` is large; some client bundles import server-only modules indirectly (needs audit via `bun run build`).

**Auth / roles**
- Roles live in `profiles.role` + `platform_admins` + `mc_scorers` + `mc_parent_links` — four sources. `has_profile_role` exists but not consistently used in the UI to gate menus.
- No single `useCurrentRole()` hook — role checks are re-derived in many places.

**Routing**
- Flat file names (`match-center.foo.bar.tsx`) with no `_authenticated` gate for dashboard/match-center; auth checks happen inside components. Prerender-safe today because loaders don't hit protected server fns, but fragile.
- Public routes and app routes share the same shell wrapper (`TenantGate`), which forces public-site chrome onto app-like screens in edge cases.

**Data model observations (no changes proposed yet)**
- `mc_matches` is 38 columns — some derived fields could live in a view.
- `mc_public_matches` gates public visibility per-match — good.
- Grants look present on schema summary; will verify on any new table.

---

## 3. Reusable Component Set (design system v2)

Build once in `src/components/ds/` (new namespace) and migrate incrementally:

**Primitives**
- `AppShell` — header slot, nav slot, safe-area, scroll container
- `TopBar` (title, back, action) / `BottomNav` (role-aware items)
- `Screen` — page container with consistent padding + max-width
- `Section` / `SectionHeader`

**Content**
- `Card`, `StatCard` (KPI), `ListItem`, `PlayerRow`, `MatchRow`, `TeamRow`
- `Table` (desktop) with automatic `MobileList` fallback
- `EmptyState`, `ErrorState`, `LoadingState` (skeletons per shape: list/card/detail)
- `Badge`, `Chip`, `Avatar` (person/team/logo variants)

**Interaction**
- `Button` variants, `IconButton`, `SegmentedControl`, `Tabs`
- `Sheet` (bottom-sheet first on mobile, dialog on desktop)
- `SearchBar`, `Filter`, `Sort`
- `Form` primitives (Field, Label, Error, Hint), `NumberStepper`, `PhoneInput`, `Money`

**Match-specific atoms** (already partially exist — consolidate)
- `Scorecard`, `LiveStrip`, `OverBar`, `RunButtons`, `ExtrasPad`, `WicketPad`, `PartnershipCard`

All tokens live in `styles.css` `@theme` — no hex in components.

---

## 4. Refactoring Strategy (safe, incremental)

Guardrails:
- **Never** touch `mc-ball-events*`, `mc-statistics-engine*`, `mc-rules-engine*`, `mc-finalization*`, `mc-*-engine*` internals. Wrap, don't rewrite.
- **Never** rename existing tables/columns. Add views/RPCs if needed.
- **Preserve** all public URLs (`/academy/:slug`, `/match/:slug`, `/m/:slug`).
- Every migration keeps existing RLS + adds GRANTs.

Approach:
1. Introduce `ds/` primitives alongside old components. Old components keep working.
2. Migrate routes one surface at a time (Match Center Live → Match Center Dashboard → Dashboard Students → …).
3. Delete demo-* + old shells only after their consumers migrate.
4. Adopt `useMatchLive` everywhere match realtime is used; remove ad-hoc `supabase.channel` calls.
5. Convert `useEffect+fetch` pages to loader + `useSuspenseQuery` using existing `dashboard-queries` / `platform-queries` / `site-queries` patterns.
6. Split `scorer.$matchId.tsx` into `<ScorerScreen>` + `useScorerController` + pad components — no logic changes.

---

## 5. Implementation Roadmap (phased)

**Phase 0 — Foundations (no user-visible change)**
- Design tokens sweep in `styles.css`
- `ds/` primitives: AppShell, Screen, TopBar, BottomNav, Card, StatCard, ListItem, EmptyState, LoadingState, Sheet, Button, Tabs, SegmentedControl
- `useCurrentRole()` + role-aware nav config
- Safe-area utilities

**Phase 1 — Public site polish**
- `academy.$slug`, `match.$slug`, `m.$slug`, `star-players`, `index`, `about`, `contact` on new primitives
- Live match widget uses `useMatchLive`
- SEO/head metadata sweep per route (og:image at leaves only)

**Phase 2 — Match Center (mobile-first)**
- Consolidate bottom nav
- Migrate `match-center.live`, `.dashboard`, `.matches`, `.scorebook.$matchId`
- Decompose `scorer.$matchId.tsx` (behavior-preserving)
- Remove `demo-*` files after parity confirmed

**Phase 3 — Dashboard (Owner/Admin)**
- Students, Batches, Attendance, Fees, Registrations, Leads → mobile-first cards + desktop tables
- Reports/Insights → StatCard grid

**Phase 4 — Roles & Navigation**
- Owner / Admin / Student / Parent nav configs
- Route gating via `_authenticated` layout where safe (respect SSR/prerender rules)

**Phase 5 — Platform Admin**
- Tenants list/detail, subscriptions, settings on new primitives

**Phase 6 — Cleanup**
- Delete dead code, old shells, demo files
- Bundle audit + `bun run build` size check
- Realtime subscription audit

---

## 6. Risks

- **Scorer regressions** — highest risk. Mitigation: no engine changes; snapshot the current scoring flow with a manual test script + preserve `mc-statistics-engine.format.test.ts`; migrate UI in a branch-like sequence.
- **Realtime cost** — a botched migration could double-subscribe. Mitigation: ban raw `supabase.channel` in match code; route everything through `useMatchLive`.
- **SSR/prerender breakage** — moving loaders under auth without gating. Mitigation: keep protected data in components via `useServerFn`, not in public loaders.
- **Design drift** during long migration — mixed old/new components. Mitigation: freeze old components (no new usages) once `ds/` primitive lands.
- **Tenant routing** — public site and app share `TenantGate`. Mitigation: split into `PublicTenantGate` + `AppTenantGate` in Phase 0.

---

## 7. Estimated Files Changed

Rough scope (no engine files):

| Area | Files touched | New files |
|---|---|---|
| Design system primitives | — | ~25 in `src/components/ds/` |
| Tokens / styles | 1 (`src/styles.css`) | — |
| Public site routes | ~9 | — |
| Match Center routes | ~23 (light edits, 3–4 deep) | ~6 (scorer split) |
| Dashboard routes | ~14 | — |
| Platform admin | ~6 | — |
| Shells / nav | delete 3, replace with 2 | 2 |
| Hooks | +2 (`useCurrentRole`, `useSafeArea`) | 2 |
| Migrations | 0 required for Phase 0–2; possibly 1 for a public leaderboard view later | — |

Total: **~60 files edited, ~35 files added, ~10 files deleted**. Zero engine rewrites.

---

## 8. Development Phases — order of execution

1. Phase 0 Foundations
2. Phase 1 Public site
3. Phase 2 Match Center + Scorer split
4. Phase 3 Dashboard
5. Phase 4 Roles & Nav gating
6. Phase 5 Platform Admin
7. Phase 6 Cleanup + perf pass

Each phase ends with: build passes, no realtime leaks, no console errors, screenshots on mobile viewport.

---

**Approve this plan and I'll start with Phase 0 (foundations, no visible changes).**
Reply with any changes to scope, priorities, or phase order before I begin.
