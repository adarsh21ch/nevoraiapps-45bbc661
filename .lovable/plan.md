
# Phase 03.2 — Academy Website & CMS

## Architecture Review (challenging current state)

Audited existing website surface before proposing anything new:

- **`public.site_content`** table already exists (tenant_id, section, content jsonb, sort_order). It is the CMS store — no new table needed for section content.
- **`public.tenants`** already holds logo, favicon, colors, socials, whatsapp, upi, address, custom_domain, tagline, seo bits. All theme fields live here.
- **`src/lib/site-queries.ts`** already exposes `siteContentQuery` / `feePlansQuery` / `batchesQuery`.
- **`src/components/dashboard/SiteContentTabs.tsx`** (412 lines) is the existing section editor.
- **`src/routes/dashboard.site.tsx`** is the Owner CMS entry.
- **`src/routes/academy.$slug.tsx`** + **`src/routes/index.tsx`** (641 lines, tenant home), **`about.tsx`**, **`contact.tsx`** are the public site.
- **`src/components/site/*`** ships SiteHeader, SiteFooter, TenantGate, FloatingWhatsApp, PageHero, PersonAvatar, StoragedImage, MobileCtaBar.
- **`src/components/website/widgets/`** already has LiveMatchWidget, ListWidget, WidgetCard, WidgetRenderer.
- **Registration** (`/register`), **Billing** (`fee_plans`), **Match Center feeds** (`match-feeds.ts` + `CricketToday`), **Player achievements** (`mc_athlete_achievements/awards`, `mc_recognitions`, `mc_hall_of_fame`, `mc_academy_records`, `mc_academy_timeline`), **Notifications** (`publish_notification`), **`get_public_academy_bundle` RPC** all exist.

**Verdict**: the platform already has 80% of what this phase asks for. The gap is (1) missing public pages for several sections, (2) no CMS editors for a few sections, (3) no policy pages / acceptance tracking, (4) no printable registration PDFs, (5) SEO polish. **We extend, we do not rebuild.**

**Simplifications**:
- Keep one CMS table (`site_content`); every new section is a new `section` key + a form in `SiteContentTabs`.
- Keep one theme store (`tenants`); reuse existing `dashboard.branding.tsx` and contact editor.
- Reuse `TenantGate` + `SiteHeader` + `SiteFooter` on every new public route.
- Reuse existing `match-feeds.ts`, `mc-academy-records.ts`, achievements queries — no new query layer.

## Database Changes (minimal)

One migration:

1. **`policy_documents`** table — versioned CMS pages for terms/privacy/refund/fee/conduct/leave/medical.
   Columns: `id`, `tenant_id`, `kind` (enum), `version` (int), `title`, `body_md`, `published_at`, `created_at`.
   GRANT SELECT to `anon, authenticated`; INSERT/UPDATE to `authenticated` gated to tenant owners; ALL to `service_role`. RLS: public read of latest published version per (tenant, kind); write via `has_role('owner')` or tenant-member check consistent with existing patterns.
2. **`registrations.policy_acceptances` jsonb column** — appends `{kind, version, accepted_at}` at submit time. No new table; extends the existing frozen Registration module minimally through its server function.
3. Extend `get_public_academy_bundle` RPC to include `policies: [{kind, version, title, body_md}]` (latest published only) so public pages hit one round-trip.

No changes to any frozen module's schema (attendance, billing, matches, notifications, tenants columns unchanged).

## New Routes (public)

Each is a leaf route with its own `head()` (title/description/og/canonical), wrapped by `TenantGate` + `SiteHeader` + `SiteFooter`.

- `/programs` — reads `site_content[section=programs]` + `batchesQuery`
- `/coaches` — reads `site_content[section=coaches]`
- `/facilities` — reads `site_content[section=facilities]`
- `/achievements` — reuses `mc_academy_records` + `mc_hall_of_fame` + `mc_athlete_awards`
- `/gallery` — reads `site_content[section=gallery_albums]`, lazy `<img loading="lazy">`
- `/matches` — reuses `match-feeds.ts` (upcoming/live/completed tabs)
- `/testimonials` — `site_content[section=testimonials]`
- `/faq` — `site_content[section=faq]`
- `/admissions` — CTA into existing `/register` route (no duplicate form)
- `/fees` — extends existing `/fees` (already present); adds owner-controlled display mode (hide / show / contact / demo) from `tenants.fee_display_mode` (add via migration as tenant column? — NO, store in `site_content[section=fees_display]` to avoid touching tenants schema)
- `/policies/$kind` — renders `policy_documents` latest published
- `/location` — reuses tenant address + google maps embed

