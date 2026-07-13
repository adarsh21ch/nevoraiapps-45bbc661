/* ================================================================
 * Cricket Rules Engine (Replay Engine)
 * ----------------------------------------------------------------
 * Pure, deterministic reconstruction of match state from the
 * immutable `mc_ball_events` log. NO statistics are stored or
 * calculated here — only state:
 *   - current score / wickets / overs / balls
 *   - current batters + strike
 *   - current bowler
 *   - over progression + maiden flag
 *   - innings/match progression signals
 *
 * All rules follow the current MCC Laws of Cricket. "Handled the
 * ball" is intentionally omitted — under the modern laws it is
 * subsumed by "Obstructing the field".
 * ================================================================ */

import type {
  DismissalType,
  ExtraType,
  MCBallEvent,
  MCInnings,
} from "@/lib/mc-ball-events";
import { BallEventError, isLegalDelivery } from "@/lib/mc-ball-events-core";

/* ---------------- Modern dismissal set (MCC Laws) ---------------- */

export const MODERN_DISMISSALS: readonly DismissalType[] = [
  "bowled",
  "caught",
  "lbw",
  "run_out",
  "stumped",
  "hit_wicket",
  "retired_hurt",
  "retired_out",
  "timed_out",
  "obstructing_field",
  "hit_ball_twice",
] as const;

/** Dismissals that count against the batting side (wicket falls). */
const WICKET_COUNTS: readonly DismissalType[] = [
  "bowled",
  "caught",
  "lbw",
  "run_out",
  "stumped",
  "hit_wicket",
  "retired_out",
  "timed_out",
  "obstructing_field",
  "hit_ball_twice",
] as const;

/** Dismissals credited to the bowler (for future stats engine). */
const BOWLER_CREDITED: readonly DismissalType[] = [
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit_wicket",
] as const;

export function isWicketDismissal(d: DismissalType | null | undefined): boolean {
  if (!d) return false;
  return (WICKET_COUNTS as readonly string[]).includes(d);
}

export function isBowlerCredited(d: DismissalType | null | undefined): boolean {
  if (!d) return false;
  return (BOWLER_CREDITED as readonly string[]).includes(d);
}

/* ---------------- Runs / extras semantics ---------------- */

/**
 * Total runs added to the batting-team score for a ball event.
 * Rules:
 *  - Wide  : 1 penalty + any additional wide-runs (extraRuns already includes the 1).
 *  - No-ball: 1 penalty + off-bat runs.
 *  - Bye / Leg-bye / Penalty: extraRuns (off-bat is 0).
 *  - Legal delivery: off-bat runs.
 */
export function totalRunsForBall(e: MCBallEvent): number {
  const off = e.runs_off_bat ?? 0;
  const ex = e.extra_runs ?? 0;
  const type = e.extra_type as ExtraType | null;
  if (type === "wide") return ex; // extraRuns already accounts for the 1
  if (type === "no_ball") return 1 + off + ex;
  if (type === "bye" || type === "leg_bye" || type === "penalty")
    return off + ex;
  return off;
}

/**
 * Does this ball rotate strike? Follows MCC Law 18.
 *  - Odd runs (whether off-bat, bye, leg-bye) swap strike.
 *  - Wides: swap if the "run" component (extras beyond the 1 penalty) is odd,
 *    since additional wides are actually run.
 *  - No-balls: off-bat + bye/leg-bye runs — odd swaps strike.
 *  - Boundary 4/6 keeps strike (even runs).
 *  - End of over is handled separately.
 */
export function ballSwapsStrike(e: MCBallEvent): boolean {
  const type = e.extra_type as ExtraType | null;
  const off = e.runs_off_bat ?? 0;
  const ex = e.extra_runs ?? 0;
  if (type === "wide") {
    // ex includes the 1 penalty; running component = ex - 1
    return Math.max(0, ex - 1) % 2 === 1;
  }
  if (type === "no_ball") {
    return (off + Math.max(0, ex)) % 2 === 1;
  }
  // legal delivery, or bye/leg_bye
  return (off + ex) % 2 === 1;
}

