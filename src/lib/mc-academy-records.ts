/* ================================================================
 * Academy Records Engine
 * ----------------------------------------------------------------
 * AGGREGATION ONLY. This module NEVER computes cricket statistics
 * itself. It reads:
 *   - Statistics Engine (per-innings / per-match)
 *   - Career Engine    (per-athlete lifetime)
 *   - Tournament Engine (per-tournament outcomes)
 *   - Finalized `mc_matches` rows
 * ...and derives academy-wide records, leaderboards, milestones and
 * timeline events.
 *
 * Contract:
 *   - Cache (`mc_academy_records`) is ALWAYS rebuildable.
 *   - Records are never manually edited.
 *   - Every finalized match triggers an incremental refresh.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listMatchBallEvents } from "@/lib/mc-ball-events";
import {
  computeInningsStatistics,
  computePartnerships,
  type BattingStat,
  type BowlingStat,
} from "@/lib/mc-statistics-engine";
import { createTimelineEntry } from "@/lib/mc-athletes";

export type MCAcademyRecord = Database["public"]["Tables"]["mc_academy_records"]["Row"];
export type MCHallOfFame = Database["public"]["Tables"]["mc_hall_of_fame"]["Row"];

/* ================================================================
 * Record type registry (extensible via config)
 * ================================================================ */

export type RecordType =
  | "highest_individual_score"
  | "highest_team_score"
  | "lowest_team_score"
  | "best_bowling"
  | "best_economy"
  | "highest_strike_rate"
  | "fastest_fifty"
  | "fastest_hundred"
  | "most_career_runs"
  | "most_career_wickets"
  | "most_career_matches"
  | "most_career_catches"
  | "most_run_outs"
  | "most_stumpings"
  | "most_player_of_match"
  | "longest_winning_streak"
  | "highest_partnership"
  | "most_sixes_innings"
  | "most_fours_innings"
  | "most_career_sixes"
  | "most_career_fours"
  | "best_captain_win_pct"
  | "most_tournament_wins"
  | "youngest_debut"
  | "oldest_active"
  | "academy_debut_number";

export interface RecordConfig {
  minBallsForStrikeRate: number;
  minOversForEconomy: number;
  minMatchesForCaptainPct: number;
}

export const DEFAULT_RECORD_CONFIG: RecordConfig = {
  minBallsForStrikeRate: 60,
  minOversForEconomy: 20,
  minMatchesForCaptainPct: 5,
};

/* ================================================================
 * Domain shapes
 * ================================================================ */

export interface LeaderboardRow {
  athleteProfileId: string | null;
  athleteName: string;
  value: number;
  metadata: Record<string, unknown>;
}

export interface AcademyOverview {
  totalMatches: number;
  totalFinalizedMatches: number;
  totalRuns: number;
  totalWickets: number;
  totalSixes: number;
  totalFours: number;
  topRunScorer: LeaderboardRow | null;
  topWicketTaker: LeaderboardRow | null;
  topBatter: LeaderboardRow | null; // by average (min balls threshold)
  topBowler: LeaderboardRow | null; // by wickets
  mostMatches: LeaderboardRow | null;
  mostPlayerOfMatch: LeaderboardRow | null;
  currentCaptain: LeaderboardRow | null;
  latestRecord: MCAcademyRecord | null;
  recentMilestone: string | null;
}

/* ================================================================
 * Internal fetch helpers (pure aggregation, no cricket math)
 * ================================================================ */

async function fetchFinalizedMatches(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_matches")
    .select(
      "id, tenant_id, team_a_id, team_b_id, winner_team, player_of_match_athlete_id, finalized_at, scheduled_date, tournament_id, match_locked",
    )
    .eq("tenant_id", tenantId)
    .eq("match_locked", true)
    .order("finalized_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchInnings(tenantId: string) {
  const { data, error } = await supabase.from("mc_innings").select("*").eq("tenant_id", tenantId);
  if (error) throw error;
  return data ?? [];
}

async function fetchCareers(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_player_careers")
    .select("*, mc_athlete_profiles(id, student_id, students(name))")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data ?? [];
}

async function fetchTournamentTeams(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_tournament_teams")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data ?? [];
}

async function fetchTeams(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_teams")
    .select("id, name")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data ?? [];
}

function careerAthleteName(row: Record<string, unknown>): string {
  const ap = row.mc_athlete_profiles as { students?: { name?: string } | null } | null | undefined;
  return ap?.students?.name ?? "Unknown Player";
}

/* ================================================================
 * Pure aggregation functions
 * ================================================================
 * These take pre-fetched rows and produce leaderboards. No DB, no
 * cricket calculations — everything statistical comes from the
 * Career/Statistics Engines.
 * ================================================================ */

export function leaderboardMostRuns(
  careers: Array<Record<string, unknown> & { runs: number; athlete_profile_id: string }>,
  limit = 25,
): LeaderboardRow[] {
  return [...careers]
    .filter((c) => (c.runs ?? 0) > 0)
    .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id,
      athleteName: careerAthleteName(c),
      value: c.runs ?? 0,
      metadata: {
        matches: c.matches,
        average: c.average,
        strikeRate: c.strike_rate,
      },
    }));
}

