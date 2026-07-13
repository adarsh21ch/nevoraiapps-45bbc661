## Goal

Three connected changes:

1. Rework the mobile bottom navigation so the center tab surfaces **Insights / Records**, and Match Center (create / manage / live scoring entry points) moves under **Manage**.
2. Introduce a **Scorer** role: the owner can grant a specific player scoring-only access. Scorers can create and score matches from their phone, but cannot see fees, payments, student PII, or admin data.
3. Add a **share link** for live matches so viewers can watch scoring without touching owner data.

---

## 1. Bottom navigation restructure

Current: `Home · Match Center (center) · Manage · Profile`
New: `Home · Insights · Manage · Profile` (4 tabs, center = Insights)

- `Insights` route (`/insights`) becomes the record-and-data hub:
  - Academy records (existing `mc_academy_records`)
  - Leaderboards, star players, recent match summaries
  - Player insights entry (search a player → their card)
  - "Live now" strip at the top when any match is live (deep-links into the public match page or scorer if the user is the scorer)
- `Manage` gains a **Match Center** section:
  - Create match
  - Live / upcoming / completed matches
  - Teams, tournaments, squad, settings
  - Assign scorers (see §2)
- Remove the standalone center "Match Center" tab from `GlobalBottomNav`.

Files touched:
- `src/components/shared/GlobalBottomNav.tsx` — swap center tab.
- New `src/routes/insights.tsx` (composes existing records / leaderboards / live widget).
- `src/routes/dashboard.index.tsx` (Manage home) — add Match Center card group.
- Existing `/match-center/*` routes stay; only the entry point moves.

---

## 2. Scorer role (limited-access users)

### Data model

Add a `mc_scorers` table so the owner can grant scoring-only access without touching the main roles table:

```text
mc_scorers
  id uuid pk
  tenant_id uuid  → tenants.id
  user_id uuid    → auth.users.id  (the scorer's login)
  athlete_profile_id uuid nullable  → mc_athlete_profiles.id  (if they're a player)
  display_name text
  status text  (active | revoked)
  created_by, created_at, updated_at
  unique(tenant_id, user_id)
```

Security-definer helper `public.is_match_scorer(_user_id, _tenant_id)` → boolean, used by RLS.

### RLS scope

A scorer authenticated as `_user_id` gets:
- **Read/write** on `mc_matches`, `mc_innings`, `mc_ball_events`, `mc_match_squads`, `mc_teams`, `mc_athlete_profiles` **for their tenant only**.
- **Read** on `students.name` and basic player identity (via a narrow view `students_scorer_view` exposing only id, name, player_id, photo_url — no phone, dob, guardian info, fees).
- **No access** to `payments`, `fee_plans`, `registrations`, `leads`, `attendance_*`, `reminder_logs`, full `students` PII, `platform_*`.

All existing owner/admin policies stay unchanged; scorer policies are added alongside via `OR public.is_match_scorer(auth.uid(), tenant_id)`.

### UI

- Manage → Match Center → **Scorers**: owner sees a list of scorers, can add one by picking an existing player (or entering an email to invite) and assigns/revokes.
- Scorer login: after sign-in, if the user is only a scorer (not a tenant member/admin), the app boots into a **Scorer Home** shell showing only:
  - Live / upcoming matches they can score
  - "Create match" button
  - Their profile / sign-out
  - No Manage tab, no Insights financials, no Home dashboard tiles.
- Reuse the existing `MobileScorer` UI as-is.

Routing: a pathless layout `_scorer/` route that redirects tenant members to the normal app and shows the scorer shell to scorer-only users.

---

## 3. Share link for live matches

Reuse existing `mc_public_matches` (already has `public_slug`, `is_public`, `allow_live_score`, `allow_scorecard`, `allow_player_profiles`, and RPC `get_public_match_bundle`).

- From Manage → Match → **Share**: toggle "Public share" and copy a link to `/match/<slug>`.
- Public page shows: live score, current batters/bowler, over strip, scorecard, commentary. Never shows: fees, payments, phone, guardian info, DOB.
- Owner controls per-match toggles for `allow_scorecard` and `allow_player_profiles` on the share sheet.

Files touched:
- New `ShareMatchDialog` in `src/components/match-center/`.
- Wire the dialog from the match detail / scorer "More" sheet header.
- `src/routes/match.$slug.tsx` already exists — verify it only reads via `get_public_match_bundle` (no direct table reads) and remove any exposed PII fields.

---

## Rollout order

1. Migration: `mc_scorers` table + `is_match_scorer` function + scorer-side RLS policies + `students_scorer_view` (schema only — regenerated types come after approval).
2. Bottom nav swap + `Insights` route (pure UI, no data risk).
3. Manage → Match Center card + Scorers admin screen.
4. Scorer-only shell + `_scorer` layout.
5. Share link dialog + audit of `/match/$slug` for PII leaks.

---

## Open decisions I need from you before starting

1. **Scorer invite**: pick from an existing player list only, or also allow inviting by email (creates an auth user with scorer-only role)?
2. **Who can create a match?** Owner + admins + any active scorer, or scorer only when the owner has pre-created the match and assigned them to it?
3. **Insights tab audience**: public-safe (no fees, no PII — same as share link), or owner-only rich view? I recommend public-safe so scorers and parents can share the same route.
4. Confirm the 4-tab bottom nav (`Home · Insights · Manage · Profile`) vs keeping 5 tabs with Insights + Match Center both visible.

Once you answer these I'll ship the migration first, then the UI in the order above.
