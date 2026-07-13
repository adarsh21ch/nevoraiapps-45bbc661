import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/* ================================================================
 * Ball Event Engine — Types
 * ================================================================
 * Every scoring action creates one immutable row in `mc_ball_events`.
 * Innings/match aggregates are DERIVED from the event log.
 * ================================================================ */

export type MCInnings = Database["public"]["Tables"]["mc_innings"]["Row"];
export type MCInningsInsert =
  Database["public"]["Tables"]["mc_innings"]["Insert"];
export type MCInningsUpdate =
  Database["public"]["Tables"]["mc_innings"]["Update"];

export type MCBallEvent =
  Database["public"]["Tables"]["mc_ball_events"]["Row"];
export type MCBallEventInsert =
  Database["public"]["Tables"]["mc_ball_events"]["Insert"];

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

/** A legal delivery counts against the over's 6-ball budget. */
export const LEGAL_EXTRAS: readonly ExtraType[] = ["bye", "leg_bye", "penalty"];
export const ILLEGAL_EXTRAS: readonly ExtraType[] = ["wide", "no_ball"];

export function isLegalDelivery(extra: ExtraType | null | undefined): boolean {
  if (!extra) return true;
  return (LEGAL_EXTRAS as readonly string[]).includes(extra);
}

/* ================================================================
 * Errors
 * ================================================================ */

export class BallEventError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BallEventError";
  }
}

/* ================================================================
 * Innings
 * ================================================================ */