/* ---------------- Reconstructed state ---------------- */

export interface CurrentPlayerRef {
  athleteId: string | null;
  name: string | null;
}

export interface OverSummary {
  overNumber: number;
  bowlerAthleteId: string | null;
  bowlerName: string | null;
  legalBalls: number;
  runsConceded: number; // for maiden detection only — not stored as stat
  isMaiden: boolean;
  completed: boolean;
  events: MCBallEvent[];
}

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number; // total legal deliveries
  overs: number; // completed overs
  ballsInOver: number; // legal balls in the in-progress over (0..5)
  overDisplay: string; // e.g. "12.3"

  striker: CurrentPlayerRef;
  nonStriker: CurrentPlayerRef;
  bowler: CurrentPlayerRef;

  strikeSwapPending: boolean; // set after over-end; UI shows swap in next ball
  awaitingNewBatter: boolean;
  awaitingNewBowler: boolean;

  completedOvers: OverSummary[];
  currentOver: OverSummary | null;
  dismissedIds: Set<string>;
  dismissedNames: Set<string>;
}

export interface MatchState {
  innings: InningsState;
  /** Extra info for chases. */
  target: number | null;
  requiredRuns: number | null;
  ballsRemaining: number | null;
  /** Completion signal — the UI decides whether to confirm end-of-innings. */
  inningsShouldEnd:
    | null
    | "all_out"
    | "overs_finished"
    | "target_achieved";
  matchShouldEnd: boolean;
}

/* ---------------- Replay ---------------- */

export interface ReplayOptions {
  /** Total overs in the innings, if known (limited-overs). */
  totalOvers?: number | null;
  /** Wickets before "all out" (default 10). */
  maxWickets?: number;
  /** Target for a chase. */
  target?: number | null;
}

/**
 * Replay a full innings from its event log. Deterministic and pure.
 * Complexity: O(n) over events.
 */
