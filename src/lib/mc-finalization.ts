/**
 * Match Finalization Engine
 * -------------------------------------------------
 * Pure functions + Supabase writes that officially close a cricket match.
 *
 * Responsibilities:
 *  - Detect the match result from persisted innings + ball events
 *  - Suggest Player Of The Match
 *  - Finalize (lock) a match — one-way flag `match_locked = true`
 *  - Unlock (Owner only) with reason and audit trail
 *  - Append match timeline events
 *  - Append audit log entries
 *
 * IMPORTANT: This module does NOT modify the Ball Event Engine or Statistics
 * Engine. It only reads from them and writes finalization metadata.
 */

import { supabase } from "@/integrations/supabase/client";
import { emitEvent } from "@/lib/automation/emit-client";
import type { MCBallEvent } from "@/lib/mc-ball-events";
import {
  computeInningsStatistics,
  type BattingStat,
  type BowlingStat,
  type InningsStatistics,
} from "@/lib/mc-statistics-engine";

/* ============================================================
 * Types
 * ============================================================ */

export type VictoryType = "won" | "tie" | "draw" | "no_result" | "abandoned" | "cancelled";

export type WinningMarginType = "runs" | "wickets" | "tie" | "na";

export interface MatchResult {
  victoryType: VictoryType;
  winnerTeamId: string | null;
  winningMargin: number | null;
  winningMarginType: WinningMarginType;
  summary: string;
}

export interface InningsRow {
  id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id: string;
  runs: number;
  wickets: number;
  balls: number;
  overs: number;
  target: number | null;
  status: string;
}

export interface FinalizeMatchInput {
  matchId: string;
  tenantId: string;
  actorId: string | null;
  result: MatchResult;
  playerOfMatchAthleteId: string | null;
  overrides?: {
    victoryType?: VictoryType;
    winnerTeamId?: string | null;
    winningMargin?: number | null;
    winningMarginType?: WinningMarginType;
    reason?: string;
  };
}

export interface UnlockMatchInput {
  matchId: string;
  tenantId: string;
  actorId: string | null;
  reason: string;
}

export interface POMSuggestion {
  athleteId: string | null;
  name: string;
  reason: string; // e.g. "Top scorer — 72 (48)"
  category: "batting" | "bowling" | "allrounder";
  score: number; // internal ranking
}

/* ============================================================
 * Result detection
 * ============================================================ */

/**
 * Detect the result of a match from the persisted innings rows.
 * Pure — safe to call from anywhere.
 */
export function detectMatchResult(
  innings: InningsRow[],
  opts: { matchStatus?: string; teamAId: string; teamBId: string } = {
    teamAId: "",
    teamBId: "",
  },
): MatchResult {
  if (opts.matchStatus === "abandoned") {
    return {
      victoryType: "abandoned",
      winnerTeamId: null,
      winningMargin: null,
      winningMarginType: "na",
      summary: "Match abandoned",
    };
  }
  if (opts.matchStatus === "cancelled") {
    return {
      victoryType: "cancelled",
      winnerTeamId: null,
      winningMargin: null,
      winningMarginType: "na",
      summary: "Match cancelled",
    };
  }
  if (innings.length === 0) {
    return {
      victoryType: "no_result",
      winnerTeamId: null,
      winningMargin: null,
      winningMarginType: "na",
      summary: "No result",
    };
  }

  // Sort by innings_number
  const sorted = [...innings].sort((a, b) => a.innings_number - b.innings_number);
  const first = sorted[0];
  const second = sorted[1];

  if (!second) {
    return {
      victoryType: "no_result",
      winnerTeamId: null,
      winningMargin: null,
      winningMarginType: "na",
      summary: "First innings only — no result",
    };
  }

  const firstRuns = first.runs;
  const secondRuns = second.runs;
  const chasingTeamId = second.batting_team_id;
  const defendingTeamId = first.batting_team_id;

  // Chase successful — batting side wins by (10 - wickets) wickets
  if (secondRuns > firstRuns) {
    const wicketsLeft = 10 - second.wickets;
    return {
      victoryType: "won",
      winnerTeamId: chasingTeamId,
      winningMargin: wicketsLeft,
      winningMarginType: "wickets",
      summary: `Won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`,
    };
  }

  // Tie
  if (secondRuns === firstRuns) {
    return {
      victoryType: "tie",
      winnerTeamId: null,
      winningMargin: 0,
      winningMarginType: "tie",
      summary: "Match tied",
    };
  }

  // Defended — first innings side wins by (firstRuns - secondRuns) runs
  const margin = firstRuns - secondRuns;
  return {
    victoryType: "won",
    winnerTeamId: defendingTeamId,
    winningMargin: margin,
    winningMarginType: "runs",
    summary: `Won by ${margin} run${margin === 1 ? "" : "s"}`,
  };
}

