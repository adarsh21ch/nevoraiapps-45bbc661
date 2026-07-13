/* ================================================================
 * Player Career Engine
 * ----------------------------------------------------------------
 * Automatically aggregates every finalized match's Ball Events into
 * a per-athlete career cache (`mc_player_careers`).
 *
 * Contract:
 *   - Cache is NEVER edited manually.
 *   - Cache is ALWAYS rebuildable from finalized matches.
 *   - Unlocking a match → rebuild affected athletes.
 *   - Every finalization → incremental refresh of participants.
 *
 * Pipeline:
 *   ball_events → statistics-engine (pure) → career aggregator → cache
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listMatchBallEvents } from "@/lib/mc-ball-events";
import {
  computeBatting,
  computeBowling,
  computeFielding,
  type BattingStat,
  type BowlingStat,
} from "@/lib/mc-statistics-engine";
import { createTimelineEntry } from "@/lib/mc-athletes";

export type MCPlayerCareer =
  Database["public"]["Tables"]["mc_player_careers"]["Row"];

export interface CareerAggregate {
  matches: number;
  innings: number;
  not_outs: number;
  runs: number;
  balls: number;
  highest_score: number;
  highest_score_not_out: boolean;
  average: number;
  strike_rate: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  golden_ducks: number;
  silver_ducks: number;
  wickets: number;
  balls_bowled: number;
  overs: number;
  maidens: number;
  runs_conceded: number;
  best_bowling_wickets: number;
  best_bowling_runs: number;
  best_bowling: string;
  five_wicket_hauls: number;
  ten_wicket_hauls: number;
  economy: number;
  bowling_average: number;
  bowling_strike_rate: number;
  catches: number;
  stumpings: number;
  run_outs: number;
  captain_matches: number;
  captain_wins: number;
  captain_losses: number;
  player_of_match: number;
}

function emptyAggregate(): CareerAggregate {
  return {
    matches: 0,
    innings: 0,
    not_outs: 0,
    runs: 0,
    balls: 0,
    highest_score: 0,
    highest_score_not_out: false,
    average: 0,
    strike_rate: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    ducks: 0,
    golden_ducks: 0,
    silver_ducks: 0,
    wickets: 0,
    balls_bowled: 0,
    overs: 0,
    maidens: 0,
    runs_conceded: 0,
    best_bowling_wickets: 0,
    best_bowling_runs: 0,
    best_bowling: "0/0",
    five_wicket_hauls: 0,
    ten_wicket_hauls: 0,
    economy: 0,
    bowling_average: 0,
    bowling_strike_rate: 0,
    catches: 0,
    stumpings: 0,
    run_outs: 0,
    captain_matches: 0,
    captain_wins: 0,
    captain_losses: 0,
    player_of_match: 0,
  };
}

/* ================================================================
 * Pure functions — combine per-match rows into a career aggregate
 * ================================================================ */

export interface MatchContribution {
  athleteId: string;
  batting: BattingStat | null;
  bowling: BowlingStat | null;
  catches: number;
  stumpings: number;
  runOuts: number;
  captained: boolean;
  captainWon: boolean;
  captainLost: boolean;
  playerOfMatch: boolean;
  participated: boolean; // was in squad OR appeared in ball events
}

