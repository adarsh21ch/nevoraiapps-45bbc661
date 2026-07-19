This is a MEDIUM-scope stabilization + polish pass across the tenant public website and the platform-admin/site settings. Grouped into 4 parts. Nothing removes existing data; all changes are additive and backward-compatible.

---

## Part 1 — Per-page hero background carousels

**Goal:** Each public page (Home, About, Programs, Star Players, Matches, Gallery, Fees, Contact) can have multiple hero background images that auto-slide right→left every ~5s. Owner/platform admin uploads them from the site settings.

**Backend**
- New column on `site_content` (or equivalent tenant site record) — `page_hero_images jsonb default '{}'::jsonb` — keyed by page slug, value is an ordered array of storage paths.
  Example: `{ "home": ["a.jpg","b.jpg"], "matches": ["m1.jpg"] }`
- Extend `tenants_public_directory` view to expose `page_hero_images`.
- Reuse existing `tenant-media` storage bucket (same one gallery uses). No new bucket, no new RLS surface.

**Owner site settings (`dashboard.site.tsx`)**
- New "Page Headers" section with one uploader row per page. Each row: multi-file upload, reorder (drag), delete. Max 8 images per page. Reuse existing gallery upload helpers.
- Platform-admin tenant editor gets a link to the same screen (no duplicate uploader).

**Public rendering**
- New `<HeroCarousel images={...} />` component. If images empty → keep current gradient hero (no regression). If 1 image → static. If 2+ → framer-motion crossfade + slide, 5s interval, pauses on hover, respects `prefers-reduced-motion`.
- Wire into `PageHero` used by About/Programs/Matches/Gallery/Fees/Contact and the home hero.

---

## Part 2 — Hide Fees tab toggle

**Goal:** Owner can hide the "Fees" link in public site nav without touching data.

**Backend**
- New boolean on `site_content` → `show_fees_tab boolean not null default true`. Exposed via `tenants_public_directory`.

**UI**
- Toggle in `dashboard.site.tsx` (site settings) — "Show Fees in public navigation".
- Same toggle mirrored in platform-admin tenant detail for support access.
- `SiteHeader` / mobile nav / footer filter out Fees when false. The `/fees` route itself stays reachable by direct URL (owner may still link it from admin), just hidden in nav.

---

## Part 3 — Matches page bugs + public live/history

**Investigation first** — before changing anything I will:
- Read `src/routes/matches.tsx`, `src/routes/matches.$matchId.tsx`, and the RPC feeding "Recent Results" to confirm why completed matches aren't listed. Likely one of: RLS on `mc_matches` for anon, missing `status='completed'` inclusion in the fetcher, or the view scoping to a wrong tenant column. Report the root cause before patching.

**Public matches page (`/matches`)**
- Three sections: **Live now** (status='live', prominent, "Watch live" CTA → `/matches/$id`), **Upcoming**, **Recent results** (completed, last 10, with final score + winner + "View scorecard" link).
- Empty states stay but only when the section is genuinely empty.

**Site header live banner**
- Thin dismissible banner above `SiteHeader` when a live match exists for the tenant: "🔴 LIVE — Team A vs Team B · 84/3 (12.4) · Watch". Realtime-subscribed to `mc_ball_events` (already wired for the public match page — reuse the same hook).
- Only renders on public site routes; not on dashboard/scorer.

**Match detail page**
- Already exists at `/matches/$matchId`. Add a "Watch live scorecard" prominent CTA when status='live' and ensure completed matches show the full scorecard + ball-by-ball history (should already work — will verify).

---

## Part 4 — Files touched (expected)

Migrations
- 1 migration: add `page_hero_images jsonb`, `show_fees_tab boolean` to `site_content`; refresh `tenants_public_directory` view; verify anon RLS on `mc_matches`/`mc_innings` covers completed matches.

Frontend
- `src/components/site/HeroCarousel.tsx` (new)
- `src/components/site/PageHero.tsx` (accept images prop)
- `src/components/site/SiteHeader.tsx` (respect `show_fees_tab`, mount `LiveMatchBanner`)
- `src/components/site/LiveMatchBanner.tsx` (new, reuses `useMatchLive` hook)
- `src/routes/matches.tsx` (Live / Upcoming / Recent sections)
- `src/routes/dashboard.site.tsx` (Page Headers uploader + Fees toggle)
- `src/routes/platform-admin.tenants.$id.tsx` (Fees toggle mirror + link)
- `src/routes/index.tsx`, `src/routes/about.tsx`, `programs.tsx`, `matches.tsx`, `gallery.tsx`, `fees.tsx`, `contact.tsx`, `star-players.tsx` — pass hero images into `PageHero`.
- `src/lib/tenant.ts` / site-content fetcher — expose new fields.

Risk: MEDIUM. Additive schema, no destructive changes. Existing hero gradient remains as fallback so a tenant with zero uploaded images sees identical UI.

---

## Order of execution (after your approval)

1. Migration (schema + view refresh).
2. Investigate matches "recent results" root cause and report before patching.
3. Backend fetchers + type updates.
4. Owner site settings uploader + Fees toggle.
5. `HeroCarousel` + wire into every public page.
6. Public matches page rework + live banner.
7. Typecheck + verify: fees toggle hides nav, upload → carousel shows on public page, completed match appears in Recent results.

**Question before I start:** should the hero carousel replace the current blue-gradient hero background entirely when images exist, or overlay images on top of the gradient with a dark scrim so the white title text stays readable? (My default: overlay + scrim — safest for text contrast on any uploaded photo.)