export function replayInnings(
  events: MCBallEvent[],
  opts: ReplayOptions = {},
): MatchState {
  const maxWickets = opts.maxWickets ?? 10;
  const totalOvers = opts.totalOvers ?? null;

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  // strike/nonstrike/bowler tracked from event fields (they encode the
  // scorer's chosen line-up at the moment the ball was delivered).
  let striker: CurrentPlayerRef = { athleteId: null, name: null };
  let nonStriker: CurrentPlayerRef = { athleteId: null, name: null };
  let bowler: CurrentPlayerRef = { athleteId: null, name: null };

  let awaitingNewBatter = false;
  let awaitingNewBowler = false;
  let strikeSwapPending = false;

  const completed: OverSummary[] = [];
  const dismissedIds = new Set<string>();
  const dismissedNames = new Set<string>();

  let curOverNum = 0;
  let curOverEvents: MCBallEvent[] = [];
  let curOverRuns = 0;
  let curOverLegal = 0;
  let curOverHadBoundary = false;
  let curOverBowlerId: string | null = null;
  let curOverBowlerName: string | null = null;

  const flushOver = (finished: boolean) => {
    if (curOverEvents.length === 0 && !finished) return;
    const summary: OverSummary = {
      overNumber: curOverNum,
      bowlerAthleteId: curOverBowlerId,
      bowlerName: curOverBowlerName,
      legalBalls: curOverLegal,
      runsConceded: curOverRuns,
      isMaiden:
        finished && curOverLegal === 6 && curOverRuns === 0 && !curOverHadBoundary,
      completed: finished,
      events: curOverEvents.slice(),
    };
    if (finished) completed.push(summary);
    return summary;
  };

  for (const e of events) {
    // Track current bowler/striker from event (source of truth per-ball).
    if (e.striker_athlete_id || e.striker_name)
      striker = { athleteId: e.striker_athlete_id, name: e.striker_name };
    if (e.non_striker_athlete_id || e.non_striker_name)
      nonStriker = {
        athleteId: e.non_striker_athlete_id,
        name: e.non_striker_name,
      };
    if (e.bowler_athlete_id || e.bowler_name)
      bowler = { athleteId: e.bowler_athlete_id, name: e.bowler_name };

    // New over? flush previous.
    if (e.over_number !== curOverNum && curOverEvents.length > 0) {
      flushOver(true);
      curOverEvents = [];
      curOverRuns = 0;
      curOverLegal = 0;
      curOverHadBoundary = false;
    }
    curOverNum = e.over_number;
    curOverBowlerId = e.bowler_athlete_id;
    curOverBowlerName = e.bowler_name;
    curOverEvents.push(e);

    const total = totalRunsForBall(e);
    runs += total;
    curOverRuns += total;

    const legal = isLegalDelivery(e.extra_type as ExtraType | null);
    if (legal) {
      legalBalls += 1;
      curOverLegal += 1;
    }

    // Boundary detection (only off-bat 4/6 disqualifies a maiden by MCC law;
    // byes/leg-byes to the boundary do NOT disqualify — but we keep the
    // stricter rule that any 4+ conceded breaks a maiden, which is standard).
    if ((e.runs_off_bat ?? 0) >= 4) curOverHadBoundary = true;

    // Wicket accounting
    const dt = e.dismissal_type as DismissalType | null;
    if (isWicketDismissal(dt)) {
      wickets += 1;
      if (e.dismissed_athlete_id) dismissedIds.add(e.dismissed_athlete_id);
      if (e.dismissed_name) dismissedNames.add(e.dismissed_name);
      awaitingNewBatter = true;
    } else if (dt === "retired_hurt") {
      // Not a wicket, but the batter leaves; scorer must send a replacement.
      awaitingNewBatter = true;
    }

    // Strike rotation (per-ball). End-of-over swap handled after loop tail.
    if (ballSwapsStrike(e)) {
      const s = striker;
      striker = nonStriker;
      nonStriker = s;
    }

    // Over completion: 6 legal deliveries → swap strike + require new bowler.
    if (curOverLegal >= 6) {
      flushOver(true);
      // End-of-over strike swap
      const s = striker;
      striker = nonStriker;
      nonStriker = s;
      strikeSwapPending = false;
      awaitingNewBowler = true;
      curOverEvents = [];
      curOverRuns = 0;
      curOverLegal = 0;
      curOverHadBoundary = false;
      curOverNum = e.over_number + 1;
      curOverBowlerId = null;
      curOverBowlerName = null;
    } else {
      awaitingNewBowler = false;
    }
  }

  // In-progress over summary (not yet completed)
  const currentOver: OverSummary | null =
    curOverEvents.length > 0
      ? {
          overNumber: curOverNum,
          bowlerAthleteId: curOverBowlerId,
          bowlerName: curOverBowlerName,
          legalBalls: curOverLegal,
          runsConceded: curOverRuns,
          isMaiden: false,
          completed: false,
          events: curOverEvents.slice(),
        }
      : null;

  const overs = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;
  const overDisplay = `${overs}.${ballsInOver}`;

  // Completion signals
  const target = opts.target ?? null;
  let requiredRuns: number | null = null;
  let ballsRemaining: number | null = null;
  if (target != null) {
    requiredRuns = Math.max(0, target - runs);
    if (totalOvers != null) {
      ballsRemaining = Math.max(0, totalOvers * 6 - legalBalls);
    }
  }

  let inningsShouldEnd: MatchState["inningsShouldEnd"] = null;
  if (wickets >= maxWickets) inningsShouldEnd = "all_out";
  else if (totalOvers != null && legalBalls >= totalOvers * 6)
    inningsShouldEnd = "overs_finished";
  else if (target != null && runs >= target) inningsShouldEnd = "target_achieved";

  const matchShouldEnd =
    inningsShouldEnd === "target_achieved" ||
    (inningsShouldEnd != null && target != null);

  const innings: InningsState = {
    runs,
    wickets,
    legalBalls,
    overs,
    ballsInOver,
    overDisplay,
    striker,
    nonStriker,
    bowler,
    strikeSwapPending,
    awaitingNewBatter: awaitingNewBatter && inningsShouldEnd == null,
    awaitingNewBowler: awaitingNewBowler && inningsShouldEnd == null,
    completedOvers: completed,
    currentOver,
    dismissedIds,
    dismissedNames,
  };

  return {
    innings,
    target,
    requiredRuns,
    ballsRemaining,
    inningsShouldEnd,
    matchShouldEnd,
  };
}

