/* ================================================================
 * Scoring Engine Self-Validation Simulation
 * ----------------------------------------------------------------
 * Exercises replayInnings + calculateInningsStatistics with fully
 * synthesised ball-event logs covering the MCC scenarios listed
 * in prompt 42. Run with:
 *
 *   bun scripts/scoring-simulation.ts
 *
 * Prints PASS/FAIL for every invariant. Exits non-zero on failure.
 * ================================================================ */

import {
  replayInnings,
  totalRunsForBall,
  ballSwapsStrike,
  validateBallDraft,
  applyStrikeAfterBall,
  type MatchState,
} from "../src/lib/mc-rules-engine";
import { computeInningsStatistics } from "../src/lib/mc-statistics-engine";
import type {
  DismissalType,
  ExtraType,
} from "../src/lib/mc-ball-events-core";
import { isLegalDelivery } from "../src/lib/mc-ball-events-core";

/* ----------- Minimal MCBallEvent shape (matches DB row) ----------- */
type Ev = {
  id: string;
  tenant_id: string;
  match_id: string;
  innings_id: string;
  sequence_number: number;
  over_number: number;
  ball_number: number;
  is_legal_delivery: boolean;
  striker_athlete_id: string | null;
  striker_name: string | null;
  non_striker_athlete_id: string | null;
  non_striker_name: string | null;
  bowler_athlete_id: string | null;
  bowler_name: string | null;
  runs_off_bat: number;
  extra_type: ExtraType | null;
  extra_runs: number;
  dismissal_type: DismissalType | null;
  dismissed_athlete_id: string | null;
  dismissed_name: string | null;
  fielder_athlete_id: string | null;
  fielder_name: string | null;
  comment: string | null;
  created_by: string | null;
  created_at: string;
};

/* ---------------- Innings builder ---------------- */
class InningsBuilder {
  events: Ev[] = [];
  seq = 0;
  over = 0;
  ball = 0;
  legalInOver = 0;
  striker: string;
  nonStriker: string;
  bowler: string;

  constructor(striker: string, nonStriker: string, bowler: string) {
    this.striker = striker;
    this.nonStriker = nonStriker;
    this.bowler = bowler;
  }

  private mk(partial: Partial<Ev>): Ev {
    this.seq++;
    const legal = isLegalDelivery(partial.extra_type ?? null);
    if (legal) {
      this.legalInOver++;
      this.ball++;
    }
    const e: Ev = {
      id: `e${this.seq}`,
      tenant_id: "t",
      match_id: "m",
      innings_id: "i",
      sequence_number: this.seq,
      over_number: this.over,
      ball_number: this.ball || 1,
      is_legal_delivery: legal,
      striker_athlete_id: this.striker,
      striker_name: this.striker,
      non_striker_athlete_id: this.nonStriker,
      non_striker_name: this.nonStriker,
      bowler_athlete_id: this.bowler,
      bowler_name: this.bowler,
      runs_off_bat: 0,
      extra_type: null,
      extra_runs: 0,
      dismissal_type: null,
      dismissed_athlete_id: null,
      dismissed_name: null,
      fielder_athlete_id: null,
      fielder_name: null,
      comment: null,
      created_by: null,
      created_at: new Date(2025, 0, 1, 0, 0, this.seq).toISOString(),
      ...partial,
    };
    this.events.push(e);

    // per-ball strike swap
    if (ballSwapsStrike(e as any)) {
      [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
    }
    // over completion
    if (legal && this.legalInOver >= 6) {
      [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
      this.over++;
      this.ball = 0;
      this.legalInOver = 0;
      // bowler must change externally
    }
    return e;
  }

  run(r: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
    return this.mk({ runs_off_bat: r });
  }
  wide(extra = 1) {
    return this.mk({ extra_type: "wide", extra_runs: extra });
  }
  noBall(off = 0, byes = 0) {
    // extra_runs stores ONLY byes off the no-ball. Penalty added by engine.
    return this.mk({ extra_type: "no_ball", runs_off_bat: off, extra_runs: byes });
  }
  bye(r: number) {
    return this.mk({ extra_type: "bye", extra_runs: r });
  }
  legBye(r: number) {
    return this.mk({ extra_type: "leg_bye", extra_runs: r });
  }
  penalty(r: number) {
    return this.mk({ extra_type: "penalty", extra_runs: r });
  }
  wicket(kind: DismissalType, dismissed: string, fielder?: string) {
    const e = this.mk({
      dismissal_type: kind,
      dismissed_athleteId: null as any, // ignored
      dismissed_name: dismissed,
      fielder_name: fielder ?? null,
    });
    // caller must set new striker after this (simulate awaiting new batter)
    return e;
  }
  setBowler(b: string) {
    this.bowler = b;
  }
  setStriker(s: string) {
    this.striker = s;
  }
  swap() {
    [this.striker, this.nonStriker] = [this.nonStriker, this.striker];
  }
}

/* ---------------- Assertion helpers ---------------- */
let PASS = 0;
let FAIL = 0;
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    PASS++;
    console.log(`  ✓ ${label}`);
  } else {
    FAIL++;
    console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
  }
}
function section(name: string) {
  console.log(`\n▸ ${name}`);
}

