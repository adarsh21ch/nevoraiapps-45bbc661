/* ================================================================
 * Ball Event Core — pure primitives with NO runtime dependencies.
 * ----------------------------------------------------------------
 * This module is safe to import from anywhere (engines, tests,
 * simulations) without pulling in Supabase or database types.
 * The full ball-events module (src/lib/mc-ball-events.ts) re-exports
 * these so existing imports keep working.
 * ================================================================ */

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";

export type DismissalType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "retired_hurt"
  | "retired_out"
  | "timed_out"
  | "obstructing_field"
  | "handled_ball"
  | "hit_ball_twice";

/** Legal-extras count against the over's 6-ball budget. */
export const LEGAL_EXTRAS: readonly ExtraType[] = ["bye", "leg_bye", "penalty"];
export const ILLEGAL_EXTRAS: readonly ExtraType[] = ["wide", "no_ball"];

export function isLegalDelivery(extra: ExtraType | null | undefined): boolean {
  if (!extra) return true;
  return (LEGAL_EXTRAS as readonly string[]).includes(extra);
}

/**
 * Standardizes a ball notation label (e.g. "NB4" -> "NB+3", "0" -> "•").
 * Used for consistent rendering across both live scoring and history.
 */
export function formatBallNotation(label: string): string {
  let upper = label.toUpperCase();
  // Standardize notation if it's purely a number and not 0
  if (/^[1-6]$/.test(upper)) {
    // Keep as is
  } else if (upper === "0" || upper === "DOT" || upper === "•") {
    upper = "•";
  } else if (/^WD\d+$/.test(upper)) {
    const runs = parseInt(upper.slice(2));
    upper = runs > 1 ? `WD+${runs - 1}` : "WD";
  } else if (/^NB\d+$/.test(upper)) {
    const runs = parseInt(upper.slice(2));
    upper = runs > 1 ? `NB+${runs - 1}` : "NB";
  } else if (/^B\d+$/.test(upper)) {
    const runs = parseInt(upper.slice(1));
    upper = runs > 0 ? `B${runs}` : "•";
  } else if (/^LB\d+$/.test(upper)) {
    const runs = parseInt(upper.slice(2));
    upper = runs > 0 ? `LB${runs}` : "•";
  }
  return upper;
}

export class BallEventError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BallEventError";
  }
}
