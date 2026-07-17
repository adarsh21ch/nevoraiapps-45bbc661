## Goal

Make Registrations the single canonical intake tab. Fold the extra Admissions-Review capabilities into it (tucked under the row "More" menu so the UI stays clean), rename it to "Registrations / Admissions", and remove the standalone Admissions tab.

## What gets merged in

Registrations already has: approve, delete, PDF, share, copy, "new" badge, detail sheet.
Admissions Review adds these on top — I'll port them:

- **Reject** (with reason)
- **Waitlist** (with note)
- **Request changes** (dialog with notes → sets `changes_requested`)
- **Approve-with-details** dialog (batch + fee plan at approval time)
- **Status filter tabs**: Pending / Approved / Rejected / Waitlisted / Changes-requested
- **Admission timeline** (audit trail shown inside the detail sheet)

All of the above already have working server functions (`rejectRegistration`, `waitlistRegistration`, `AdmissionActionDialog`) — this is wiring, not new backend.

## UI placement (keeping the current look)

- Row primary buttons stay as today: **Approve** + kebab.
- Kebab "More" menu gains: Request changes, Waitlist, Reject, View timeline, Download PDF, Share, Copy, Delete.
- Filter tabs (Pending / Approved / Rejected / Waitlisted / Changes-requested) appear above the list — same `FilterTabs` component Admissions already uses, so it matches project design.
- Detail sheet gets a small "Timeline" section at the bottom (collapsed by default).
- Sidebar label: **Registrations / Admissions** (single entry).

## Removals & redirects

- Delete link "Admissions" from sidebar, home shortcuts, and any dashboard hero card.
- `/dashboard/admissions-review` route file → converted to a redirect that pushes to `/dashboard/registrations` (preserves any old bookmarks / links from AI briefs / emails).
- No DB / RLS / RPC changes. `approve_registration` RPC and `admission_timeline` table stay.

## Files affected

- `src/routes/dashboard.registrations.tsx` — add filter tabs, more-menu actions, timeline in sheet
- `src/routes/dashboard.admissions-review.tsx` — replace body with a redirect
- `src/components/dashboard/DashboardShell.tsx` (or wherever sidebar is defined) — remove Admissions entry, rename Registrations
- `src/routes/dashboard.index.tsx` — swap any "Admissions Review" tile/link to point at Registrations
- Any other file that links to `/dashboard/admissions-review` (I'll grep and update)

## Risk & rollback

- **Risk:** MEDIUM. UI-heavy merge on an existing owner workflow. No schema change.
- **Regression surface:** the Registrations inbox itself — I keep its current markup and only additively wire the new menu items and filter tabs.
- **Rollback:** revert the four files above; the admissions-review route is only converted (not deleted), so restoring its component is a one-file revert.

## Verification

- Typecheck.
- Playwright: submit a `/register` form → open Registrations → filter Pending → open kebab → run each action (approve with dialog, request changes, waitlist, reject) → confirm the row moves to the right tab and timeline shows the event → confirm approve creates a student + fee schedule (spot-check via Supabase).

If this looks right I'll go build it.