/* ================================================================
 * Scenario 1 — Per-ball run math (MCC laws)
 * ================================================================ */
section("Per-ball run math");
const shape = (partial: Partial<Ev>): Ev => ({
  id: "x", tenant_id: "t", match_id: "m", innings_id: "i",
  sequence_number: 1, over_number: 0, ball_number: 1, is_legal_delivery: true,
  striker_athlete_id: null, striker_name: "A",
  non_striker_athlete_id: null, non_striker_name: "B",
  bowler_athlete_id: null, bowler_name: "X",
  runs_off_bat: 0, extra_type: null, extra_runs: 0,
  dismissal_type: null, dismissed_athlete_id: null, dismissed_name: null,
  fielder_athlete_id: null, fielder_name: null, comment: null, created_by: null,
  created_at: "2025-01-01T00:00:00Z", ...partial,
});
expect("dot ball total = 0", totalRunsForBall(shape({}) as any), 0);
expect("single total = 1", totalRunsForBall(shape({ runs_off_bat: 1 }) as any), 1);
expect("four total = 4", totalRunsForBall(shape({ runs_off_bat: 4 }) as any), 4);
expect("wide (1) total = 1", totalRunsForBall(shape({ extra_type: "wide", extra_runs: 1 }) as any), 1);
expect("wide + 4 boundary total = 5", totalRunsForBall(shape({ extra_type: "wide", extra_runs: 5 }) as any), 5);
expect("no-ball + 4 boundary total = 5", totalRunsForBall(shape({ extra_type: "no_ball", runs_off_bat: 4, extra_runs: 0 }) as any), 5);
expect("no-ball + 2 byes total = 3", totalRunsForBall(shape({ extra_type: "no_ball", runs_off_bat: 0, extra_runs: 2 }) as any), 3);
expect("bye 2 total = 2", totalRunsForBall(shape({ extra_type: "bye", extra_runs: 2 }) as any), 2);
expect("leg-bye 3 total = 3", totalRunsForBall(shape({ extra_type: "leg_bye", extra_runs: 3 }) as any), 3);
expect("penalty 5 total = 5", totalRunsForBall(shape({ extra_type: "penalty", extra_runs: 5 }) as any), 5);

/* ================================================================
 * Scenario 2 — Strike rotation (MCC Law 18)
 * ================================================================ */
section("Strike rotation");
expect("0 keeps strike", ballSwapsStrike(shape({}) as any), false);
expect("1 rotates", ballSwapsStrike(shape({ runs_off_bat: 1 }) as any), true);
expect("2 keeps", ballSwapsStrike(shape({ runs_off_bat: 2 }) as any), false);
expect("3 rotates", ballSwapsStrike(shape({ runs_off_bat: 3 }) as any), true);
expect("4 keeps", ballSwapsStrike(shape({ runs_off_bat: 4 }) as any), false);
expect("6 keeps", ballSwapsStrike(shape({ runs_off_bat: 6 }) as any), false);
expect("wide 1 (no run) keeps", ballSwapsStrike(shape({ extra_type: "wide", extra_runs: 1 }) as any), false);
expect("wide + 1 additional run rotates", ballSwapsStrike(shape({ extra_type: "wide", extra_runs: 2 }) as any), true);
expect("bye 1 rotates", ballSwapsStrike(shape({ extra_type: "bye", extra_runs: 1 }) as any), true);
expect("leg-bye 3 rotates", ballSwapsStrike(shape({ extra_type: "leg_bye", extra_runs: 3 }) as any), true);
expect("no-ball 0 keeps", ballSwapsStrike(shape({ extra_type: "no_ball", extra_runs: 0 }) as any), false);
expect("no-ball + 1 rotates", ballSwapsStrike(shape({ extra_type: "no_ball", runs_off_bat: 1, extra_runs: 0 }) as any), true);

