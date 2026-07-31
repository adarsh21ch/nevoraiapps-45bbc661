import { describe, it, expect } from "vitest";
import type { MCBallEvent, MCInnings } from "./mc-ball-events";
import {
  totalRunsForBall,
  batterRunsForStrike,
  bowlerRunsForBall,
  ballSwapsStrike,
  dismissalAllowedOnDelivery,
  maxOversPerBowler,
  replayInnings,
  validateBallDraft,
  type BallDraft,
} from "./mc-rules-engine";

/* ================================================================
 * Regression suite for the scoring engine (MCC Laws + ICC T20).
 * These tests lock the behaviour that the live scorer, the public
 * scorecard and every career/statistics cache depend on. If one of
 * them fails, player records will be wrong — fix the engine, never
 * the expectation, unless the Laws themselves changed.
 * ============================================================== */

let seq = 0;

/** Minimal ball event. Only the fields the rules engine reads matter. */
function ball(partial: Partial<MCBallEvent> = {}): MCBallEvent {
  seq += 1;
  return {
    id: `b${seq}`,
    over_number: 0,
    ball_number: seq,
    runs_off_bat: 0,
    extra_type: null,
    extra_runs: 0,
    dismissal_type: null,
    dismissed_athlete_id: null,
    dismissed_name: null,
    striker_athlete_id: null,
    striker_name: "A",
    non_striker_athlete_id: null,
    non_striker_name: "B",
    bowler_athlete_id: null,
    bowler_name: "Bowler 1",
    ...partial,
  } as unknown as MCBallEvent;
}

/** Build a sequence of legal deliveries for one over. */
function over(overNumber: number, balls: Partial<MCBallEvent>[]): MCBallEvent[] {
  return balls.map((b) => ball({ over_number: overNumber, ...b }));
}

const innings = { status: "in_progress" } as unknown as MCInnings;

/* ---------------- Runs semantics ---------------- */

describe("runs semantics (Law 17 / 21 / 22)", () => {
  it("legal delivery: off-bat runs count everywhere", () => {
    const e = ball({ runs_off_bat: 4 });
    expect(totalRunsForBall(e)).toBe(4);
    expect(batterRunsForStrike(e)).toBe(4);
    expect(bowlerRunsForBall(e)).toBe(4);
  });

  it("wide: full value charged to the team and the bowler; penalty is not run", () => {
    const e = ball({ extra_type: "wide", extra_runs: 3 });
    expect(totalRunsForBall(e)).toBe(3);
    expect(bowlerRunsForBall(e)).toBe(3);
    expect(batterRunsForStrike(e)).toBe(2); // 3 − the 1-run wide penalty
  });

  it("no ball: penalty + off-bat to team and bowler; only off-bat is run", () => {
    const e = ball({ extra_type: "no_ball", runs_off_bat: 4 });
    expect(totalRunsForBall(e)).toBe(5);
    expect(bowlerRunsForBall(e)).toBe(5);
    expect(batterRunsForStrike(e)).toBe(4);
  });

  it("byes and leg-byes score for the team but are NOT charged to the bowler", () => {
    for (const type of ["bye", "leg_bye"] as const) {
      const e = ball({ extra_type: type, extra_runs: 2 });
      expect(totalRunsForBall(e)).toBe(2);
      expect(bowlerRunsForBall(e)).toBe(0);
      expect(batterRunsForStrike(e)).toBe(2);
    }
  });

  it("5-run penalty: team only, nobody runs, bowler not charged", () => {
    const e = ball({ extra_type: "penalty", extra_runs: 5 });
    expect(totalRunsForBall(e)).toBe(5);
    expect(bowlerRunsForBall(e)).toBe(0);
    expect(batterRunsForStrike(e)).toBe(0);
  });
});

/* ---------------- Strike rotation ---------------- */