## New CMS editors (Owner-only, in `dashboard.site.tsx`)

Add tabs / sections inside existing `SiteContentTabs` for: coaches, facilities, testimonials, faq, gallery_albums, why_choose_us, admissions_cta, fees_display, footer_extras. All write to `site_content`. Add a **Policies** tab that CRUDs `policy_documents` with a "Publish new version" button (bumps `version`, sets `published_at`).

## Registration PDF

New file `src/lib/registration-pdf.ts` already exists (per file listing). Extend it to output two vector PDFs via `pdf-lib`:
1. Filled — pulled from registration row.
2. Blank — same template, empty fields, uses academy logo/tagline/colors.

Add "Download filled PDF" on registration success screen + "Download blank form" on `/admissions`. No image rasterization.

## SEO

- Add `og:image`, JSON-LD `Organization` + `SportsClub` (with address, telephone, url, sameAs socials) on public leaf routes.
- Existing `sitemap.xml`/`robots.txt` — verify and extend `entries` to include new public routes.
- Canonical + og:url per-route (leaf only).

## Security

- New `policy_documents` table gets full RLS + GRANTs (public SELECT of published rows only; owner writes via `has_role`).
- No new service-role paths; policy CRUD is a `createServerFn` guarded by `requireSupabaseAuth` + owner check.
- No frontend service key exposure.

## Performance

- One RPC call (`get_public_academy_bundle` extended) hydrates most public pages.
- Shared `siteContentQuery` cache reused across all public routes.
- Lazy image loading + `srcset` on gallery.
- Route-level code-splitting is automatic (file-based routing).
- No new realtime channels.

## Reuse Ledger (planned)

**Components reused**: TenantGate, SiteHeader, SiteFooter, FloatingWhatsApp, PageHero, StoragedImage, MobileCtaBar, PersonAvatar, LiveMatchWidget, WidgetRenderer, CricketToday, SiteContentTabs.

**Hooks/queries reused**: `siteContentQuery`, `feePlansQuery`, `batchesQuery`, `match-feeds.ts` hooks, `mc-academy-records`, `mc-athletes` achievements, `notifications` publisher.

**RPCs reused**: `get_public_academy_bundle` (extended, not replaced), `publish_notification`, `has_role`.

**Tables reused**: `tenants`, `site_content`, `batches`, `fee_plans`, `registrations`, `mc_*`, `notifications`.

**New code (only where necessary)**:
- `policy_documents` table + editor + `/policies/$kind` route (no existing equivalent).
- Public routes listed above (each ~80–150 lines, mostly composition of existing components/queries).
- Registration PDF generator (vector, `pdf-lib`) — no existing PDF pipeline for registration output.
- Minor extension to `get_public_academy_bundle` to include policies.

## Out of scope for 03.2 (explicit)

- Drag-and-drop page builder (not requested; forms are enough).
- Multi-language site copy.
- Custom domain provisioning UI (existing routing already supports `custom_domain`).
- Analytics dashboards for site traffic.

## Deliverables order

1. Migration (`policy_documents` + extend RPC + `registrations.policy_acceptances`).
2. Owner CMS extensions in `SiteContentTabs` + new Policies editor.
3. Public routes (programs, coaches, facilities, achievements, gallery, matches, testimonials, faq, admissions, policies/$kind).
4. Registration PDF (filled + blank).
5. SEO metadata + sitemap entries.
6. Final audit report (14 sections requested).

## Risk / Rollback

- Every new public route is additive — removing them cannot break frozen modules.
- Migration is purely additive (new table + new column + RPC replacement is backward-compatible if column list stays a superset).
- If policy acceptance breaks Registration, we short-circuit by defaulting `policy_acceptances = '[]'` and hiding the checkbox.

---

**Approve this scope and I'll execute in the order above.** If any section should be dropped (e.g., skip PDF, skip policies), tell me now so the migration only creates what we'll actually use.
