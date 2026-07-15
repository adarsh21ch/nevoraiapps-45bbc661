/* ================================================================
 * Tournament Engine
 * ----------------------------------------------------------------
 * ORCHESTRATOR ONLY — never owns statistics.
 *
 *   Ball Event Engine      → source of truth
 *   Rules Engine           → cricket logic
 *   Statistics Engine      → per-innings/match stats (reused here)
 *   Career Engine          → player lifetime aggregates
 *   Tournament Engine (▲)  → competition-level aggregation of the above
 *
 * Rules:
 *   - Standings/NRR derived from `mc_innings` + `mc_matches` (final).
 *   - Orange/Purple Cap use the Statistics Engine's Batting/Bowling
 *     tables aggregated across finalized tournament matches. NEVER
 *     re-implemented here.
 *   - Records (highest score, best bowling, most sixes/fours) reuse
 *     the same Statistics Engine outputs.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import { listMatchBallEvents, type MCBallEvent } from "@/lib/mc-ball-events";
import {
  computeBatting,
  computeBowling,
  computePartnerships,
  type BattingStat,
  type BowlingStat,
} from "@/lib/mc-statistics-engine";
import type { MCTournament } from "@/lib/mc-tournaments";

/* ================================================================
 * Standings + NRR
 * ================================================================ */

interface InningsRow {
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  status: string;
}

interface MatchRow {
  id: string;
  team_a_id: string;
  team_b_id: string;
  winner_team: string | null;
  victory_type: string | null;
  match_locked: boolean;
  overs: number;
}

interface TeamAgg {
  team_id: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  runs_scored: number;
  runs_conceded: number;
  overs_faced: number;
  overs_bowled: number;
  wickets_lost: number;
  wickets_taken: number;
}

const emptyTeam = (id: string): TeamAgg => ({
  team_id: id,
  played: 0,
  won: 0,
  lost: 0,
  tied: 0,
  no_result: 0,
  points: 0,
  runs_scored: 0,
  runs_conceded: 0,
  overs_faced: 0,
  overs_bowled: 0,
  wickets_lost: 0,
  wickets_taken: 0,
});

/** Overs display "12.3" (3 legal balls into 13th over) → 12.5 decimal. */
function toOversDecimal(overs: number, balls: number): number {
  return overs + balls / 6;
}

/**
 * NRR contribution for a single match. If a side is bowled out, they are
 * credited with the full quota of overs on the runs-scored side (official ICC
 * rule). Reads innings + match quota.
 */
function nrrOversForInnings(inn: InningsRow, quotaOvers: number, isAllOut: boolean): number {
  return isAllOut ? quotaOvers : toOversDecimal(inn.overs, inn.balls);
}

export function computeStandings(
  tournament: Pick<
    MCTournament,
    "points_for_win" | "points_for_tie" | "points_for_loss" | "points_for_no_result" | "overs"
  >,
  matches: MatchRow[],
  innings: InningsRow[],
  teamIds: string[],
): TeamAgg[] {
  const teams = new Map<string, TeamAgg>();
  for (const id of teamIds) teams.set(id, emptyTeam(id));

  const inningsByMatch = new Map<string, InningsRow[]>();
  for (const i of innings) {
    if (!inningsByMatch.has(i.match_id)) inningsByMatch.set(i.match_id, []);
    inningsByMatch.get(i.match_id)!.push(i);
  }

  for (const m of matches) {
    if (!m.match_locked) continue;
    const a = teams.get(m.team_a_id);
    const b = teams.get(m.team_b_id);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;

    // Result → points
    if (m.victory_type === "won" && m.winner_team) {
      if (m.winner_team === m.team_a_id) {
        a.won += 1;
        b.lost += 1;
        a.points += Number(tournament.points_for_win);
        b.points += Number(tournament.points_for_loss);
      } else {
        b.won += 1;
        a.lost += 1;
        b.points += Number(tournament.points_for_win);
        a.points += Number(tournament.points_for_loss);
      }
    } else if (m.victory_type === "tie") {
      a.tied += 1;
      b.tied += 1;
      a.points += Number(tournament.points_for_tie);
      b.points += Number(tournament.points_for_tie);
    } else if (m.victory_type === "no_result" || m.victory_type === "abandoned") {
      a.no_result += 1;
      b.no_result += 1;
      a.points += Number(tournament.points_for_no_result);
      b.points += Number(tournament.points_for_no_result);
    }

    // NRR contribution
    const quota = Number(m.overs) || Number(tournament.overs) || 20;
    const matchInnings = inningsByMatch.get(m.id) ?? [];
    for (const inn of matchInnings) {
      const batter = teams.get(inn.batting_team_id);
      const bowler = teams.get(inn.bowling_team_id);
      if (!batter || !bowler) continue;
      const allOut = inn.wickets >= 10;
      const oversUsed = nrrOversForInnings(inn, quota, allOut);
      batter.runs_scored += inn.runs;
      batter.overs_faced += oversUsed;
      batter.wickets_lost += inn.wickets;
      bowler.runs_conceded += inn.runs;
      bowler.overs_bowled += oversUsed;
      bowler.wickets_taken += inn.wickets;
    }
  }

  return Array.from(teams.values());
}