describe("strike rotation (Law 18 / Law 33.6)", () => {
  it("odd completed runs rotate strike, even runs do not", () => {
    expect(ballSwapsStrike(ball({ runs_off_bat: 1 }))).toBe(true);
    expect(ballSwapsStrike(ball({ runs_off_bat: 3 }))).toBe(true);
    expect(ballSwapsStrike(ball({ runs_off_bat: 0 }))).toBe(false);
    expect(ballSwapsStrike(ball({ runs_off_bat: 2 }))).toBe(false);
    expect(ballSwapsStrike(ball({ runs_off_bat: 4 }))).toBe(false);
    expect(ballSwapsStrike(ball({ runs_off_bat: 6 }))).toBe(false);
  });

  it("a single-run wide (penalty only) does NOT rotate strike", () => {
    expect(ballSwapsStrike(ball({ extra_type: "wide", extra_runs: 1 }))).toBe(false);
    // 1 penalty + 1 run = strike rotates
    expect(ballSwapsStrike(ball({ extra_type: "wide", extra_runs: 2 }))).toBe(true);
  });

  it("byes and leg-byes rotate strike on odd runs — the batters ran them", () => {
    expect(ballSwapsStrike(ball({ extra_type: "leg_bye", extra_runs: 1 }))).toBe(true);
    expect(ballSwapsStrike(ball({ extra_type: "bye", extra_runs: 2 }))).toBe(false);
  });

  it("2022 Caught rule: incoming batter always takes strike, so caught never rotates", () => {
    expect(ballSwapsStrike(ball({ runs_off_bat: 1, dismissal_type: "caught" }))).toBe(false);
    expect(ballSwapsStrike(ball({ runs_off_bat: 0, dismissal_type: "caught" }))).toBe(false);
  });

  it("swaps strike at the end of a completed over", () => {
    const st = replayInnings(over(0, Array.from({ length: 6 }, () => ({ runs_off_bat: 0 }))));
    expect(st.innings.striker.name).toBe("B");
    expect(st.innings.nonStriker.name).toBe("A");
    expect(st.innings.awaitingNewBowler).toBe(true);
  });
});

/* ---------------- Maiden overs ---------------- */

describe("maiden overs (Law 17.4)", () => {
  const sixDots = Array.from({ length: 6 }, () => ({ runs_off_bat: 0 }));

  it("six dot balls is a maiden", () => {
    const st = replayInnings(over(0, sixDots));
    expect(st.innings.completedOvers[0].isMaiden).toBe(true);
  });

  it("byes and leg-byes do NOT break a maiden", () => {
    const st = replayInnings(
      over(0, [{ extra_type: "bye", extra_runs: 4 }, ...sixDots.slice(1)]),
    );
    expect(st.innings.runs).toBe(4);
    expect(st.innings.completedOvers[0].isMaiden).toBe(true);
  });

  it("a wide breaks a maiden", () => {
    const st = replayInnings(over(0, [{ extra_type: "wide", extra_runs: 1 }, ...sixDots]));
    expect(st.innings.completedOvers[0].isMaiden).toBe(false);
  });

  it("a no ball breaks a maiden", () => {
    const st = replayInnings(over(0, [{ extra_type: "no_ball" }, ...sixDots]));
    expect(st.innings.completedOvers[0].isMaiden).toBe(false);
  });

  it("a single off the bat breaks a maiden", () => {
    const st = replayInnings(over(0, [{ runs_off_bat: 1 }, ...sixDots.slice(1)]));
    expect(st.innings.completedOvers[0].isMaiden).toBe(false);
  });
});

/* ---------------- Legal-ball counting ---------------- */

describe("legal ball counting", () => {
  it("wides and no balls do not count as legal deliveries", () => {
    const st = replayInnings(
      over(0, [
        { extra_type: "wide", extra_runs: 1 },
        { extra_type: "no_ball", runs_off_bat: 2 },
        { runs_off_bat: 1 },
      ]),
    );
    expect(st.innings.legalBalls).toBe(1);
    expect(st.innings.overDisplay).toBe("0.1");
    expect(st.innings.runs).toBe(1 + 3 + 1);
  });

  it("an over ends only after six legal deliveries", () => {
    const st = replayInnings(
      over(0, [
        { extra_type: "wide", extra_runs: 1 },
        ...Array.from({ length: 6 }, () => ({ runs_off_bat: 0 })),
      ]),
    );
    expect(st.innings.completedOvers).toHaveLength(1);
    expect(st.innings.legalBalls).toBe(6);
  });
});