/* ================================================================
 * Scenario 3 — Full 20-over innings, chase, tie, all-out
 * ================================================================ */
section("Full over: mixed extras + wicket + strike/over rotation");
{
  const b = new InningsBuilder("A", "B", "X");
  // Ball 1: single (A→B strike)
  b.run(1);
  // Ball 2: wide + 0 (illegal, no swap, no ball count)
  b.wide(1);
  // Ball 3: 4 (keep strike)
  b.run(4);
  // Ball 4: no-ball + 2 off bat (odd, swap; total 3 to team)
  b.noBall(2, 0);
  // Ball 5: 2 (keep)
  b.run(2);
  // Ball 6: bye 1 (rotate)
  b.bye(1);
  // Ball 7: dot
  b.run(0);
  // Ball 8: 6 (keep; over completes → auto swap next-over)
  b.run(6);

  const state = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10 });
  // runs = 1 + 1 + 4 + 3 + 2 + 1 + 0 + 6 = 18
  expect("total runs", state.innings.runs, 18);
  // legal deliveries = 6 (2 illegal: wide and no-ball)
  expect("legal balls", state.innings.legalBalls, 6);
  expect("overs completed", state.innings.overs, 1);
  expect("balls-in-over", state.innings.ballsInOver, 0);
  expect("await new bowler at over end", state.innings.awaitingNewBowler, true);
  // strike walk: A→B→B→B(after 4)→A(after no-ball odd)→A→B(after bye)→B(dot)→B(after six)→over-end swap→A
  expect("striker at over end", state.innings.striker.name, "B");
}

section("20-over innings target/completion");
{
  const b = new InningsBuilder("A", "B", "X");
  // Score exactly 120 in 20 overs: 20 overs × 6 dots then nudge — simplify:
  // 20 overs of (four+four+four+four+four+four) = 24 * 20 = 480. Instead let's
  // score 20 legal balls * 20 = we just want to hit overs_finished.
  // 20 overs of 6 dots = 0 runs, all-out impossible. Should trigger overs_finished.
  for (let o = 0; o < 20; o++) {
    for (let i = 0; i < 6; i++) b.run(0);
    b.setBowler(o % 2 === 0 ? "Y" : "X"); // alternate bowlers
  }
  const st = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10 });
  expect("20 overs completed", st.innings.overs, 20);
  expect("innings should end (overs_finished)", st.inningsShouldEnd, "overs_finished");
}

section("All out (10 wickets)");
{
  const b = new InningsBuilder("A", "B", "X");
  const bench = ["C", "D", "E", "F", "G", "H", "I", "J", "K"];
  for (let w = 0; w < 10; w++) {
    b.wicket("bowled", w === 0 ? "A" : bench[w - 1]);
    if (w < 9) b.setStriker(bench[w]); // send next batter
  }
  const st = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10 });
  expect("wickets = 10", st.innings.wickets, 10);
  expect("innings ends (all_out)", st.inningsShouldEnd, "all_out");
}

section("Chase — target achieved");
{
  const b = new InningsBuilder("A", "B", "X");
  b.run(6); b.run(6); b.run(6); b.run(6); b.run(6); b.run(6); // 36 in an over
  const st = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10, target: 30 });
  expect("target achieved", st.inningsShouldEnd, "target_achieved");
  expect("match should end", st.matchShouldEnd, true);
}

section("Tie signal — target = runs + 1 unreachable");
{
  const b = new InningsBuilder("A", "B", "X");
  // Bat out 20 balls-of dots to trigger overs_finished with runs < target
  for (let o = 0; o < 20; o++) for (let i = 0; i < 6; i++) b.run(0);
  const st = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10, target: 1 });
  // runs 0, target 1, overs done → not target_achieved
  expect("tie/loss signalled by overs_finished", st.inningsShouldEnd, "overs_finished");
  expect("required runs remains", st.requiredRuns, 1);
}

/* ================================================================
 * Scenario 4 — Statistics coherence
 * ================================================================ */
