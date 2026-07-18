/* ================================================================
 * Rule-based commentary generator
 * ----------------------------------------------------------------
 * Pure function. Turns a Ball Event into a short human line. No AI.
 * ================================================================ */

import type { DismissalType, ExtraType, MCBallEvent } from "@/lib/mc-ball-events";

const DISMISSAL_PHRASE: Record<string, string> = {
  bowled: "is bowled",
  caught: "is caught",
  lbw: "is out LBW",
  run_out: "is run out",
  stumped: "is stumped",
  hit_wicket: "is out — hit wicket",
  retired_hurt: "retires hurt",
  retired_out: "retired out",
  timed_out: "is timed out",
  obstructing_field: "is out — obstructing the field",
  hit_ball_twice: "is out — hit the ball twice",
};

function overLabel(over: number, ball: number): string {
  return `${over}.${ball}`;
}

export function commentaryForBall(e: MCBallEvent): string {
  const striker = e.striker_name || "Striker";
  const bowler = e.bowler_name || "The bowler";
  const off = e.runs_off_bat ?? 0;
  const ex = e.extra_runs ?? 0;
  const extra = e.extra_type as ExtraType | null;
  const dt = e.dismissal_type as DismissalType | null;

  if (dt) {
    const base = `${striker} ${DISMISSAL_PHRASE[dt] ?? "is dismissed"}`;
    if (dt === "caught" && e.fielder_name) return `${base} by ${e.fielder_name} off ${bowler}.`;
    if (dt === "bowled" || dt === "lbw") return `${base} by ${bowler}.`;
    if (dt === "stumped" && e.fielder_name) return `${base} by ${e.fielder_name}.`;
    if (dt === "run_out" && e.fielder_name) return `${base} (${e.fielder_name}).`;
    return `${base}.`;
  }

  if (extra === "wide") {
    return ex > 1 ? `Wide, ${ex} runs.` : "Wide down the line.";
  }
  if (extra === "no_ball") {
    if (off === 4) return `No ball — ${striker} smashes it for FOUR.`;
    if (off === 6) return `No ball — ${striker} clears the ropes for SIX!`;
    if (off > 0) return `No ball, ${off} run${off > 1 ? "s" : ""} off the bat.`;
    return "No ball called.";
  }
  if (extra === "bye") return `${ex} bye${ex > 1 ? "s" : ""}.`;
  if (extra === "leg_bye") return `${ex} leg bye${ex > 1 ? "s" : ""}.`;
  if (extra === "penalty") return `${ex} penalty run${ex > 1 ? "s" : ""}.`;

  if (off === 6) return `${striker} clears the ropes — SIX!`;
  if (off === 4) return `${striker} finds the boundary. FOUR.`;
  if (off === 3) return `Well run, three to ${striker}.`;
  if (off === 2) return `Pushed for a couple.`;
  if (off === 1) return `Single, keeps the strike moving.`;
  return `Dot ball. ${bowler} on top.`;
}

export interface CommentaryEntry {
  id: string;
  over: string;
  text: string;
}

export function buildCommentary(events: MCBallEvent[]): CommentaryEntry[] {
  return events
    .slice()
    .reverse()
    .map((e) => ({
      id: e.id,
      over: overLabel(e.over_number, e.ball_number),
      text: commentaryForBall(e),
    }));
}

/* ================================================================
 * Ball-chip label for over timelines
 * ================================================================ */

export function ballChipLabel(e: MCBallEvent): string {
  const extra = e.extra_type as ExtraType | null;
  const dt = e.dismissal_type as DismissalType | null;
  const off = e.runs_off_bat ?? 0;
  const ex = e.extra_runs ?? 0;
  if (dt) return "W";
  if (extra === "wide") return ex > 1 ? `WD${ex}` : "WD";
  if (extra === "no_ball") return off > 0 ? `NB${off}` : "NB";
  if (extra === "bye") return `B${ex}`;
  if (extra === "leg_bye") return `LB${ex}`;
  if (extra === "penalty") return `P${ex}`;
  return off === 0 ? "•" : String(off);
}