/* ---------------- Free hit ---------------- */

describe("free hit (Law 21.18 / ICC T20)", () => {
  it("a no ball arms the free hit for the next delivery", () => {
    const st = replayInnings(over(0, [{ extra_type: "no_ball" }]));
    expect(st.innings.freeHit).toBe(true);
  });

  it("a wide does not consume the free hit", () => {
    const st = replayInnings(
      over(0, [{ extra_type: "no_ball" }, { extra_type: "wide", extra_runs: 1 }]),
    );
    expect(st.innings.freeHit).toBe(true);
  });

  it("a legal delivery consumes the free hit", () => {
    const st = replayInnings(over(0, [{ extra_type: "no_ball" }, { runs_off_bat: 1 }]));
    expect(st.innings.freeHit).toBe(false);
  });

  it("only run out style dismissals are possible off a no ball or free hit", () => {
    expect(dismissalAllowedOnDelivery("bowled", "no_ball")).toBe(false);
    expect(dismissalAllowedOnDelivery("caught", "no_ball")).toBe(false);
    expect(dismissalAllowedOnDelivery("lbw", null, true)).toBe(false);
    expect(dismissalAllowedOnDelivery("run_out", "no_ball")).toBe(true);
    expect(dismissalAllowedOnDelivery("run_out", null, true)).toBe(true);
    expect(dismissalAllowedOnDelivery("obstructing_field", null, true)).toBe(true);
  });

  it("stumped and hit wicket are possible off a wide but bowled is not", () => {
    expect(dismissalAllowedOnDelivery("stumped", "wide")).toBe(true);
    expect(dismissalAllowedOnDelivery("hit_wicket", "wide")).toBe(true);
    expect(dismissalAllowedOnDelivery("bowled", "wide")).toBe(false);
    expect(dismissalAllowedOnDelivery("caught", "wide")).toBe(false);
  });
});

/* ---------------- Wickets and innings end ---------------- */

describe("wickets and innings completion", () => {
  it("counts wickets and requires a new batter", () => {
    const st = replayInnings(
      over(0, [{ dismissal_type: "bowled", dismissed_name: "A" }]),
    );
    expect(st.innings.wickets).toBe(1);
    expect(st.innings.awaitingNewBatter).toBe(true);
    expect(st.innings.dismissedNames.has("A")).toBe(true);
  });

  it("retired hurt is not a wicket but still needs a replacement batter", () => {
    const st = replayInnings(
      over(0, [{ dismissal_type: "retired_hurt", dismissed_name: "A" }]),
    );
    expect(st.innings.wickets).toBe(0);
    expect(st.innings.awaitingNewBatter).toBe(true);
  });

  it("signals all out at the wicket limit", () => {
    const st = replayInnings(
      over(0, [
        { dismissal_type: "bowled", dismissed_name: "A" },
        { dismissal_type: "bowled", dismissed_name: "C" },
      ]),
      { maxWickets: 2 },
    );
    expect(st.inningsShouldEnd).toBe("all_out");
  });

  it("signals target achieved in a chase", () => {
    const st = replayInnings(over(0, [{ runs_off_bat: 6 }]), { target: 5, totalOvers: 20 });
    expect(st.inningsShouldEnd).toBe("target_achieved");
    expect(st.requiredRuns).toBe(0);
    expect(st.matchShouldEnd).toBe(true);
  });

  it("signals overs finished when the quota of legal balls is used", () => {
    const st = replayInnings(over(0, Array.from({ length: 6 }, () => ({ runs_off_bat: 0 }))), {
      totalOvers: 1,
    });
    expect(st.inningsShouldEnd).toBe("overs_finished");
  });
});

/* ---------------- Bowler quota ---------------- */