export function leaderboardMostWickets(
  careers: Array<Record<string, unknown> & { wickets: number; athlete_profile_id: string }>,
  limit = 25,
): LeaderboardRow[] {
  return [...careers]
    .filter((c) => (c.wickets ?? 0) > 0)
    .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id,
      athleteName: careerAthleteName(c),
      value: c.wickets ?? 0,
      metadata: {
        matches: c.matches,
        economy: c.economy,
        bowlingAverage: c.bowling_average,
      },
    }));
}

export function leaderboardHighestAverage(
  careers: Array<Record<string, unknown>>,
  minBalls = 60,
  limit = 25,
): LeaderboardRow[] {
  return careers
    .filter(
      (c) => (c.balls as number) >= minBalls && (c.innings as number) - (c.not_outs as number) > 0,
    )
    .sort((a, b) => (b.average as number) - (a.average as number))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id as string,
      athleteName: careerAthleteName(c),
      value: c.average as number,
      metadata: { runs: c.runs, innings: c.innings, notOuts: c.not_outs },
    }));
}

export function leaderboardHighestStrikeRate(
  careers: Array<Record<string, unknown>>,
  minBalls = 60,
  limit = 25,
): LeaderboardRow[] {
  return careers
    .filter((c) => (c.balls as number) >= minBalls)
    .sort((a, b) => (b.strike_rate as number) - (a.strike_rate as number))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id as string,
      athleteName: careerAthleteName(c),
      value: c.strike_rate as number,
      metadata: { runs: c.runs, balls: c.balls },
    }));
}

export function leaderboardBestEconomy(
  careers: Array<Record<string, unknown>>,
  minBalls = 120,
  limit = 25,
): LeaderboardRow[] {
  return careers
    .filter((c) => (c.balls_bowled as number) >= minBalls && (c.economy as number) > 0)
    .sort((a, b) => (a.economy as number) - (b.economy as number))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id as string,
      athleteName: careerAthleteName(c),
      value: c.economy as number,
      metadata: { overs: c.overs, wickets: c.wickets },
    }));
}

export function leaderboardCareer(
  careers: Array<Record<string, unknown>>,
  field: string,
  limit = 25,
): LeaderboardRow[] {
  return [...careers]
    .filter((c) => (c[field] as number) > 0)
    .sort((a, b) => (b[field] as number) - (a[field] as number))
    .slice(0, limit)
    .map((c) => ({
      athleteProfileId: c.athlete_profile_id as string,
      athleteName: careerAthleteName(c),
      value: c[field] as number,
      metadata: { matches: c.matches },
    }));
}

