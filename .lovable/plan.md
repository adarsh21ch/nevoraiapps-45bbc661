
# Plan — Academy site polish + owner dashboard simplification

Big scope, so I'm grouping it into 5 focused work streams. I'll implement all of them in this turn once you approve. Nothing below changes business logic — it's UI/UX, navigation, session, and one storage fix.

---

## 1. Apply the sports theme to every academy site (not just the landing)

Today only the home page uses the kinetic theme. I'll extend the same visual language (tokens, typography, glass cards, subtle motion) to:
- Public pages: About, Contact, Register, Fees, Star Players
- Auth pages: /auth (sign in / sign up / reset)
- The tenant "not accepting online activity" and placeholder screens

Each academy keeps its **own** brand color, logo, and niche vocabulary (already in `theme-presets.ts` + `niche.ts`). The theme just gets applied consistently everywhere so the whole product feels premium, not just the landing.

**Sports-flavored vocabulary** stays automatic via `niche()` — headings, empty states, CTAs will use "players / squads / coaches / season" instead of generic "students / batches".

**Visual upgrades (not a redesign — a polish pass):**
- Glass cards with soft depth (glassmorphism) on key sections
- Rounded 3D-ish stat tiles on the hero (Cloudflare-style pill/badge row)
- Motion: hero entrance + on-scroll reveals via Motion/React (already installed)
- Better section rhythm on the home page (Coaches, Star players, Testimonials, Facilities), all editable by owner

---

## 2. Owner dashboard — cut the noise, put fees front and center

Current dashboard has too many equal-weight items. New shape:

**Home (default view after login):**
- Big "Fees this month" panel: collected vs pending, count of paid/unpaid students, quick "Mark paid" action per pending row
- Secondary KPIs: active students, new registrations (7d)
- Everything else moves to secondary tabs

**Sidebar cleanup:**
- **Remove "Site editor" from the owner sidebar entirely.** As you said — you (owner) edit the site from Platform Admin, not from the tenant dashboard.
- Keep: Home, Fees, Students, Registrations, Batches, Fee plans, Attendance, Reminders, Reports

**Mobile bottom bar (5 slots):** Home · Fees · Students · Registrations · **Profile** (replaces the current "More" — profile screen holds settings, tenant info, sign out, help)

---

## 3. Public site nav + session

- **Owner Login moves to the top header** (right side, ghost button) on every public page. Remove it from the footer where the mobile CTA bar covers it.
- **Persistent session:** Supabase client already uses `persistSession: true` + `autoRefreshToken: true`; I'll verify the auth listener doesn't force sign-out and that "Add to Home Screen" launches keep the session (localStorage survives PWA installs, so this should already work — I'll test and confirm).
- **No student accounts.** Registration stays account-less (already the case) — nothing to change there beyond making it obvious.
- **Add-to-home-screen** now installs the current page's tenant app (already done in last turn via dynamic manifest). I'll make sure the `start_url` = `/` so it opens the landing, and the Apple meta tags are correct.

---

## 4. Fix logo upload

Current bug: uploading a logo from the device fails. I'll:
- Debug the `tenant-assets` bucket upload path (likely a MIME/size/RLS issue)
- Ensure image is uploaded to Supabase Storage (`tenant-assets/logos/{tenant}/…`), signed URL returned, and `tenants.logo_url` updated
- Show inline preview + clear error toast on failure

---

## 5. Small home-page visual upgrades (kinetic theme v2)

- Replace flat blue strip with a **glass stat card row** (rounded corners, backdrop-blur, subtle gradient border) — Cloudflare/Linear vibe
- Hero: layered depth + one tasteful motion accent (not busy)
- Coaches/Players sections with real photo slots the owner can upload
- Keep white + tenant-blue palette for Sai Sports (as you said, you like it) — just more premium

---

## Out of scope this turn (call these out so I don't sneak them in)

- **AI agent** for fees Q&A ("who hasn't paid this month?") — big enough to be its own turn. I'll leave a clean data shape so we can bolt it on next.
- Full site-editor rebuild inside Platform Admin (it already exists there; I'm just removing it from the tenant sidebar)
- Payment gateway / auto-reconciliation

---

## Technical notes (for reference)

- Files touched: `src/routes/{auth,about,contact,register,fees,star-players,index}.tsx`, `src/components/site/*`, `src/components/dashboard/DashboardShell.tsx`, `src/routes/dashboard.index.tsx`, `src/routes/dashboard.site.tsx` (remove from nav, keep route for platform admin), new `src/routes/dashboard.profile.tsx`, `src/lib/storage.ts` (logo upload fix)
- No DB migrations needed
- No new dependencies

---

Approve and I'll execute the whole plan in one pass. If you want me to drop or reorder any section (e.g. skip #5 visual polish, or do fees dashboard first), tell me now.