describe("bowler over quota (ICC: a fifth of the innings)", () => {
  it("computes the quota, rounding up", () => {
    expect(maxOversPerBowler(20)).toBe(4);
    expect(maxOversPerBowler(50)).toBe(10);
    expect(maxOversPerBowler(10)).toBe(2);
    expect(maxOversPerBowler(8)).toBe(2);
    expect(maxOversPerBowler(null)).toBeNull();
  });

  it("tracks legal balls per bowler, including guest (name-only) bowlers", () => {
    const st = replayInnings([
      ...over(0, Array.from({ length: 6 }, () => ({ bowler_name: "Guest Bowler" }))),
      ...over(1, [{ bowler_name: "Other" }]),
    ]);
    expect(st.innings.bowlerLegalBalls.get("name:guest bowler")).toBe(6);
    expect(st.innings.bowlerLegalBalls.get("name:other")).toBe(1);
  });
});

/* ---------------- Validation ---------------- */

describe("validateBallDraft guards", () => {
  const emptyState = replayInnings([]);
  const base: BallDraft = { strikerName: "A", nonStrikerName: "B", bowlerName: "Bowler 1" };
  const ctx = { innings, events: [] as MCBallEvent[], matchStatus: "live", totalOvers: 20 };

  it("accepts a plain legal delivery", () => {
    expect(() => validateBallDraft({ ...base, runsOffBat: 1 }, emptyState, ctx)).not.toThrow();
  });

  it("rejects scoring when no innings is open", () => {
    expect(() => validateBallDraft(base, emptyState, { ...ctx, innings: null })).toThrow();
  });

  it("rejects scoring on a completed match", () => {
    expect(() =>
      validateBallDraft(base, emptyState, { ...ctx, matchStatus: "completed" }),
    ).toThrow();
  });

  it("rejects the deprecated 'handled the ball' dismissal", () => {
    expect(() =>
      validateBallDraft(
        { ...base, dismissalType: "handled_ball" as never },
        emptyState,
        ctx,
      ),
    ).toThrow();
  });

  it("rejects an impossible dismissal off a no ball", () => {
    expect(() =>
      validateBallDraft({ ...base, extraType: "no_ball", dismissalType: "bowled" }, emptyState, ctx),
    ).toThrow();
  });

  it("rejects a bowled dismissal on a free hit", () => {
    const freeHitState = replayInnings(over(0, [{ extra_type: "no_ball" }]));
    expect(freeHitState.innings.freeHit).toBe(true);
    expect(() =>
      validateBallDraft({ ...base, dismissalType: "bowled" }, freeHitState, ctx),
    ).toThrow();
    expect(() =>
      validateBallDraft({ ...base, dismissalType: "run_out", dismissedName: "A" }, freeHitState, ctx),
    ).not.toThrow();
  });

  it("requires a striker and a bowler", () => {
    expect(() =>
      validateBallDraft({ nonStrikerName: "B", bowlerName: "X" }, emptyState, ctx),
    ).toThrow();
    expect(() =>
      validateBallDraft({ strikerName: "A", nonStrikerName: "B" }, emptyState, ctx),
    ).toThrow();
  });

  it("rejects the same player as striker and non-striker", () => {
    expect(() =>
      validateBallDraft(
        { strikerAthleteId: "p1", nonStrikerAthleteId: "p1", bowlerName: "X" },
        emptyState,
        ctx,
      ),
    ).toThrow();
  });

  it("rejects out-of-range runs and extras", () => {
    expect(() => validateBallDraft({ ...base, runsOffBat: -1 }, emptyState, ctx)).toThrow();
    expect(() => validateBallDraft({ ...base, runsOffBat: 99 }, emptyState, ctx)).toThrow();
    expect(() => validateBallDraft({ ...base, extraRuns: -1 }, emptyState, ctx)).toThrow();
    expect(() => validateBallDraft({ ...base, extraRuns: 99 }, emptyState, ctx)).toThrow();
  });

  it("rejects continuing with a dismissed batter still at the crease", () => {
    const wicketState = replayInnings(
      over(0, [{ dismissal_type: "bowled", dismissed_name: "A", striker_name: "A" }]),
    );
    expect(wicketState.innings.awaitingNewBatter).toBe(true);
    expect(() =>
      validateBallDraft({ strikerName: "A", nonStrikerName: "B", bowlerName: "Bowler 1" }, wicketState, ctx),
    ).toThrow();
    expect(() =>
      validateBallDraft({ strikerName: "C", nonStrikerName: "B", bowlerName: "Bowler 1" }, wicketState, ctx),
    ).not.toThrow();
  });
});