export function leaderboardBestCaptain(
  careers: Array<Record<string, unknown>>,
  minMatches = 5,
  limit = 25,
): LeaderboardRow[] {
  return careers
    .filter((c) => (c.captain_matches as number) >= minMatches)
    .map((c) => {
      const wins = c.captain_wins as number;
      const played = c.captain_matches as number;
      const pct = played > 0 ? +((wins / played) * 100).toFixed(2) : 0;
      return { c, pct };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
    .map(({ c, pct }) => ({
      athleteProfileId: c.athlete_profile_id as string,
      athleteName: careerAthleteName(c),
      value: pct,
      metadata: {
        captainMatches: c.captain_matches,
        wins: c.captain_wins,
        losses: c.captain_losses,
      },
    }));
}

/* ================================================================
 * Match-level records: highest team score, lowest, highest partnership
 * — reads Statistics Engine outputs, does no cricket math itself.
 * ================================================================ */

export interface MatchScopedRecord {
  matchId: string;
  value: number;
  athleteProfileId?: string | null;
  athleteName?: string;
  teamId?: string | null;
  metadata: Record<string, unknown>;
}

/** Highest team score across all finalized innings for tenant. */
export function findHighestTeamScore(
  innings: Array<Record<string, unknown>>,
): MatchScopedRecord | null {
  let best: MatchScopedRecord | null = null;
  for (const i of innings) {
    const runs = i.runs as number;
    if (!best || runs > best.value) {
      best = {
        matchId: i.match_id as string,
        value: runs,
        teamId: (i.batting_team_id as string) ?? null,
        metadata: { wickets: i.wickets, overs: i.overs, balls: i.balls },
      };
    }
  }
  return best;
}

export function findLowestTeamScore(
  innings: Array<Record<string, unknown>>,
): MatchScopedRecord | null {
  let low: MatchScopedRecord | null = null;
  for (const i of innings) {
    const runs = i.runs as number;
    // Only count completed innings
    if ((i.status as string) !== "completed") continue;
    if (!low || runs < low.value) {
      low = {
        matchId: i.match_id as string,
        value: runs,
        teamId: (i.batting_team_id as string) ?? null,
        metadata: { wickets: i.wickets, overs: i.overs },
      };
    }
  }
  return low;
}

/** Per-match: highest individual score, best bowling, highest partnership. */
export interface MatchInsights {
  highestIndividualScore: {
    matchId: string;
    athleteId: string | null;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
  } | null;
  bestBowling: {
    matchId: string;
    athleteId: string | null;
    name: string;
    wickets: number;
    runsConceded: number;
    overs: number;
  } | null;
  highestPartnership: {
    matchId: string;
    p1Name: string;
    p2Name: string;
    p1AthleteId: string | null;
    p2AthleteId: string | null;
    runs: number;
    balls: number;
  } | null;
  mostSixesInInnings: {
    matchId: string;
    athleteId: string | null;
    name: string;
    sixes: number;
  } | null;
  mostFoursInInnings: {
    matchId: string;
    athleteId: string | null;
    name: string;
    fours: number;
  } | null;
}

export async function analyzeMatchInsights(matchId: string): Promise<MatchInsights> {
  const events = await listMatchBallEvents(matchId);
  if (events.length === 0) {
    return {
      highestIndividualScore: null,
      bestBowling: null,
      highestPartnership: null,
      mostSixesInInnings: null,
      mostFoursInInnings: null,
    };
  }
  // Group events by innings.
  const byInnings = new Map<string, typeof events>();
  for (const ev of events) {
    if (!ev.innings_id) continue;
    const arr = byInnings.get(ev.innings_id) ?? [];
    arr.push(ev);
    byInnings.set(ev.innings_id, arr);
  }

  let bestBat: MatchInsights["highestIndividualScore"] = null;
  let bestBowl: MatchInsights["bestBowling"] = null;
  let bestPship: MatchInsights["highestPartnership"] = null;
  let mostSixes: MatchInsights["mostSixesInInnings"] = null;
  let mostFours: MatchInsights["mostFoursInInnings"] = null;

  for (const [, inningsEvents] of byInnings) {
    const stats = computeInningsStatistics(inningsEvents);

    // Highest bat
    for (const b of stats.batting.byKey.values()) {
      if (!bestBat || b.runs > bestBat.runs) {
        bestBat = {
          matchId,
          athleteId: b.player.athleteId,
          name: b.player.name ?? "Unknown",
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
        };
      }
      if (!mostSixes || b.sixes > mostSixes.sixes) {
        mostSixes = {
          matchId,
          athleteId: b.player.athleteId,
          name: b.player.name ?? "Unknown",
          sixes: b.sixes,
        };
      }
      if (!mostFours || b.fours > mostFours.fours) {
        mostFours = {
          matchId,
          athleteId: b.player.athleteId,
          name: b.player.name ?? "Unknown",
          fours: b.fours,
        };
      }
    }

    // Best bowling
    for (const bw of stats.bowling.byKey.values()) {
      const better =
        !bestBowl ||
        bw.wickets > bestBowl.wickets ||
        (bw.wickets === bestBowl.wickets && bw.runsConceded < bestBowl.runsConceded);
      if (better) {
        bestBowl = {
          matchId,
          athleteId: bw.player.athleteId,
          name: bw.player.name ?? "Unknown",
          wickets: bw.wickets,
          runsConceded: bw.runsConceded,
          overs: bw.overs,
        };
      }
    }

    // Partnerships
    const { partnerships } = computePartnerships(inningsEvents);
    for (const p of partnerships) {
      if (!bestPship || p.runs > bestPship.runs) {
        bestPship = {
          matchId,
          p1Name: p.batterA?.name ?? "Unknown",
          p2Name: p.batterB?.name ?? "Unknown",
          p1AthleteId: p.batterA?.athleteId ?? null,
          p2AthleteId: p.batterB?.athleteId ?? null,
          runs: p.runs,
          balls: p.balls,
        };
      }
    }
  }

  return {
    highestIndividualScore: bestBat,
    bestBowling: bestBowl,
    highestPartnership: bestPship,
    mostSixesInInnings: mostSixes,
    mostFoursInInnings: mostFours,
  };
}

/* ================================================================
 * Team + captain records
 * ================================================================ */

export interface TeamRecords {
  highestScore: MatchScopedRecord | null;
  lowestScore: MatchScopedRecord | null;
  longestWinningStreak: {
    teamId: string;
    teamName: string;
    streak: number;
  } | null;
}

export function computeTeamRecords(
  innings: Array<Record<string, unknown>>,
  matches: Array<Record<string, unknown>>,
  teams: Array<{ id: string; name: string }>,
): TeamRecords {
  const highestScore = findHighestTeamScore(innings);
  const lowestScore = findLowestTeamScore(innings);

  // Compute winning streaks per team from chronological finalized matches
  const chronological = [...matches].sort((a, b) => {
    const da = new Date((a.finalized_at as string) ?? (a.scheduled_date as string) ?? 0).getTime();
    const db = new Date((b.finalized_at as string) ?? (b.scheduled_date as string) ?? 0).getTime();
    return da - db;
  });
  const currentStreak = new Map<string, number>();
  const bestStreak = new Map<string, number>();
  for (const m of chronological) {
    const winner = m.winner_team as string | null;
    const a = m.team_a_id as string;
    const b = m.team_b_id as string;
    for (const t of [a, b]) {
      if (!t) continue;
      if (winner === t) {
        currentStreak.set(t, (currentStreak.get(t) ?? 0) + 1);
        bestStreak.set(t, Math.max(bestStreak.get(t) ?? 0, currentStreak.get(t)!));
      } else if (winner) {
        currentStreak.set(t, 0);
      }
    }
  }
  let winnerId: string | null = null;
  let winnerStreak = 0;
  for (const [tid, s] of bestStreak) {
    if (s > winnerStreak) {
      winnerStreak = s;
      winnerId = tid;
    }
  }
  const teamName = winnerId ? (teams.find((t) => t.id === winnerId)?.name ?? "Team") : null;

  return {
    highestScore,
    lowestScore,
    longestWinningStreak:
      winnerId && teamName ? { teamId: winnerId, teamName, streak: winnerStreak } : null,
  };
}

export interface CaptainRecordRow {
  athleteProfileId: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
}

export function computeCaptainRecords(careers: Array<Record<string, unknown>>): CaptainRecordRow[] {
  return careers
    .filter((c) => (c.captain_matches as number) > 0)
    .map((c) => {
      const played = c.captain_matches as number;
      const wins = c.captain_wins as number;
      const losses = c.captain_losses as number;
      return {
        athleteProfileId: c.athlete_profile_id as string,
        name: careerAthleteName(c),
        matches: played,
        wins,
        losses,
        winPct: played > 0 ? +((wins / played) * 100).toFixed(2) : 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);
}

/* ================================================================
 * Cache read/write
 * ================================================================ */

async function upsertRecord(
  tenantId: string,
  recordType: RecordType,
  recordKey: string,
  value: number,
  extra: {
    athleteProfileId?: string | null;
    teamId?: string | null;
    matchId?: string | null;
    tournamentId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    record_type: recordType,
    record_key: recordKey,
    value,
    athlete_profile_id: extra.athleteProfileId ?? null,
    team_id: extra.teamId ?? null,
    match_id: extra.matchId ?? null,
    tournament_id: extra.tournamentId ?? null,
    metadata: (extra.metadata ?? {}) as never,
  };
  const { error } = await supabase
    .from("mc_academy_records")
    .upsert(payload, { onConflict: "tenant_id,record_type,record_key" });
  if (error) throw error;
}

export async function listAcademyRecords(tenantId: string): Promise<MCAcademyRecord[]> {
  const { data, error } = await supabase
    .from("mc_academy_records")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ================================================================
 * Rebuild — the canonical entry point
 * ================================================================ */

export interface RebuildSummary {
  recordsWritten: number;
  matchesAnalyzed: number;
  durationMs: number;
}

/**
 * Recompute every academy record from finalized matches.
 * O(matches) — analyzeMatchInsights runs once per match; leaderboards
 * come from the Career cache (constant per athlete).
 */
export async function rebuildAcademyRecords(
  tenantId: string,
  config: RecordConfig = DEFAULT_RECORD_CONFIG,
): Promise<RebuildSummary> {
  const started = Date.now();
  let written = 0;

  const [matches, innings, careers, tournamentTeams, teams] = await Promise.all([
    fetchFinalizedMatches(tenantId),
    fetchInnings(tenantId),
    fetchCareers(tenantId),
    fetchTournamentTeams(tenantId),
    fetchTeams(tenantId),
  ]);

  // ---- Per-match records (highest score, best bowling, partnership, sixes/fours) ----
  let bestBat: MatchInsights["highestIndividualScore"] = null;
  let bestBowl: MatchInsights["bestBowling"] = null;
  let bestPship: MatchInsights["highestPartnership"] = null;
  let bestSixes: MatchInsights["mostSixesInInnings"] = null;
  let bestFours: MatchInsights["mostFoursInInnings"] = null;

  for (const m of matches) {
    const insights = await analyzeMatchInsights(m.id);
    if (
      insights.highestIndividualScore &&
      (!bestBat || insights.highestIndividualScore.runs > bestBat.runs)
    ) {
      bestBat = insights.highestIndividualScore;
    }
    if (
      insights.bestBowling &&
      (!bestBowl ||
        insights.bestBowling.wickets > bestBowl.wickets ||
        (insights.bestBowling.wickets === bestBowl.wickets &&
          insights.bestBowling.runsConceded < bestBowl.runsConceded))
    ) {
      bestBowl = insights.bestBowling;
    }
    if (
      insights.highestPartnership &&
      (!bestPship || insights.highestPartnership.runs > bestPship.runs)
    ) {
      bestPship = insights.highestPartnership;
    }
    if (
      insights.mostSixesInInnings &&
      (!bestSixes || insights.mostSixesInInnings.sixes > bestSixes.sixes)
    ) {
      bestSixes = insights.mostSixesInInnings;
    }
    if (
      insights.mostFoursInInnings &&
      (!bestFours || insights.mostFoursInInnings.fours > bestFours.fours)
    ) {
      bestFours = insights.mostFoursInInnings;
    }
  }

  if (bestBat) {
    await upsertRecord(tenantId, "highest_individual_score", "all_time", bestBat.runs, {
      athleteProfileId: bestBat.athleteId,
      matchId: bestBat.matchId,
      metadata: {
        name: bestBat.name,
        balls: bestBat.balls,
        fours: bestBat.fours,
        sixes: bestBat.sixes,
      },
    });
    written++;
  }
  if (bestBowl) {
    await upsertRecord(tenantId, "best_bowling", "all_time", bestBowl.wickets, {
      athleteProfileId: bestBowl.athleteId,
      matchId: bestBowl.matchId,
      metadata: {
        name: bestBowl.name,
        runsConceded: bestBowl.runsConceded,
        overs: bestBowl.overs,
        figures: `${bestBowl.wickets}/${bestBowl.runsConceded}`,
      },
    });
    written++;
  }
  if (bestPship) {
    await upsertRecord(tenantId, "highest_partnership", "all_time", bestPship.runs, {
      matchId: bestPship.matchId,
      athleteProfileId: bestPship.p1AthleteId,
      metadata: {
        p1: bestPship.p1Name,
        p2: bestPship.p2Name,
        p2AthleteId: bestPship.p2AthleteId,
        balls: bestPship.balls,
      },
    });
    written++;
  }
  if (bestSixes) {
    await upsertRecord(tenantId, "most_sixes_innings", "single_innings", bestSixes.sixes, {
      athleteProfileId: bestSixes.athleteId,
      matchId: bestSixes.matchId,
      metadata: { name: bestSixes.name },
    });
    written++;
  }
  if (bestFours) {
    await upsertRecord(tenantId, "most_fours_innings", "single_innings", bestFours.fours, {
      athleteProfileId: bestFours.athleteId,
      matchId: bestFours.matchId,
      metadata: { name: bestFours.name },
    });
    written++;
  }

  // ---- Team-level records ----
  const teamRec = computeTeamRecords(innings, matches, teams);
  if (teamRec.highestScore) {
    await upsertRecord(tenantId, "highest_team_score", "all_time", teamRec.highestScore.value, {
      matchId: teamRec.highestScore.matchId,
      teamId: teamRec.highestScore.teamId,
      metadata: teamRec.highestScore.metadata,
    });
    written++;
  }
  if (teamRec.lowestScore) {
    await upsertRecord(tenantId, "lowest_team_score", "all_time", teamRec.lowestScore.value, {
      matchId: teamRec.lowestScore.matchId,
      teamId: teamRec.lowestScore.teamId,
      metadata: teamRec.lowestScore.metadata,
    });
    written++;
  }
  if (teamRec.longestWinningStreak) {
    await upsertRecord(
      tenantId,
      "longest_winning_streak",
      "all_time",
      teamRec.longestWinningStreak.streak,
      {
        teamId: teamRec.longestWinningStreak.teamId,
        metadata: { teamName: teamRec.longestWinningStreak.teamName },
      },
    );
    written++;
  }

  // ---- Career-derived leaderboards ----
  const careersTyped = careers as unknown as Array<
    Record<string, unknown> & {
      runs: number;
      wickets: number;
      athlete_profile_id: string;
    }
  >;

  const topRuns = leaderboardMostRuns(careersTyped, 1)[0];
  if (topRuns) {
    await upsertRecord(tenantId, "most_career_runs", "all_time", topRuns.value, {
      athleteProfileId: topRuns.athleteProfileId,
      metadata: { name: topRuns.athleteName, ...topRuns.metadata },
    });
    written++;
  }
  const topWkts = leaderboardMostWickets(careersTyped, 1)[0];
  if (topWkts) {
    await upsertRecord(tenantId, "most_career_wickets", "all_time", topWkts.value, {
      athleteProfileId: topWkts.athleteProfileId,
      metadata: { name: topWkts.athleteName, ...topWkts.metadata },
    });
    written++;
  }
  const mostMatches = leaderboardCareer(careersTyped, "matches", 1)[0];
  if (mostMatches) {
    await upsertRecord(tenantId, "most_career_matches", "all_time", mostMatches.value, {
      athleteProfileId: mostMatches.athleteProfileId,
      metadata: { name: mostMatches.athleteName },
    });
    written++;
  }
  const mostCatches = leaderboardCareer(careersTyped, "catches", 1)[0];
  if (mostCatches) {
    await upsertRecord(tenantId, "most_career_catches", "all_time", mostCatches.value, {
      athleteProfileId: mostCatches.athleteProfileId,
      metadata: { name: mostCatches.athleteName },
    });
    written++;
  }
  const mostStumps = leaderboardCareer(careersTyped, "stumpings", 1)[0];
  if (mostStumps) {
    await upsertRecord(tenantId, "most_stumpings", "all_time", mostStumps.value, {
      athleteProfileId: mostStumps.athleteProfileId,
      metadata: { name: mostStumps.athleteName },
    });
    written++;
  }
  const mostRO = leaderboardCareer(careersTyped, "run_outs", 1)[0];
  if (mostRO) {
    await upsertRecord(tenantId, "most_run_outs", "all_time", mostRO.value, {
      athleteProfileId: mostRO.athleteProfileId,
      metadata: { name: mostRO.athleteName },
    });
    written++;
  }
  const mostPOM = leaderboardCareer(careersTyped, "player_of_match", 1)[0];
  if (mostPOM) {
    await upsertRecord(tenantId, "most_player_of_match", "all_time", mostPOM.value, {
      athleteProfileId: mostPOM.athleteProfileId,
      metadata: { name: mostPOM.athleteName },
    });
    written++;
  }
  const bestSR = leaderboardHighestStrikeRate(careersTyped, config.minBallsForStrikeRate, 1)[0];
  if (bestSR) {
    await upsertRecord(tenantId, "highest_strike_rate", "career", bestSR.value, {
      athleteProfileId: bestSR.athleteProfileId,
      metadata: { name: bestSR.athleteName, ...bestSR.metadata },
    });
    written++;
  }
  const bestEco = leaderboardBestEconomy(careersTyped, config.minOversForEconomy * 6, 1)[0];
  if (bestEco) {
    await upsertRecord(tenantId, "best_economy", "career", bestEco.value, {
      athleteProfileId: bestEco.athleteProfileId,
      metadata: { name: bestEco.athleteName, ...bestEco.metadata },
    });
    written++;
  }
  const bestCap = leaderboardBestCaptain(careersTyped, config.minMatchesForCaptainPct, 1)[0];
  if (bestCap) {
    await upsertRecord(tenantId, "best_captain_win_pct", "all_time", bestCap.value, {
      athleteProfileId: bestCap.athleteProfileId,
      metadata: { name: bestCap.athleteName, ...bestCap.metadata },
    });
    written++;
  }
  const mostCareerSixes = leaderboardCareer(careersTyped, "sixes", 1)[0];
  if (mostCareerSixes) {
    await upsertRecord(tenantId, "most_career_sixes", "all_time", mostCareerSixes.value, {
      athleteProfileId: mostCareerSixes.athleteProfileId,
      metadata: { name: mostCareerSixes.athleteName },
    });
    written++;
  }
  const mostCareerFours = leaderboardCareer(careersTyped, "fours", 1)[0];
  if (mostCareerFours) {
    await upsertRecord(tenantId, "most_career_fours", "all_time", mostCareerFours.value, {
      athleteProfileId: mostCareerFours.athleteProfileId,
      metadata: { name: mostCareerFours.athleteName },
    });
    written++;
  }

  // Most tournament wins per team (tournament engine)
  const winsByTeam = new Map<string, number>();
  for (const tt of tournamentTeams) {
    const teamId = (tt as { team_id?: string }).team_id;
    const finalPos = (tt as { final_position?: number }).final_position;
    if (teamId && finalPos === 1) {
      winsByTeam.set(teamId, (winsByTeam.get(teamId) ?? 0) + 1);
    }
  }
  let topTeam: { id: string; wins: number } | null = null;
  for (const [id, wins] of winsByTeam) {
    if (!topTeam || wins > topTeam.wins) topTeam = { id, wins };
  }
  if (topTeam) {
    const teamName = teams.find((t) => t.id === topTeam!.id)?.name ?? "Team";
    await upsertRecord(tenantId, "most_tournament_wins", "all_time", topTeam.wins, {
      teamId: topTeam.id,
      metadata: { teamName },
    });
    written++;
  }

  return {
    recordsWritten: written,
    matchesAnalyzed: matches.length,
    durationMs: Date.now() - started,
  };
}

/**
 * Incremental update after a single finalized match. Cheap enough
 * (<300ms target) to run inside the finalization flow.
 * Uses "compare vs current cache" — no full rebuild.
 */
export async function updateAcademyRecordsForMatch(
  matchId: string,
): Promise<{ updated: number; broken: string[] }> {
  const { data: match, error } = await supabase
    .from("mc_matches")
    .select("id, tenant_id, tournament_id, match_locked")
    .eq("id", matchId)
    .single();
  if (error || !match) throw error ?? new Error("Match not found");
  if (!match.match_locked) return { updated: 0, broken: [] };

  const tenantId = match.tenant_id;
  const insights = await analyzeMatchInsights(matchId);
  const existing = await listAcademyRecords(tenantId);
  const byType = new Map(existing.map((r) => [r.record_type + ":" + r.record_key, r]));
  const broken: string[] = [];
  let updated = 0;

  const tryBreak = async (
    type: RecordType,
    key: string,
    value: number,
    payload: Parameters<typeof upsertRecord>[4],
    label: string,
    higherIsBetter = true,
    tieBreaker?: { key: string; lowerIsBetter: boolean; newValue: number },
  ) => {
    const cur = byType.get(type + ":" + key);
    const better =
      !cur ||
      (higherIsBetter ? value > Number(cur.value) : value < Number(cur.value)) ||
      (tieBreaker &&
        Number(cur.value) === value &&
        (tieBreaker.lowerIsBetter
          ? tieBreaker.newValue <
            Number((cur.metadata as Record<string, unknown>)[tieBreaker.key] ?? Infinity)
          : tieBreaker.newValue >
            Number((cur.metadata as Record<string, unknown>)[tieBreaker.key] ?? -Infinity)));
    if (better) {
      await upsertRecord(tenantId, type, key, value, payload);
      updated++;
      broken.push(label);
    }
  };

  if (insights.highestIndividualScore) {
    const b = insights.highestIndividualScore;
    await tryBreak(
      "highest_individual_score",
      "all_time",
      b.runs,
      {
        athleteProfileId: b.athleteId,
        matchId,
        metadata: { name: b.name, balls: b.balls, fours: b.fours, sixes: b.sixes },
      },
      `${b.name} — ${b.runs} (${b.balls}) is now the academy high score`,
    );
  }
  if (insights.bestBowling) {
    const bw = insights.bestBowling;
    await tryBreak(
      "best_bowling",
      "all_time",
      bw.wickets,
      {
        athleteProfileId: bw.athleteId,
        matchId,
        metadata: {
          name: bw.name,
          runsConceded: bw.runsConceded,
          overs: bw.overs,
          figures: `${bw.wickets}/${bw.runsConceded}`,
        },
      },
      `${bw.name} — ${bw.wickets}/${bw.runsConceded} is now the best bowling`,
      true,
      { key: "runsConceded", lowerIsBetter: true, newValue: bw.runsConceded },
    );
  }
  if (insights.highestPartnership) {
    const p = insights.highestPartnership;
    await tryBreak(
      "highest_partnership",
      "all_time",
      p.runs,
      {
        matchId,
        athleteProfileId: p.p1AthleteId,
        metadata: {
          p1: p.p1Name,
          p2: p.p2Name,
          p2AthleteId: p.p2AthleteId,
          balls: p.balls,
        },
      },
      `${p.p1Name} & ${p.p2Name} — ${p.runs} run partnership`,
    );
  }
  if (insights.mostSixesInInnings) {
    const s = insights.mostSixesInInnings;
    await tryBreak(
      "most_sixes_innings",
      "single_innings",
      s.sixes,
      { athleteProfileId: s.athleteId, matchId, metadata: { name: s.name } },
      `${s.name} — ${s.sixes} sixes in an innings`,
    );
  }
  if (insights.mostFoursInInnings) {
    const f = insights.mostFoursInInnings;
    await tryBreak(
      "most_fours_innings",
      "single_innings",
      f.fours,
      { athleteProfileId: f.athleteId, matchId, metadata: { name: f.name } },
      `${f.name} — ${f.fours} fours in an innings`,
    );
  }

  // Check team score records for this match's innings
  const { data: matchInnings } = await supabase
    .from("mc_innings")
    .select("*")
    .eq("match_id", matchId);
  for (const inn of matchInnings ?? []) {
    await tryBreak(
      "highest_team_score",
      "all_time",
      inn.runs,
      {
        matchId,
        teamId: inn.batting_team_id,
        metadata: { wickets: inn.wickets, overs: inn.overs, balls: inn.balls },
      },
      `Team score of ${inn.runs}/${inn.wickets} — new academy high`,
    );
    if (inn.status === "completed") {
      await tryBreak(
        "lowest_team_score",
        "all_time",
        inn.runs,
        {
          matchId,
          teamId: inn.batting_team_id,
          metadata: { wickets: inn.wickets, overs: inn.overs },
        },
        `Team dismissed for ${inn.runs} — new academy low`,
        false,
      );
    }
  }

  // Log broken-record milestones into academy timeline (via tenant-scoped
  // athlete timeline for players linked to the record)
  for (const line of broken) {
    try {
      // Store as tenant-level record broken (not attached to a specific
      // athlete when not applicable — we do best-effort attach later).
      const holder = insights.highestIndividualScore?.athleteId ?? null;
      if (holder) {
        await createTimelineEntry({
          tenant_id: tenantId,
          athlete_profile_id: holder,
          title: "Academy Record Broken",
          description: line,
          event_date: new Date().toISOString().slice(0, 10),
        });
      }
    } catch {
      // best-effort
    }
  }

  return { updated, broken };
}

/* ================================================================
 * Overview
 * ================================================================ */

export async function computeAcademyOverview(
  tenantId: string,
  config: RecordConfig = DEFAULT_RECORD_CONFIG,
): Promise<AcademyOverview> {
  const [matches, careers, records] = await Promise.all([
    fetchFinalizedMatches(tenantId),
    fetchCareers(tenantId),
    listAcademyRecords(tenantId),
  ]);

  const careersTyped = careers as unknown as Array<
    Record<string, unknown> & {
      runs: number;
      wickets: number;
      matches: number;
      athlete_profile_id: string;
    }
  >;

  const totals = {
    runs: 0,
    wickets: 0,
    sixes: 0,
    fours: 0,
  };
  for (const c of careersTyped) {
    totals.runs += (c.runs as number) ?? 0;
    totals.wickets += (c.wickets as number) ?? 0;
    totals.sixes += (c.sixes as number) ?? 0;
    totals.fours += (c.fours as number) ?? 0;
  }

  const topRunScorer = leaderboardMostRuns(careersTyped, 1)[0] ?? null;
  const topWicketTaker = leaderboardMostWickets(careersTyped, 1)[0] ?? null;
  const topBatter =
    leaderboardHighestAverage(careersTyped, config.minBallsForStrikeRate, 1)[0] ?? null;
  const topBowler = topWicketTaker;
  const mostMatches = leaderboardCareer(careersTyped, "matches", 1)[0] ?? null;
  const mostPlayerOfMatch = leaderboardCareer(careersTyped, "player_of_match", 1)[0] ?? null;

  // Current captain — last finalized match's captain (best-effort)
  let currentCaptain: LeaderboardRow | null = null;
  if (matches.length > 0) {
    const latest = matches[0];
    const { data: squad } = await supabase
      .from("mc_match_squads")
      .select("athlete_profile_id, mc_athlete_profiles(id, students(name))")
      .eq("match_id", latest.id)
      .eq("is_captain", true)
      .limit(1);
    const row = squad?.[0] as
      | {
          athlete_profile_id: string | null;
          mc_athlete_profiles?: { students?: { name?: string } | null } | null;
        }
      | undefined;
    if (row?.athlete_profile_id) {
      currentCaptain = {
        athleteProfileId: row.athlete_profile_id,
        athleteName: row.mc_athlete_profiles?.students?.name ?? "Captain",
        value: 1,
        metadata: {},
      };
    }
  }

  return {
    totalMatches: matches.length,
    totalFinalizedMatches: matches.length,
    totalRuns: totals.runs,
    totalWickets: totals.wickets,
    totalSixes: totals.sixes,
    totalFours: totals.fours,
    topRunScorer,
    topWicketTaker,
    topBatter,
    topBowler,
    mostMatches,
    mostPlayerOfMatch,
    currentCaptain,
    latestRecord: records[0] ?? null,
    recentMilestone: records[0]?.record_type ?? null,
  };
}

/* ================================================================
 * Hall of Fame CRUD
 * ================================================================ */

export interface HallOfFameInput {
  tenantId: string;
  category: string;
  athleteProfileId: string | null;
  achievementTitle: string;
  achievementDescription?: string;
  imageUrl?: string;
  awardedAt?: string;
  createdBy?: string | null;
}

export async function addHallOfFameEntry(input: HallOfFameInput): Promise<MCHallOfFame> {
  const { data, error } = await supabase
    .from("mc_hall_of_fame")
    .insert({
      tenant_id: input.tenantId,
      category: input.category,
      athlete_profile_id: input.athleteProfileId,
      achievement_title: input.achievementTitle,
      achievement_description: input.achievementDescription ?? null,
      image_url: input.imageUrl ?? null,
      awarded_at: input.awardedAt ?? new Date().toISOString().slice(0, 10),
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listHallOfFame(
  tenantId: string,
  category?: string,
): Promise<Array<MCHallOfFame & { athleteName?: string }>> {
  let q = supabase
    .from("mc_hall_of_fame")
    .select("*, mc_athlete_profiles(id, students(name))")
    .eq("tenant_id", tenantId)
    .order("awarded_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const ap = (
      r as unknown as { mc_athlete_profiles?: { students?: { name?: string } | null } | null }
    ).mc_athlete_profiles;
    return { ...(r as MCHallOfFame), athleteName: ap?.students?.name };
  });
}

export async function deleteHallOfFameEntry(id: string): Promise<void> {
  const { error } = await supabase.from("mc_hall_of_fame").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================
 * Global search
 * ================================================================ */

export interface SearchHit {
  kind: "player" | "record" | "hall_of_fame" | "milestone" | "timeline";
  title: string;
  subtitle?: string;
  athleteProfileId?: string | null;
  matchId?: string | null;
  ref?: string;
}

export async function globalSearch(tenantId: string, term: string): Promise<SearchHit[]> {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  const [players, records, hof] = await Promise.all([
    supabase
      .from("mc_athlete_profiles")
      .select("id, students(name)")
      .eq("tenant_id", tenantId)
      .limit(50),
    listAcademyRecords(tenantId),
    listHallOfFame(tenantId),
  ]);

  for (const p of players.data ?? []) {
    const name = (p as unknown as { students?: { name?: string } | null }).students?.name;
    if (name && name.toLowerCase().includes(q)) {
      hits.push({
        kind: "player",
        title: name,
        athleteProfileId: p.id,
      });
    }
  }
  for (const r of records) {
    const name = (r.metadata as Record<string, unknown> | null)?.name?.toString() ?? "";
    const type = r.record_type.replace(/_/g, " ");
    if (type.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
      hits.push({
        kind: "record",
        title: type,
        subtitle: `${name} — ${r.value}`,
        athleteProfileId: r.athlete_profile_id,
        matchId: r.match_id,
        ref: r.id,
      });
    }
  }
  for (const h of hof) {
    if (
      h.achievement_title.toLowerCase().includes(q) ||
      (h.athleteName ?? "").toLowerCase().includes(q) ||
      h.category.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "hall_of_fame",
        title: h.achievement_title,
        subtitle: h.athleteName,
        athleteProfileId: h.athlete_profile_id,
        ref: h.id,
      });
    }
  }
  return hits.slice(0, 100);
}

/* ================================================================
 * Pure-function aliases (re-usable outside React)
 * ================================================================ */

export const calculateAcademyOverview = computeAcademyOverview;
export const calculateTeamRecords = computeTeamRecords;
export const calculateCaptainRecords = computeCaptainRecords;