/* ============================================================
 * Player Of The Match suggestions
 * ============================================================ */

function battingScore(b: BattingStat): number {
  // Simple heuristic: runs + strike rate boost for boundaries
  return b.runs + b.boundaryRuns * 0.25 + (b.isCentury ? 30 : 0) + (b.isHalfCentury ? 10 : 0);
}

function bowlingScore(b: BowlingStat): number {
  // Wickets weighted heavily; economy adjustment
  return b.wickets * 25 - b.runsConceded * 0.5 + b.maidens * 5;
}

/**
 * Suggest up to 3 Player Of The Match candidates: highest scorer,
 * best bowler, best all-rounder.
 */
export function suggestPlayerOfMatch(ballEvents: MCBallEvent[]): POMSuggestion[] {
  if (ballEvents.length === 0) return [];

  const stats = computeInningsStatistics(ballEvents);
  const batters = stats.batting.ordered;
  const bowlers = stats.bowling.ordered;

  const topBatter = [...batters].sort((a, b) => battingScore(b) - battingScore(a))[0];
  const topBowler = [...bowlers].sort((a, b) => bowlingScore(b) - bowlingScore(a))[0];

  // All-rounder: highest combined score
  const combined = new Map<
    string,
    { batting?: BattingStat; bowling?: BowlingStat; score: number }
  >();
  batters.forEach((b) => {
    const key = b.player.athleteId ?? `name:${b.player.name}`;
    combined.set(key, {
      batting: b,
      score: battingScore(b),
    });
  });
  bowlers.forEach((b) => {
    const key = b.player.athleteId ?? `name:${b.player.name}`;
    const existing = combined.get(key);
    if (existing) {
      existing.bowling = b;
      existing.score += bowlingScore(b);
    } else {
      combined.set(key, { bowling: b, score: bowlingScore(b) });
    }
  });
  const allRounder = [...combined.values()]
    .filter((v) => v.batting && v.bowling)
    .sort((a, b) => b.score - a.score)[0];

  const suggestions: POMSuggestion[] = [];

  if (topBatter && topBatter.runs > 0) {
    suggestions.push({
      athleteId: topBatter.player.athleteId,
      name: topBatter.player.name ?? "Unknown",
      reason: `Top scorer — ${topBatter.runs} (${topBatter.balls})`,
      category: "batting",
      score: battingScore(topBatter),
    });
  }
  if (topBowler && topBowler.wickets > 0) {
    suggestions.push({
      athleteId: topBowler.player.athleteId,
      name: topBowler.player.name ?? "Unknown",
      reason: `Best bowler — ${topBowler.bestBowlingDisplay} (${topBowler.oversDisplay})`,
      category: "bowling",
      score: bowlingScore(topBowler),
    });
  }
  if (allRounder && allRounder.batting && allRounder.bowling) {
    suggestions.push({
      athleteId: allRounder.batting.player.athleteId ?? allRounder.bowling.player.athleteId,
      name: allRounder.batting.player.name ?? allRounder.bowling.player.name ?? "Unknown",
      reason: `All-rounder — ${allRounder.batting.runs} & ${allRounder.bowling.wickets} wkts`,
      category: "allrounder",
      score: allRounder.score,
    });
  }

  return suggestions;
}