/* ---------------- Validation (pre-submit) ---------------- */

export interface BallDraft {
  strikerAthleteId?: string | null;
  strikerName?: string | null;
  nonStrikerAthleteId?: string | null;
  nonStrikerName?: string | null;
  bowlerAthleteId?: string | null;
  bowlerName?: string | null;

  runsOffBat?: number;
  extraType?: ExtraType | null;
  extraRuns?: number;

  dismissalType?: DismissalType | null;
  dismissedAthleteId?: string | null;
  dismissedName?: string | null;
  fielderAthleteId?: string | null;
  fielderName?: string | null;
}

/**
 * Validate a proposed ball against reconstructed state. Throws BallEventError.
 * Rules covered:
 *  - Handled ball is rejected (use obstructing_field per modern laws).
 *  - Cannot bat/bowl if state disallows (awaiting new batter/bowler).
 *  - Same bowler cannot bowl consecutive overs.
 *  - Same player cannot be striker & non-striker.
 *  - Cannot re-dismiss a player.
 *  - Runs / extras non-negative and within cricket-plausible ranges.
 *  - Certain dismissals require a fielder / dismissed player.
 */
export function validateBallDraft(
  draft: BallDraft,
  state: MatchState,
  ctx: {
    innings: MCInnings | null;
    events: MCBallEvent[];
    matchStatus?: string | null;
  },
): void {
  if (!ctx.innings)
    throw new BallEventError("INVALID_INNINGS", "Start an innings first.");
  if (ctx.innings.status !== "in_progress")
    throw new BallEventError("INNINGS_CLOSED", "Innings is not in progress.");
  if (ctx.matchStatus === "completed" || ctx.matchStatus === "archived")
    throw new BallEventError("MATCH_COMPLETED", "Match is no longer active.");

  // Deprecated dismissal
  const dt = draft.dismissalType ?? null;
  if ((dt as unknown as string) === "handled_ball")
    throw new BallEventError(
      "DEPRECATED_DISMISSAL",
      "'Handled the ball' is no longer a distinct dismissal under MCC Laws. Use 'Obstructing the field'.",
    );
  if (dt && !(MODERN_DISMISSALS as readonly string[]).includes(dt))
    throw new BallEventError(
      "INVALID_DISMISSAL",
      `Unsupported dismissal type: ${dt}.`,
    );

  // Batters
  if (!draft.strikerAthleteId && !draft.strikerName)
    throw new BallEventError("NO_STRIKER", "Striker is required.");
  if (!draft.bowlerAthleteId && !draft.bowlerName)
    throw new BallEventError("NO_BOWLER", "Bowler is required.");
  if (
    draft.strikerAthleteId &&
    draft.strikerAthleteId === draft.nonStrikerAthleteId
  )
    throw new BallEventError(
      "DUPLICATE_STRIKER",
      "Striker and non-striker must differ.",
    );

  // Runs / extras sanity
  const off = draft.runsOffBat ?? 0;
  const ex = draft.extraRuns ?? 0;
  if (off < 0 || off > 7)
    throw new BallEventError("INVALID_RUNS", "Runs off bat out of range.");
  if (ex < 0 || ex > 10)
    throw new BallEventError("INVALID_EXTRAS", "Extras out of range.");

  // State-based rules
  if (state.innings.awaitingNewBatter)
    throw new BallEventError(
      "AWAITING_NEW_BATTER",
      "Select the incoming batter before continuing.",
    );
  if (state.innings.awaitingNewBowler) {
    // A new bowler must be assigned. Verify he isn't the previous over's bowler.
    const prevOver =
      state.innings.completedOvers[state.innings.completedOvers.length - 1];
    if (
      prevOver &&
      draft.bowlerAthleteId &&
      prevOver.bowlerAthleteId &&
      draft.bowlerAthleteId === prevOver.bowlerAthleteId
    )
      throw new BallEventError(
        "CONSECUTIVE_OVERS",
        "The same bowler cannot bowl consecutive overs.",
      );
  }

  // Cannot re-dismiss
  if (isWicketDismissal(dt)) {
    if (draft.dismissedAthleteId) {
      if (state.innings.dismissedIds.has(draft.dismissedAthleteId))
        throw new BallEventError(
          "DUPLICATE_WICKET",
          "This batter is already dismissed.",
        );
    } else if (draft.dismissedName) {
      if (state.innings.dismissedNames.has(draft.dismissedName))
        throw new BallEventError(
          "DUPLICATE_WICKET",
          "This batter is already dismissed.",
        );
    }
    // Caught / run-out / stumped need a fielder
    if (
      (dt === "caught" || dt === "run_out" || dt === "stumped") &&
      !draft.fielderAthleteId &&
      !draft.fielderName
    )
      throw new BallEventError(
        "FIELDER_REQUIRED",
        `${dt.replace("_", " ")} requires a fielder.`,
      );
  }

  // Innings/match completion
  if (state.inningsShouldEnd)
    throw new BallEventError(
      "INNINGS_ENDED",
      "This innings is complete — close it before scoring more balls.",
    );
}

