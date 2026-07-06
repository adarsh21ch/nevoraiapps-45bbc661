## Just shipped (this turn)

**Registration bug is fixed.** Root cause:
1. Step 1 silently failed because `anon` had no SELECT policy on `registrations`, so the `.select("id")` after insert returned `null` and the code treated a successful insert as an error.
2. Step 2 always failed because it did a second `INSERT` (should have been `UPDATE`) with `payment_status: "claimed_paid"` — a value the RLS `WITH CHECK` doesn't allow.

Fix: two `SECURITY DEFINER` RPCs — `submit_registration` (returns the new id) and `attach_payment_ref` (updates the existing row). Verified end-to-end via a headless browser run — form now advances to the UPI payment step with the correct amount, and the row lands in the owner's Registrations inbox.

## Sequenced next turns

I'll ship each of these as its own turn so you can review and course-correct without waiting on a monolith.

### Turn A — Stadium Night landing (drop the cricket-ball motif)

New landing built around your palette `#0a0f0a / #141d16 / #c6ff4a / #f5f5f0`:

- Hero: near-black background, subtle floodlight radial glow, chalk-line grid overlay, lime `#c6ff4a` as the ONE accent (headline underline + primary CTA + stat numbers). No cricket ball. No purple gradients.
- Type: `Bricolage Grotesque` display + `Inter` body kept, but tighter tracking, larger scale, ALL-CAPS eyebrow labels like a matchday programme.
- "How it works" as a 3-lane grid (Register → Manage → Grow) with lime hairline dividers.
- Segmented cards (Academy / Gym / Coaching) become horizontal chips instead of the current tiled block.
- Pricing strip flattened, WhatsApp + Email CTAs stay dynamic from `platform_settings`.
- Framer-motion on hero and card entry only — no scattered micro-animations.

### Turn B — Leads inbox + one-tap WhatsApp reply

- New `leads` table (name, phone, message, source, tenant_id, status enum `new|contacted|won|lost`, notes). Public `insert` policy so the landing form can write. Owner sees them in a new dashboard route `/dashboard/leads`.
- Landing gets a small "Talk to us" form on the tenant site (separate from full `Register`) that writes a lead.
- Owner inbox: filter by status, one-tap WhatsApp button that opens `wa.me` with a prefilled message, quick status buttons, notes field.

### Turn C — Attendance (coach mobile)

- New `attendance_sessions` (batch_id, date, coach_id) + `attendance_marks` (session_id, student_id, status enum `present|absent|late`).
- Coach mobile view under `/dashboard/attendance`: pick batch → pick date → tap-through student list with big present/absent toggles. Optimistic updates.
- Absent students' guardians get a one-tap WhatsApp reminder from the same screen (opens `wa.me` prefilled — no auto-send yet, avoids WhatsApp Business API costs).

### Turn D — Auto fee reminders (pg_cron)

- New `/api/public/hooks/fee-reminders` server route, authed with anon `apikey` header per your existing pattern.
- Daily cron at 09:00 IST scans overdue students, writes a `reminder_logs` row per student, and generates a WhatsApp deep link the owner can tap from the dashboard. Not auto-sent — owner reviews and taps.
- New "Reminders queue" tab on the fees page.

### Turn E — AI assistant (owner chat)

- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) via a `createServerFn`. Auth-scoped to the current tenant via `requireSupabaseAuth`.
- Tools the model can call: `list_overdue_students`, `count_registrations_this_month`, `draft_fee_reminder(student_id)`, `list_attendance_gaps(batch_id, days)`.
- Chat UI at `/dashboard/assistant` — one conversation per owner, persisted in localStorage (per the chat-agent contract, no threaded history needed for MVP; can upgrade later).

## Technical notes

- Every new table follows the CREATE → GRANT → RLS → POLICY structure; anon only gets policies where a landing/public flow demands it.
- `platform_settings` contact info continues to drive all WhatsApp/email links so you can change from the admin panel.
- The `nevorai.com` wildcard subdomain flow and reserved-slug guards stay intact.
- No changes to auth, tenants schema, or existing dashboard behaviour beyond the additive new routes.

## What I need from you

Approve this plan and I'll start on **Turn A (Stadium Night landing)** immediately. Reject or comment and I'll re-sequence.