/* ============================================================
 * Timeline events
 * ============================================================ */

export type TimelineEventType =
  | "match_created"
  | "toss"
  | "innings_started"
  | "second_innings"
  | "match_finished"
  | "match_finalized"
  | "match_unlocked"
  | "player_of_match_set"
  | "result_overridden";

export async function appendTimelineEvent(input: {
  tenantId: string;
  matchId: string;
  eventType: TimelineEventType;
  label?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("mc_match_timeline").insert({
    tenant_id: input.tenantId,
    match_id: input.matchId,
    event_type: input.eventType,
    label: input.label ?? null,
    payload: (input.payload ?? {}) as never,
  });
  if (error) throw error;
}

export async function listTimeline(matchId: string) {
  const { data, error } = await supabase
    .from("mc_match_timeline")
    .select("*")
    .eq("match_id", matchId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ============================================================
 * Audit log
 * ============================================================ */

export type AuditAction =
  | "finalize_match"
  | "unlock_match"
  | "player_of_match_changed"
  | "winner_changed"
  | "result_override";

export async function appendAuditLog(input: {
  tenantId: string;
  matchId: string;
  action: AuditAction;
  actorId: string | null;
  reason?: string;
  diff?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("mc_match_audit_log").insert({
    tenant_id: input.tenantId,
    match_id: input.matchId,
    action: input.action,
    actor_id: input.actorId,
    reason: input.reason ?? null,
    diff: (input.diff ?? {}) as never,
  });
  if (error) throw error;
}

export async function listAuditLog(matchId: string) {
  const { data, error } = await supabase
    .from("mc_match_audit_log")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ============================================================
 * Validation
 * ============================================================ */

export interface FinalizationValidation {
  canFinalize: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFinalization(input: {
  matchStatus: string;
  matchLocked: boolean;
  innings: InningsRow[];
  result: MatchResult;
}): FinalizationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.matchLocked) errors.push("Match already finalized");
  if (input.innings.length === 0) errors.push("No innings has been played");

  const secondIncomplete =
    input.innings.length > 0 && input.innings.some((i) => i.status !== "completed");
  if (
    secondIncomplete &&
    input.result.victoryType !== "abandoned" &&
    input.result.victoryType !== "cancelled" &&
    input.result.victoryType !== "no_result"
  ) {
    warnings.push("An innings is still marked in progress");
  }

  if (input.result.victoryType === "won" && !input.result.winnerTeamId) {
    errors.push("Winner is required for a decided result");
  }

  return {
    canFinalize: errors.length === 0,
    errors,
    warnings,
  };
}

/* ============================================================
 * Finalize match
 * ============================================================ */

export async function finalizeMatch(input: FinalizeMatchInput) {
  const now = new Date().toISOString();

  const victoryType = input.overrides?.victoryType ?? input.result.victoryType;
  const winnerTeamId =
    input.overrides?.winnerTeamId !== undefined
      ? input.overrides.winnerTeamId
      : input.result.winnerTeamId;
  const winningMargin =
    input.overrides?.winningMargin !== undefined
      ? input.overrides.winningMargin
      : input.result.winningMargin;
  const winningMarginType = input.overrides?.winningMarginType ?? input.result.winningMarginType;

  const { error } = await supabase
    .from("mc_matches")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: input.actorId,
      finalized_at: now,
      match_locked: true,
      scorecard_generated: true,
      winner_team: winnerTeamId,
      victory_type: victoryType,
      winning_margin: winningMargin,
      winning_margin_type: winningMarginType,
      result: input.result.summary,
      player_of_match_athlete_id: input.playerOfMatchAthleteId,
    })
    .eq("id", input.matchId);
  if (error) throw error;

  await appendAuditLog({
    tenantId: input.tenantId,
    matchId: input.matchId,
    action: "finalize_match",
    actorId: input.actorId,
    reason: input.overrides?.reason,
    diff: {
      victoryType,
      winnerTeamId,
      winningMargin,
      winningMarginType,
      playerOfMatchAthleteId: input.playerOfMatchAthleteId,
      overrideApplied: !!input.overrides,
    },
  });

  await appendTimelineEvent({
    tenantId: input.tenantId,
    matchId: input.matchId,
    eventType: "match_finalized",
    label: input.result.summary,
    payload: {
      winnerTeamId,
      winningMargin,
      winningMarginType,
      victoryType,
    },
  });

  // Automation: match.finished — parent match report, tournament summary, ...
  emitEvent({
    tenantId: input.tenantId,
    eventType: "match.finished",
    sourceModule: "match-center",
    sourceId: input.matchId,
    payload: {
      match_id: input.matchId,
      winner_team_id: winnerTeamId,
      winning_margin: winningMargin,
      winning_margin_type: winningMarginType,
      victory_type: victoryType,
      player_of_match_athlete_id: input.playerOfMatchAthleteId ?? null,
      summary: input.result.summary,
    },
  });
}

/* ============================================================
 * Unlock match (Owner only — permission enforced by caller)
 * ============================================================ */

export async function unlockMatch(input: UnlockMatchInput) {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("A reason is required to unlock a finalized match");
  }
  const { error } = await supabase
    .from("mc_matches")
    .update({
      match_locked: false,
      status: "live",
    })
    .eq("id", input.matchId);
  if (error) throw error;

  await appendAuditLog({
    tenantId: input.tenantId,
    matchId: input.matchId,
    action: "unlock_match",
    actorId: input.actorId,
    reason: input.reason,
  });

  await appendTimelineEvent({
    tenantId: input.tenantId,
    matchId: input.matchId,
    eventType: "match_unlocked",
    label: "Match reopened for editing",
    payload: { reason: input.reason },
  });
}

/* ============================================================
 * Permissions helper
 * ============================================================ */

export type MCRole = "owner" | "admin" | "coach" | "scorer" | "parent";

export function canFinalize(role: MCRole): boolean {
  return role === "owner" || role === "admin";
}
export function canUnlock(role: MCRole): boolean {
  return role === "owner";
}
export function canOverrideResult(role: MCRole): boolean {
  return role === "owner" || role === "admin";
}
export function canSetPlayerOfMatch(role: MCRole): boolean {
  return role === "owner" || role === "admin" || role === "coach";
}

/* ============================================================
 * PDF + Share placeholders
 * ============================================================ */

export interface PdfPayload {
  matchId: string;
  stats: InningsStatistics;
  result: MatchResult;
}

/**
 * PDF generation placeholder — architecture-ready, no rendering.
 * Wire an actual renderer (react-pdf, pdf-lib, server function) later.
 */
export async function generateMatchPdf(_payload: PdfPayload): Promise<Blob> {
  return new Blob([`Match ${_payload.matchId} — ${_payload.result.summary}`], {
    type: "text/plain",
  });
}

/**
 * Share link placeholder — returns a stable public URL shape.
 * Real implementation will require a public route + tenant slug.
 */
export function buildPublicMatchLink(matchId: string): string {
  if (typeof window === "undefined") return `/m/${matchId}`;
  return `${window.location.origin}/m/${matchId}`;
}

export async function copyPublicMatchLink(matchId: string): Promise<string> {
  const url = buildPublicMatchLink(matchId);
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
  return url;
}

/* ============================================================
 * Local notifications (placeholders)
 * ============================================================ */

export function notifyMatchCompleted(summary: string) {
  // Local placeholder — replace with real notification bus later.
  if (typeof window !== "undefined") {
    console.info("[MC] Match completed:", summary);
  }
}
export function notifyPlayerOfMatch(name: string) {
  if (typeof window !== "undefined") {
    console.info("[MC] Player of the Match:", name);
  }
}
export function notifyFinalResult(summary: string) {
  if (typeof window !== "undefined") {
    console.info("[MC] Final result:", summary);
  }
}