/* ---------------- Strike helper for the UI ---------------- */

/**
 * Given the *pre-ball* striker/non-striker and a submitted event, return the
 * *post-ball* pair, including end-of-over swap. This mirrors what the replay
 * engine derives and is exported so the scoring UI can update its local
 * "who's on strike" pointer immediately after submit, without a full replay.
 */
export function applyStrikeAfterBall(
  pre: { striker: CurrentPlayerRef; nonStriker: CurrentPlayerRef },
  e: MCBallEvent,
  overCompleted: boolean,
): { striker: CurrentPlayerRef; nonStriker: CurrentPlayerRef } {
  let { striker, nonStriker } = pre;
  if (ballSwapsStrike(e)) {
    const s = striker;
    striker = nonStriker;
    nonStriker = s;
  }
  if (overCompleted) {
    const s = striker;
    striker = nonStriker;
    nonStriker = s;
  }
  return { striker, nonStriker };
}

/* ---------------- Replay a full match (all innings) ---------------- */

export interface MatchReplay {
  perInnings: Map<string, MatchState>;
  currentInningsId: string | null;
  matchShouldEnd: boolean;
}

export function replayMatch(
  innings: MCInnings[],
  eventsByInnings: Record<string, MCBallEvent[]>,
  opts: { totalOvers?: number | null; maxWickets?: number } = {},
): MatchReplay {
  const map = new Map<string, MatchState>();
  let currentInningsId: string | null = null;
  let matchShouldEnd = false;

  const sorted = [...innings].sort(
    (a, b) => (a.innings_number ?? 0) - (b.innings_number ?? 0),
  );
  for (const inn of sorted) {
    const evs = eventsByInnings[inn.id] ?? [];
    const state = replayInnings(evs, {
      totalOvers: opts.totalOvers ?? null,
      maxWickets: opts.maxWickets ?? 10,
      target: inn.target ?? null,
    });
    map.set(inn.id, state);
    if (inn.status === "in_progress") currentInningsId = inn.id;
    if (state.inningsShouldEnd === "target_achieved") matchShouldEnd = true;
  }

  return { perInnings: map, currentInningsId, matchShouldEnd };
}
