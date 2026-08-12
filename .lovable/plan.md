# Innings Transition & Match Synchronization Fix

Fix the Match Center issue where the UI triggers an innings change prematurely (even before overs are finished) and ensures consistent scoring between mobile and desktop views.

## User Review Required

> [!IMPORTANT]
> - The innings transition was likely triggering because the **innings limit (overs)** was being checked against the **total legal balls** without properly accounting for whether the over was actually completed or if a target was reached.
> - Synchronization issues between desktop and mobile often occur when one device uses local "optimistic" state while the other relies on Supabase Realtime, or when the `replayInnings` logic diverges between devices due to stale metadata.

## Proposed Changes

### Match Logic & Synchronization

#### [lib/mc-rules-engine.ts]
- Refine the `inningsShouldEnd` logic to be more robust.
- Ensure `awaitingNewBatter` and `awaitingNewBowler` flags are strictly cleared when an innings is complete to prevent "Next Batter/Bowler" pickers from popping up in a finished innings.
- Add a guard to `replayInnings` to ensure that an innings only ends at the *conclusion* of a legal over if it's an "overs_finished" condition, or instantly if "all_out" or "target_achieved".

#### [hooks/use-scoring-session.ts]
- Harden the Supabase Realtime listener to ensure it always sorts events by `sequence_number` to prevent over-count discrepancies between devices.
- Ensure that the local `events` state is always an exact reflection of the database, minimizing "ghost" balls that appear on one device but not the other.

#### [components/match-center/mobile-scorer.tsx]
- Update the "Finish" button and auto-picker logic to strictly respect the `inningsShouldEnd` status from the rules engine.
- Improve the "Awaiting Batter/Bowler" banner to hide automatically if the innings or match is complete.

#### [routes/scorer.$matchId.tsx]
- Fix the `resultLine` calculation to use the canonical `detectMatchResult` helper instead of a local heuristic, ensuring desktop and mobile show the same winner/margin.
- Ensure the "Innings Complete" dialog only appears when the engine confirms the innings is done.

## Technical Details

- **Innings Logic**: Update `replayInnings` in `src/lib/mc-rules-engine.ts` to check `legalBalls >= totalOvers * 6` only.
- **Realtime Sync**: In `src/hooks/use-scoring-session.ts`, the `INSERT` event in the Supabase channel will now explicitly re-sort the entire event array to handle out-of-order network packets.
- **Persistence**: Verify `mc_match_draft_selections` syncs correctly so striker/non-striker choices made on mobile appear instantly on desktop.

## Risk Assessment

- **Low Risk**: UI updates for banners and buttons.
- **Medium Risk**: Changes to the core replay engine (affects scoring).
- **High Risk**: None (no schema changes).