/** Merge a set of per-match contributions (single athlete) into an aggregate. */
export function aggregateCareer(contributions: MatchContribution[]): CareerAggregate {
  const agg = emptyAggregate();
  let bestBW = 0;
  let bestBR = 999999;

  for (const c of contributions) {
    if (!c.participated) continue;
    agg.matches += 1;
    if (c.playerOfMatch) agg.player_of_match += 1;
    if (c.captained) {
      agg.captain_matches += 1;
      if (c.captainWon) agg.captain_wins += 1;
      if (c.captainLost) agg.captain_losses += 1;
    }

    if (c.batting) {
      const b = c.batting;
      agg.innings += 1;
      if (b.notOut) agg.not_outs += 1;
      agg.runs += b.runs;
      agg.balls += b.balls;
      agg.fours += b.fours;
      agg.sixes += b.sixes;
      if (b.isHalfCentury) agg.fifties += 1;
      if (b.isCentury) agg.hundreds += 1;
      if (b.duck) agg.ducks += 1;
      if (b.goldenDuck) agg.golden_ducks += 1;
      if (b.silverDuck) agg.silver_ducks += 1;
      if (b.runs > agg.highest_score) {
        agg.highest_score = b.runs;
        agg.highest_score_not_out = b.notOut;
      }
    }

    if (c.bowling) {
      const bw = c.bowling;
      agg.wickets += bw.wickets;
      agg.balls_bowled += bw.legalBalls;
      agg.runs_conceded += bw.runsConceded;
      agg.maidens += bw.maidens;
      if (bw.wickets >= 5) agg.five_wicket_hauls += 1;
      if (bw.wickets >= 10) agg.ten_wicket_hauls += 1;
      if (
        bw.wickets > bestBW ||
        (bw.wickets === bestBW && bw.runsConceded < bestBR)
      ) {
        bestBW = bw.wickets;
        bestBR = bw.runsConceded;
      }
    }

    agg.catches += c.catches;
    agg.stumpings += c.stumpings;
    agg.run_outs += c.runOuts;
  }

  const dismissals = agg.innings - agg.not_outs;
  agg.average = dismissals > 0 ? +(agg.runs / dismissals).toFixed(2) : agg.runs;
  agg.strike_rate = agg.balls > 0 ? +((agg.runs / agg.balls) * 100).toFixed(2) : 0;

  agg.overs = +(Math.floor(agg.balls_bowled / 6) + (agg.balls_bowled % 6) / 10).toFixed(1);
  const oversFloat = Math.floor(agg.balls_bowled / 6) + (agg.balls_bowled % 6) / 6;
  agg.economy = oversFloat > 0 ? +(agg.runs_conceded / oversFloat).toFixed(2) : 0;
  agg.bowling_average = agg.wickets > 0 ? +(agg.runs_conceded / agg.wickets).toFixed(2) : 0;
  agg.bowling_strike_rate = agg.wickets > 0 ? +(agg.balls_bowled / agg.wickets).toFixed(2) : 0;

  if (bestBW > 0 || bestBR < 999999) {
    agg.best_bowling_wickets = bestBW;
    agg.best_bowling_runs = bestBR === 999999 ? 0 : bestBR;
    agg.best_bowling = `${bestBW}/${agg.best_bowling_runs}`;
  }

  return agg;
}

/* ================================================================
 * Per-match extraction
 * ================================================================ */

interface MatchMeta {
  matchId: string;
  tenantId: string;
  winnerTeamId: string | null;
  playerOfMatchAthleteId: string | null;
  finalizedAt: string | null;
}

interface SquadRow {
  athlete_profile_id: string | null;
  team_id: string;
  is_captain: boolean;
}