section("Statistics engine derives correctly");
{
  const b = new InningsBuilder("A", "B", "X");
  b.run(1); // A: 1, strike→B
  b.run(4); // B: 4
  b.run(6); // B: 6 (10 for B)
  b.wide(2); // 2 extras
  b.run(0);
  b.run(1); // B→A
  b.run(1); // A→B — over ends only after 6 legal
  b.run(0); // legal 7? wait, only 6 legal. Let me count: legal=1,2,3,4,5,6 → over ends after 7th line above.
  // Total legal so far: dot(1)+4(2)+6(3)+dot(4 after wide)+1(5)+1(6) — over ends. This extra ball would start over 1.

  const stats = computeInningsStatistics(b.events as any, {
    totalOvers: 20,
    maxWickets: 10,
  });
  const totalBatterRuns = stats.batting.ordered.reduce((s, x) => s + x.runs, 0);
  const totalExtras = stats.team.extras.total;
  expect("team total = batter runs + extras",
    stats.team.runs, totalBatterRuns + totalExtras);
  expect("legal balls in stats matches replay",
    stats.team.legalBalls, replayInnings(b.events as any, { totalOvers: 20 }).innings.legalBalls);
  const x = stats.bowling.ordered.find((r) => r.player.name === "X");
  expect("bowler X runs = team runs (single bowler)", x?.runs, stats.team.runs);
}

/* ================================================================
 * Scenario 5 — validateBallDraft rejects illegal states
 * ================================================================ */
section("validateBallDraft (rules)");
{
  const events: any[] = [];
  const stateFresh = replayInnings(events, { totalOvers: 20, maxWickets: 10 });
  const innings = { id: "i", status: "in_progress" } as any;
  // handled_ball is deprecated
  let threw = "";
  try {
    validateBallDraft(
      { strikerName: "A", bowlerName: "X", dismissalType: "handled_ball" as any },
      stateFresh,
      { innings, events, matchStatus: "in_progress" },
    );
  } catch (e: any) { threw = e.code; }
  expect("handled_ball rejected", threw, "DEPRECATED_DISMISSAL");

  // striker == non-striker
  threw = "";
  try {
    validateBallDraft(
      { strikerAthleteId: "p1", strikerName: "A", nonStrikerAthleteId: "p1", nonStrikerName: "A", bowlerName: "X" },
      stateFresh, { innings, events, matchStatus: "in_progress" },
    );
  } catch (e: any) { threw = e.code; }
  expect("duplicate striker rejected", threw, "DUPLICATE_STRIKER");

  // caught without fielder
  threw = "";
  try {
    validateBallDraft(
      { strikerName: "A", nonStrikerName: "B", bowlerName: "X", dismissalType: "caught" },
      stateFresh, { innings, events, matchStatus: "in_progress" },
    );
  } catch (e: any) { threw = e.code; }
  expect("caught requires fielder", threw, "FIELDER_REQUIRED");
}

/* ================================================================
 * Scenario 6 — Consecutive over rejection
 * ================================================================ */
section("Consecutive over rejection");
{
  const b = new InningsBuilder("A", "B", "X");
  for (let i = 0; i < 6; i++) b.run(0);
  // Now over 1 begins; awaitingNewBowler = true; same bowler must be rejected.
  const st = replayInnings(b.events as any, { totalOvers: 20, maxWickets: 10 });
  let threw = "";
  try {
    validateBallDraft(
      { strikerName: st.innings.striker.name!, nonStrikerName: st.innings.nonStriker.name!,
        bowlerAthleteId: "X", bowlerName: "X" },
      st, { innings: { id: "i", status: "in_progress" } as any, events: b.events as any },
    );
  } catch (e: any) { threw = e.code; }
  expect("same bowler consecutive over rejected", threw, "CONSECUTIVE_OVERS");
}

/* ================================================================
 * Scenario 7 — applyStrikeAfterBall parity with replay
 * ================================================================ */
section("applyStrikeAfterBall parity with replay");
{
  const b = new InningsBuilder("A", "B", "X");
  b.run(1); b.run(2); b.run(3); b.run(4); b.run(6);
  // apply-strike vs replay walk
  let s = { striker: { athleteId: null, name: "A" }, nonStriker: { athleteId: null, name: "B" } };
  const legalPerOver: number[] = [];
  let curLegal = 0;
  for (const e of b.events) {
    if (e.is_legal_delivery) curLegal++;
    const overDone = e.is_legal_delivery && curLegal >= 6;
    s = applyStrikeAfterBall(s as any, e as any, overDone) as any;
    if (overDone) { legalPerOver.push(curLegal); curLegal = 0; }
  }
  const st = replayInnings(b.events as any, { totalOvers: 20 });
  expect("striker parity", s.striker.name, st.innings.striker.name);
  expect("non-striker parity", s.nonStriker.name, st.innings.nonStriker.name);
}

/* ================================================================
 * Summary
 * ================================================================ */
console.log(`\n────────────────────────────────────────`);
console.log(`  Simulation complete: ${PASS} passed, ${FAIL} failed`);
if (FAIL > 0) process.exit(1);