export async function listInningsForMatch(
  matchId: string,
): Promise<MCInnings[]> {
  const { data, error } = await supabase
    .from("mc_innings")
    .select("*")
    .eq("match_id", matchId)
    .order("innings_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getInnings(id: string): Promise<MCInnings | null> {
  const { data, error } = await supabase
    .from("mc_innings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface CreateInningsInput {
  tenantId: string;
  matchId: string;
  inningsNumber: 1 | 2 | 3 | 4;
  battingTeamId: string;
  bowlingTeamId: string;
  target?: number | null;
}

export async function createInnings(
  input: CreateInningsInput,
): Promise<MCInnings> {
  const payload: MCInningsInsert = {
    tenant_id: input.tenantId,
    match_id: input.matchId,
    innings_number: input.inningsNumber,
    batting_team_id: input.battingTeamId,
    bowling_team_id: input.bowlingTeamId,
    target: input.target ?? null,
    status: "in_progress",
    started_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("mc_innings")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeInnings(id: string): Promise<MCInnings> {
  const { data, error } = await supabase
    .from("mc_innings")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* ================================================================
 * Ball Events
 * ================================================================ */

export async function listBallEvents(
  inningsId: string,
): Promise<MCBallEvent[]> {
  const { data, error } = await supabase
    .from("mc_ball_events")
    .select("*")
    .eq("innings_id", inningsId)
    .order("sequence_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listMatchBallEvents(
  matchId: string,
): Promise<MCBallEvent[]> {
  const { data, error } = await supabase
    .from("mc_ball_events")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* --------- Positional helpers derived from prior events --------- */

export interface OverBallPosition {
  overNumber: number;
  ballNumber: number; // 1-based legal delivery counter within the over
  sequenceNumber: number; // monotonic across the innings
}

/**
 * Compute the position of the NEXT ball to be recorded, from prior events.
 * Uses `over_number` and `is_legal_delivery` — never derived stats.
 */
export function nextPosition(events: MCBallEvent[]): OverBallPosition {
  if (events.length === 0) {
    return { overNumber: 0, ballNumber: 1, sequenceNumber: 1 };
  }
  const last = events[events.length - 1];
  const nextSeq = (last.sequence_number ?? events.length) + 1;

  // Count legal deliveries so far in `last.over_number`.
  const legalInOver = events.filter(
    (e) => e.over_number === last.over_number && e.is_legal_delivery,
  ).length;

  if (legalInOver >= 6) {
    return {
      overNumber: last.over_number + 1,
      ballNumber: 1,
      sequenceNumber: nextSeq,
    };
  }

  // Same over — ball number is legal-count so far + 1 for legal, else same
  // legal position (still labelled by next legal ball).
  return {
    overNumber: last.over_number,
    ballNumber: legalInOver + 1,
    sequenceNumber: nextSeq,
  };
}

/* --------- Append (single source of truth for scoring) --------- */

export interface AppendBallInput {
  tenantId: string;
  matchId: string;
  inningsId: string;
  bowlerAthleteId?: string | null;
  bowlerName?: string | null;
  strikerAthleteId?: string | null;
  strikerName?: string | null;
  nonStrikerAthleteId?: string | null;
  nonStrikerName?: string | null;

  runsOffBat?: number;
  extraType?: ExtraType | null;
  extraRuns?: number;

  dismissalType?: DismissalType | null;
  dismissedAthleteId?: string | null;
  dismissedName?: string | null;
  fielderAthleteId?: string | null;
  fielderName?: string | null;

  comment?: string | null;
  createdBy?: string | null;

  /** Optional pre-loaded event log used to compute over/ball position. */
  priorEvents?: MCBallEvent[];
}

/**
 * Append exactly ONE Ball Event to an innings.
 * Validation happens client-side (fast); RLS enforces authorization.
 */
export async function appendBallEvent(
  input: AppendBallInput,
): Promise<MCBallEvent> {
  // ---- Validation ----
  if (!input.matchId) throw new BallEventError("INVALID_MATCH", "Missing match.");
  if (!input.inningsId)
    throw new BallEventError("INVALID_INNINGS", "Missing active innings.");
  if (!input.strikerAthleteId && !input.strikerName)
    throw new BallEventError("NO_STRIKER", "Striker is required.");
  if (!input.bowlerAthleteId && !input.bowlerName)
    throw new BallEventError("NO_BOWLER", "Bowler is required.");
  if (
    input.strikerAthleteId &&
    input.strikerAthleteId === input.nonStrikerAthleteId
  )
    throw new BallEventError(
      "DUPLICATE_STRIKER",
      "Striker and non-striker must differ.",
    );
  if ((input.runsOffBat ?? 0) < 0)
    throw new BallEventError("INVALID_RUNS", "Runs cannot be negative.");
  if ((input.extraRuns ?? 0) < 0)
    throw new BallEventError("INVALID_EXTRAS", "Extras cannot be negative.");

  // ---- Position ----
  const events =
    input.priorEvents ?? (await listBallEvents(input.inningsId));
  const pos = nextPosition(events);
  const legal = isLegalDelivery(input.extraType ?? null);

  // Prevent double-submit of an identical last event (defensive dedupe).
  const last = events[events.length - 1];
  if (
    last &&
    last.striker_athlete_id === (input.strikerAthleteId ?? null) &&
    last.bowler_athlete_id === (input.bowlerAthleteId ?? null) &&
    last.runs_off_bat === (input.runsOffBat ?? 0) &&
    last.extra_type === (input.extraType ?? null) &&
    last.extra_runs === (input.extraRuns ?? 0) &&
    last.dismissal_type === (input.dismissalType ?? null) &&
    Date.now() - new Date(last.created_at).getTime() < 400
  ) {
    throw new BallEventError(
      "DUPLICATE_BALL",
      "Duplicate ball event ignored.",
    );
  }

  const payload: MCBallEventInsert = {
    tenant_id: input.tenantId,
    match_id: input.matchId,
    innings_id: input.inningsId,
    over_number: pos.overNumber,
    ball_number: pos.ballNumber,
    sequence_number: pos.sequenceNumber,
    is_legal_delivery: legal,

    bowler_athlete_id: input.bowlerAthleteId ?? null,
    striker_athlete_id: input.strikerAthleteId ?? null,
    non_striker_athlete_id: input.nonStrikerAthleteId ?? null,
    bowler_name: input.bowlerName ?? null,
    striker_name: input.strikerName ?? null,
    non_striker_name: input.nonStrikerName ?? null,

    runs_off_bat: input.runsOffBat ?? 0,
    extra_type: input.extraType ?? null,
    extra_runs: input.extraRuns ?? 0,

    dismissal_type: input.dismissalType ?? null,
    dismissed_athlete_id: input.dismissedAthleteId ?? null,
    dismissed_name: input.dismissedName ?? null,
    fielder_athlete_id: input.fielderAthleteId ?? null,
    fielder_name: input.fielderName ?? null,

    comment: input.comment ?? null,
    created_by: input.createdBy ?? null,
  };

  const { data, error } = await supabase
    .from("mc_ball_events")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new BallEventError("DB_ERROR", error.message);
  return data;
}

/* --------- Undo (remove the most recent event) --------- */

export async function undoLastBallEvent(
  inningsId: string,
): Promise<MCBallEvent | null> {
  const { data: lastRows, error: lastErr } = await supabase
    .from("mc_ball_events")
    .select("*")
    .eq("innings_id", inningsId)
    .order("sequence_number", { ascending: false })
    .limit(1);
  if (lastErr) throw lastErr;
  const last = lastRows?.[0];
  if (!last) return null;
  const { error: delErr } = await supabase
    .from("mc_ball_events")
    .delete()
    .eq("id", last.id);
  if (delErr) throw delErr;
  return last;
}