/** For one finalized match, extract every athlete's per-match contribution. */
export async function extractMatchContributions(
  matchId: string,
): Promise<{ meta: MatchMeta; contributions: Map<string, MatchContribution> }> {
  const { data: match, error: mErr } = await supabase
    .from("mc_matches")
    .select(
      "id, tenant_id, winner_team, player_of_match_athlete_id, finalized_at, match_locked",
    )
    .eq("id", matchId)
    .single();
  if (mErr || !match) throw mErr ?? new Error("Match not found");

  const meta: MatchMeta = {
    matchId: match.id,
    tenantId: match.tenant_id,
    winnerTeamId: match.winner_team,
    playerOfMatchAthleteId: match.player_of_match_athlete_id,
    finalizedAt: match.finalized_at,
  };

  const events = await listBallEventsForMatch(matchId);

  const { data: squads } = await supabase
    .from("mc_match_squads")
    .select("athlete_profile_id, team_id, is_captain")
    .eq("match_id", matchId);
  const squadRows: SquadRow[] = (squads ?? []) as SquadRow[];

  const batting = computeBatting(events);
  const bowling = computeBowling(events);
  const fielding = computeFielding(events);

  const contributions = new Map<string, MatchContribution>();

  const touch = (id: string): MatchContribution => {
    let c = contributions.get(id);
    if (!c) {
      c = {
        athleteId: id,
        batting: null,
        bowling: null,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        captained: false,
        captainWon: false,
        captainLost: false,
        playerOfMatch: false,
        participated: false,
      };
      contributions.set(id, c);
    }
    return c;
  };

  // Squad participation + captain flag
  for (const s of squadRows) {
    if (!s.athlete_profile_id) continue;
    const c = touch(s.athlete_profile_id);
    c.participated = true;
    if (s.is_captain) {
      c.captained = true;
      if (meta.winnerTeamId && meta.winnerTeamId === s.team_id) c.captainWon = true;
      else if (meta.winnerTeamId && meta.winnerTeamId !== s.team_id) c.captainLost = true;
    }
  }

  // Batting
  for (const b of batting.byKey.values()) {
    const id = b.player.athleteId;
    if (!id) continue;
    const c = touch(id);
    c.batting = b;
    c.participated = true;
  }

  // Bowling
  for (const bw of bowling.byKey.values()) {
    const id = bw.player.athleteId;
    if (!id) continue;
    const c = touch(id);
    c.bowling = bw;
    c.participated = true;
  }

  // Fielding
  for (const f of fielding.byKey.values()) {
    const id = f.player.athleteId;
    if (!id) continue;
    const c = touch(id);
    c.catches += f.catches;
    c.stumpings += f.stumpings;
    c.runOuts += f.runOuts;
    c.participated = true;
  }

  // Player of match
  if (meta.playerOfMatchAthleteId) {
    touch(meta.playerOfMatchAthleteId).playerOfMatch = true;
  }

  return { meta, contributions };
}

/* ================================================================
 * Cache write
 * ================================================================ */

async function upsertCareerRow(
  tenantId: string,
  athleteProfileId: string,
  agg: CareerAggregate,
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    athlete_profile_id: athleteProfileId,
    ...agg,
    last_rebuilt_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("mc_player_careers")
    .upsert(payload, { onConflict: "tenant_id,athlete_profile_id" });
  if (error) throw error;
}

/* ================================================================
 * Rebuild functions
 * ================================================================ */

/** Rebuild the career cache for one athlete from scratch. */
export async function rebuildCareer(athleteProfileId: string): Promise<MCPlayerCareer | null> {
  const { data: athlete, error: aErr } = await supabase
    .from("mc_athlete_profiles")
    .select("id, tenant_id")
    .eq("id", athleteProfileId)
    .single();
  if (aErr || !athlete) throw aErr ?? new Error("Athlete not found");

  // Find every finalized match this athlete participated in (via squad OR events).
  const { data: squadMatches } = await supabase
    .from("mc_match_squads")
    .select("match_id")
    .eq("athlete_profile_id", athleteProfileId);
  const { data: strikerEvents } = await supabase
    .from("mc_ball_events")
    .select("match_id")
    .eq("striker_athlete_id", athleteProfileId)
    .limit(5000);
  const { data: bowlerEvents } = await supabase
    .from("mc_ball_events")
    .select("match_id")
    .eq("bowler_athlete_id", athleteProfileId)
    .limit(5000);

  const matchIds = new Set<string>();
  (squadMatches ?? []).forEach((r) => r.match_id && matchIds.add(r.match_id));
  (strikerEvents ?? []).forEach((r) => r.match_id && matchIds.add(r.match_id));
  (bowlerEvents ?? []).forEach((r) => r.match_id && matchIds.add(r.match_id));

  if (matchIds.size === 0) {
    await upsertCareerRow(athlete.tenant_id, athleteProfileId, emptyAggregate());
    return await getCareer(athleteProfileId);
  }

  // Filter to finalized matches only.
  const { data: finalized } = await supabase
    .from("mc_matches")
    .select("id")
    .in("id", Array.from(matchIds))
    .eq("match_locked", true);
  const finalizedIds = (finalized ?? []).map((m) => m.id);

  const contributions: MatchContribution[] = [];
  for (const mId of finalizedIds) {
    const { contributions: perMatch } = await extractMatchContributions(mId);
    const c = perMatch.get(athleteProfileId);
    if (c) contributions.push(c);
  }

  const agg = aggregateCareer(contributions);
  await upsertCareerRow(athlete.tenant_id, athleteProfileId, agg);
  return await getCareer(athleteProfileId);
}