export function netRunRate(agg: TeamAgg): number {
  const rr = agg.overs_faced > 0 ? agg.runs_scored / agg.overs_faced : 0;
  const rc = agg.overs_bowled > 0 ? agg.runs_conceded / agg.overs_bowled : 0;
  return +(rr - rc).toFixed(3);
}

/* ================================================================
 * Rebuild standings cache
 * ================================================================ */

export async function rebuildTournamentStandings(tournamentId: string): Promise<void> {
  const { data: t, error: tErr } = await supabase
    .from("mc_tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (tErr || !t) throw tErr ?? new Error("Tournament not found");

  const { data: registered } = await supabase
    .from("mc_tournament_teams")
    .select("team_id")
    .eq("tournament_id", tournamentId);
  const teamIds = (registered ?? []).map((r) => r.team_id);

  const { data: matches } = await supabase
    .from("mc_matches")
    .select("id, team_a_id, team_b_id, winner_team, victory_type, match_locked, overs")
    .eq("tournament_id", tournamentId);
  const matchList = (matches ?? []) as MatchRow[];

  const matchIds = matchList.map((m) => m.id);
  let innings: InningsRow[] = [];
  if (matchIds.length > 0) {
    const { data } = await supabase
      .from("mc_innings")
      .select("match_id, batting_team_id, bowling_team_id, runs, wickets, overs, balls, status")
      .in("match_id", matchIds);
    innings = (data ?? []) as InningsRow[];
  }

  const aggs = computeStandings(t, matchList, innings, teamIds);
  // sort: points desc, NRR desc, wins desc
  const enriched = aggs
    .map((a) => ({ ...a, net_run_rate: netRunRate(a) }))
    .sort((x, y) => y.points - x.points || y.net_run_rate - x.net_run_rate || y.won - x.won);

  const now = new Date().toISOString();
  for (let i = 0; i < enriched.length; i++) {
    const a = enriched[i];
    const { error } = await supabase
      .from("mc_tournament_teams")
      .update({
        played: a.played,
        won: a.won,
        lost: a.lost,
        tied: a.tied,
        no_result: a.no_result,
        points: a.points,
        net_run_rate: a.net_run_rate,
        runs_scored: a.runs_scored,
        runs_conceded: a.runs_conceded,
        overs_faced: +a.overs_faced.toFixed(2),
        overs_bowled: +a.overs_bowled.toFixed(2),
        wickets_lost: a.wickets_lost,
        wickets_taken: a.wickets_taken,
        position: i + 1,
        last_rebuilt_at: now,
      })
      .eq("tournament_id", tournamentId)
      .eq("team_id", a.team_id);
    if (error) throw error;
  }
}

/** Called after finalizeMatch/unlockMatch — refresh the linked tournament. */
export async function updateTournamentForMatch(matchId: string): Promise<void> {
  const { data } = await supabase
    .from("mc_matches")
    .select("tournament_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!data?.tournament_id) return;
  await rebuildTournamentStandings(data.tournament_id);
  // Propagate knockout winners to the next bracket slot (no-op for league games).
  const { advanceKnockoutWinner } = await import("@/lib/mc-fixture-engine");
  await advanceKnockoutWinner(matchId);
}

/* ================================================================
 * Aggregated stats from finalized tournament matches
 * (Orange Cap, Purple Cap, Records — all reuse the Statistics Engine)
 * ================================================================ */

async function loadFinalizedTournamentEvents(
  tournamentId: string,
): Promise<{ matchId: string; events: MCBallEvent[] }[]> {
  const { data: matches } = await supabase
    .from("mc_matches")
    .select("id, match_locked")
    .eq("tournament_id", tournamentId)
    .eq("match_locked", true);
  const finalizedIds = (matches ?? []).map((m) => m.id);
  const out: { matchId: string; events: MCBallEvent[] }[] = [];
  for (const id of finalizedIds) {
    const events = await listMatchBallEvents(id);
    out.push({ matchId: id, events });
  }
  return out;
}

export interface CapEntry {
  athleteId: string | null;
  name: string | null;
  runs: number;
  balls: number;
  average: number;
  strikeRate: number;
  matches: number;
  fours: number;
  sixes: number;
  notOuts: number;
}

export interface PurpleEntry {
  athleteId: string | null;
  name: string | null;
  wickets: number;
  runsConceded: number;
  balls: number;
  economy: number;
  average: number;
  matches: number;
}

/**
 * Aggregate the Statistics Engine's per-match Batting tables into a
 * competition-level leaderboard. The Statistics Engine owns the per-match
 * math; we only sum keyed rows across matches.
 */
export async function computeOrangeCap(tournamentId: string): Promise<CapEntry[]> {
  const perMatch = await loadFinalizedTournamentEvents(tournamentId);
  const acc = new Map<string, CapEntry & { dismissed: number }>();
  for (const { events } of perMatch) {
    const table = computeBatting(events);
    for (const b of table.byKey.values()) {
      const key = b.player.athleteId ?? `name:${b.player.name}`;
      let row = acc.get(key);
      if (!row) {
        row = {
          athleteId: b.player.athleteId,
          name: b.player.name,
          runs: 0,
          balls: 0,
          average: 0,
          strikeRate: 0,
          matches: 0,
          fours: 0,
          sixes: 0,
          notOuts: 0,
          dismissed: 0,
        };
        acc.set(key, row);
      }
      row.runs += b.runs;
      row.balls += b.balls;
      row.fours += b.fours;
      row.sixes += b.sixes;
      row.matches += 1;
      if (b.notOut) row.notOuts += 1;
      else row.dismissed += 1;
    }
  }
  return Array.from(acc.values())
    .map((r) => ({
      athleteId: r.athleteId,
      name: r.name,
      runs: r.runs,
      balls: r.balls,
      matches: r.matches,
      fours: r.fours,
      sixes: r.sixes,
      notOuts: r.notOuts,
      average: r.dismissed > 0 ? +(r.runs / r.dismissed).toFixed(2) : r.runs,
      strikeRate: r.balls > 0 ? +((r.runs / r.balls) * 100).toFixed(2) : 0,
    }))
    .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);
}

export async function computePurpleCap(tournamentId: string): Promise<PurpleEntry[]> {
  const perMatch = await loadFinalizedTournamentEvents(tournamentId);
  const acc = new Map<string, PurpleEntry>();
  for (const { events } of perMatch) {
    const table = computeBowling(events);
    for (const bw of table.byKey.values()) {
      const key = bw.player.athleteId ?? `name:${bw.player.name}`;
      let row = acc.get(key);
      if (!row) {
        row = {
          athleteId: bw.player.athleteId,
          name: bw.player.name,
          wickets: 0,
          runsConceded: 0,
          balls: 0,
          economy: 0,
          average: 0,
          matches: 0,
        };
        acc.set(key, row);
      }
      row.wickets += bw.wickets;
      row.runsConceded += bw.runsConceded;
      row.balls += bw.legalBalls;
      row.matches += 1;
    }
  }
  return Array.from(acc.values())
    .map((r) => {
      const oversFloat = Math.floor(r.balls / 6) + (r.balls % 6) / 6;
      return {
        ...r,
        economy: oversFloat > 0 ? +(r.runsConceded / oversFloat).toFixed(2) : 0,
        average: r.wickets > 0 ? +(r.runsConceded / r.wickets).toFixed(2) : 0,
      };
    })
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
}

/* ================================================================
 * Tournament Records
 * ================================================================ */

export interface TournamentRecords {
  highestTeamScore: { matchId: string; teamId: string; runs: number; wickets: number } | null;
  lowestTeamScore: { matchId: string; teamId: string; runs: number; wickets: number } | null;
  bestBowling: {
    matchId: string;
    athleteId: string | null;
    name: string | null;
    wickets: number;
    runs: number;
  } | null;
  highestPartnership: { matchId: string; runs: number; a: string | null; b: string | null } | null;
  mostSixes: { athleteId: string | null; name: string | null; sixes: number } | null;
  mostFours: { athleteId: string | null; name: string | null; fours: number } | null;
}

export async function computeTournamentRecords(tournamentId: string): Promise<TournamentRecords> {
  const perMatch = await loadFinalizedTournamentEvents(tournamentId);

  const rec: TournamentRecords = {
    highestTeamScore: null,
    lowestTeamScore: null,
    bestBowling: null,
    highestPartnership: null,
    mostSixes: null,
    mostFours: null,
  };

  // Team scores from mc_innings
  const matchIds = perMatch.map((m) => m.matchId);
  if (matchIds.length > 0) {
    const { data: innings } = await supabase
      .from("mc_innings")
      .select("match_id, batting_team_id, runs, wickets")
      .in("match_id", matchIds);
    for (const i of innings ?? []) {
      if (!rec.highestTeamScore || i.runs > rec.highestTeamScore.runs) {
        rec.highestTeamScore = {
          matchId: i.match_id,
          teamId: i.batting_team_id,
          runs: i.runs,
          wickets: i.wickets,
        };
      }
      if (!rec.lowestTeamScore || i.runs < rec.lowestTeamScore.runs) {
        rec.lowestTeamScore = {
          matchId: i.match_id,
          teamId: i.batting_team_id,
          runs: i.runs,
          wickets: i.wickets,
        };
      }
    }
  }

  // Best bowling + boundaries via Statistics Engine
  const sixesByKey = new Map<
    string,
    { name: string | null; athleteId: string | null; sixes: number }
  >();
  const foursByKey = new Map<
    string,
    { name: string | null; athleteId: string | null; fours: number }
  >();

  for (const { matchId, events } of perMatch) {
    const bowling = computeBowling(events);
    for (const bw of bowling.byKey.values()) {
      if (
        !rec.bestBowling ||
        bw.wickets > rec.bestBowling.wickets ||
        (bw.wickets === rec.bestBowling.wickets && bw.runsConceded < rec.bestBowling.runs)
      ) {
        rec.bestBowling = {
          matchId,
          athleteId: bw.player.athleteId,
          name: bw.player.name,
          wickets: bw.wickets,
          runs: bw.runsConceded,
        };
      }
    }
    const batting = computeBatting(events);
    for (const b of batting.byKey.values()) {
      const key = b.player.athleteId ?? `name:${b.player.name}`;
      const s = sixesByKey.get(key) ?? {
        name: b.player.name,
        athleteId: b.player.athleteId,
        sixes: 0,
      };
      s.sixes += b.sixes;
      sixesByKey.set(key, s);
      const f = foursByKey.get(key) ?? {
        name: b.player.name,
        athleteId: b.player.athleteId,
        fours: 0,
      };
      f.fours += b.fours;
      foursByKey.set(key, f);
    }

    const parts = computePartnerships(events);
    for (const p of parts.partnerships) {
      if (!rec.highestPartnership || p.runs > rec.highestPartnership.runs) {
        rec.highestPartnership = {
          matchId,
          runs: p.runs,
          a: p.batterA?.name ?? null,
          b: p.batterB?.name ?? null,
        };
      }
    }
  }

  let topSixes: (typeof sixesByKey extends Map<string, infer V> ? V : never) | null = null;
  for (const v of sixesByKey.values()) {
    if (!topSixes || v.sixes > topSixes.sixes) topSixes = v;
  }
  rec.mostSixes = topSixes;
  let topFours: (typeof foursByKey extends Map<string, infer V> ? V : never) | null = null;
  for (const v of foursByKey.values()) {
    if (!topFours || v.fours > topFours.fours) topFours = v;
  }
  rec.mostFours = topFours;

  return rec;
}

/* ================================================================
 * Pure aliases
 * ================================================================ */

export const calculateStandings = computeStandings;
export const calculateNetRunRate = netRunRate;
export const calculateOrangeCap = computeOrangeCap;
export const calculatePurpleCap = computePurpleCap;
export const calculateTournamentRecords = computeTournamentRecords;

// re-exports for consumers who want to build custom aggregations
export type { BattingStat, BowlingStat };
