# Plan - Persistent Match Scoring & Navigation Fixes

Hardening the Match Center scoring experience by implementing cross-device state persistence for active players and fixing navigation regressions.

## User Review Required

> [!IMPORTANT]
> The persistence feature requires a new database table `mc_match_draft_selections`. This will store the current striker, non-striker, and bowler for an active match, allowing you to switch between desktop and mobile seamlessly.

- The "Back" button on the match creation page will now reliably return to the match list or dashboard.
- Striker/Non-Striker/Bowler selections will now persist even if you refresh the page or switch devices.

## Proposed Changes

### Database & Backend
- Create `mc_match_draft_selections` table to store:
    - `match_id`, `innings_id`, `tenant_id`
    - `striker_athlete_id`, `striker_name`
    - `non_striker_athlete_id`, `non_striker_name`
    - `bowler_athlete_id`, `bowler_name`
- Add `upsert_match_draft_selection` RPC for atomic updates.
- Enable RLS and real-time for the new table.

### Core Scoring Logic (`src/hooks/use-scoring-session.ts`)
- Integrate `mc_match_draft_selections` into the hook lifecycle.
- Load persistent selections on match mount.
- Update persistent selections on `setStriker`, `setNonStriker`, `setBowler`, and after `submitBall` (strike rotation).
- Listen for real-time changes to the selection table to sync multiple devices.

### UI & Navigation
- Fix the back button in `src/routes/match-center.create.tsx` to handle history correctly.
- Ensure the "striker/non-striker/bowler" selection panels in `src/routes/scorer.$matchId.tsx` reflect the persistent state immediately.

## Technical Details
- Table: `public.mc_match_draft_selections` (id, tenant_id, match_id, innings_id, striker_id, striker_name, non_striker_id, non_striker_name, bowler_id, bowler_name).
- RPC: `upsert_match_draft_selection` will use `ON CONFLICT (innings_id)` to keep one selection per innings.
- Real-time: Use Supabase `channel` on `mc_match_draft_selections` filtered by `innings_id`.