/**
 * After a match is finalized, refresh the cache for every participant.
 * Rebuilds each athlete from all their finalized matches (safe & idempotent).
 */
export async function updateCareersForMatch(matchId: string): Promise<{
  updated: string[];
  milestones: number;
}> {
  const { meta, contributions } = await extractMatchContributions(matchId);
  const athleteIds = Array.from(contributions.keys());
  let milestones = 0;

  for (const athleteId of athleteIds) {
    const prev = await getCareer(athleteId);
    await rebuildCareer(athleteId);
    const next = await getCareer(athleteId);
    if (prev && next) {
      milestones += await detectAndRecordMilestones(
        meta.tenantId,
        athleteId,
        prev,
        next,
        contributions.get(athleteId)!,
      );
    } else if (next) {
      // Debut path
      milestones += await detectAndRecordMilestones(
        meta.tenantId,
        athleteId,
        null,
        next,
        contributions.get(athleteId)!,
      );
    }
  }

  return { updated: athleteIds, milestones };
}

/**
 * Rebuild careers affected by unlocking a match. Same as update — because
 * rebuildCareer always reads from finalized matches, an unlocked match is
 * naturally excluded until re-finalized.
 */
export async function rebuildCareersAfterUnlock(matchId: string): Promise<string[]> {
  const { contributions } = await extractMatchContributions(matchId);
  const ids = Array.from(contributions.keys());
  for (const id of ids) await rebuildCareer(id);
  return ids;
}

/* ================================================================
 * Milestones (append to mc_athlete_timeline)
 * ================================================================ */

async function detectAndRecordMilestones(
  tenantId: string,
  athleteId: string,
  prev: MCPlayerCareer | null,
  next: MCPlayerCareer,
  match: MatchContribution,
): Promise<number> {
  const events: { title: string; description: string }[] = [];
  const p = prev ?? {
    matches: 0,
    runs: 0,
    wickets: 0,
    hundreds: 0,
    fifties: 0,
    five_wicket_hauls: 0,
    ten_wicket_hauls: 0,
    captain_matches: 0,
    player_of_match: 0,
  } as unknown as MCPlayerCareer;

  if (p.matches === 0 && next.matches >= 1) {
    events.push({ title: "Match Debut", description: "Made first career appearance" });
  }
  if (p.runs === 0 && next.runs > 0) {
    events.push({ title: "First Career Run", description: `Scored first run` });
  }
  if (p.wickets === 0 && next.wickets > 0) {
    events.push({ title: "First Career Wicket", description: `Took first wicket` });
  }
  if (p.fifties < next.fifties && match.batting?.isHalfCentury) {
    events.push({ title: "Half Century", description: `Scored ${match.batting.runs}` });
  }
  if (p.hundreds < next.hundreds && match.batting?.isCentury) {
    events.push({ title: "Century", description: `Scored ${match.batting.runs}` });
  }
  if (p.five_wicket_hauls < next.five_wicket_hauls) {
    events.push({
      title: "Five Wicket Haul",
      description: `Took ${match.bowling?.wickets ?? 5} wickets`,
    });
  }
  if (p.ten_wicket_hauls < next.ten_wicket_hauls) {
    events.push({
      title: "Ten Wicket Haul",
      description: `Took ${match.bowling?.wickets ?? 10} wickets`,
    });
  }
  if (p.runs < 1000 && next.runs >= 1000) {
    events.push({ title: "1000 Career Runs", description: "Crossed 1000 runs milestone" });
  }
  if (p.matches < 100 && next.matches >= 100) {
    events.push({ title: "100 Matches", description: "Played 100 career matches" });
  }
  if (p.captain_matches === 0 && next.captain_matches >= 1) {
    events.push({ title: "Captain Debut", description: "Captained for the first time" });
  }
  if (p.player_of_match < next.player_of_match) {
    events.push({ title: "Player of the Match", description: "Awarded Player of the Match" });
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const e of events) {
    try {
      await createTimelineEntry({
        tenant_id: tenantId,
        athlete_profile_id: athleteId,
        title: e.title,
        description: e.description,
        event_date: today,
      });
    } catch {
      // best-effort; timeline is non-critical
    }
  }
  return events.length;
}

/* ================================================================
 * Reads
 * ================================================================ */

export async function getCareer(
  athleteProfileId: string,
): Promise<MCPlayerCareer | null> {
  const { data, error } = await supabase
    .from("mc_player_careers")
    .select("*")
    .eq("athlete_profile_id", athleteProfileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface CareerTimelinePoint {
  matchId: string;
  matchDate: string | null;
  runs: number;
  wickets: number;
  battingAverageToDate: number;
  strikeRateToDate: number;
}

/**
 * Build a chronological performance timeline for an athlete across finalized
 * matches. Pure over cache-independent data — used by career graphs.
 */
export async function getCareerTimeline(
  athleteProfileId: string,
): Promise<CareerTimelinePoint[]> {
  const { data: squadMatches } = await supabase
    .from("mc_match_squads")
    .select("match_id")
    .eq("athlete_profile_id", athleteProfileId);
  const matchIds = Array.from(
    new Set((squadMatches ?? []).map((r) => r.match_id).filter(Boolean) as string[]),
  );
  if (matchIds.length === 0) return [];

  const { data: matches } = await supabase
    .from("mc_matches")
    .select("id, scheduled_date, finalized_at, match_locked")
    .in("id", matchIds)
    .eq("match_locked", true)
    .order("finalized_at", { ascending: true });

  const points: CareerTimelinePoint[] = [];
  let cumRuns = 0;
  let cumBalls = 0;
  let cumInnings = 0;
  let cumNotOuts = 0;

  for (const m of matches ?? []) {
    const { contributions } = await extractMatchContributions(m.id);
    const c = contributions.get(athleteProfileId);
    if (!c) continue;
    const runs = c.batting?.runs ?? 0;
    const balls = c.batting?.balls ?? 0;
    const wickets = c.bowling?.wickets ?? 0;
    if (c.batting) {
      cumInnings += 1;
      if (c.batting.notOut) cumNotOuts += 1;
      cumRuns += runs;
      cumBalls += balls;
    }
    const dismissals = cumInnings - cumNotOuts;
    points.push({
      matchId: m.id,
      matchDate: m.finalized_at ?? m.scheduled_date ?? null,
      runs,
      wickets,
      battingAverageToDate:
        dismissals > 0 ? +(cumRuns / dismissals).toFixed(2) : cumRuns,
      strikeRateToDate:
        cumBalls > 0 ? +((cumRuns / cumBalls) * 100).toFixed(2) : 0,
    });
  }
  return points;
}

/* ================================================================
 * Pure-function aliases (reusable outside React)
 * ================================================================ */

export const calculateCareerAggregate = aggregateCareer;
