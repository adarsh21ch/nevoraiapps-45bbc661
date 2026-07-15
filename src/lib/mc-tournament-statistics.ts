/* ================================================================
 * Tournament Statistics Engine
 * ----------------------------------------------------------------
 * ORCHESTRATOR ONLY. Never re-implements per-match math.
 *
 *   Statistics Engine (mc-statistics-engine.ts) → per-match batting/
 *      bowling/fielding/extras/partnership tables.
 *   Tournament Engine (mc-tournament-engine.ts) → standings, Orange/
 *      Purple Cap, high-level tournament records.
 *   Career Engine (mc-career-engine.ts) → per-player lifetime.
 *
 * This module aggregates the Statistics Engine's per-match outputs
 * across every finalized tournament match to produce a unified
 * analytics view:
 *   - dashboard KPIs
 *   - batting / bowling / fielding leaderboards
 *   - team-level stats
 *   - match-level records (closest / biggest / highest / lowest)
 *   - per-player profile summary (for the drill-in dialog)
 *
 * All math is pure. Realtime is provided by re-invalidating the
 * analytics query key on `mc_matches` change (see the UI component).
 *
 * Future extension points (NOT implemented):
 *   - AI Insights                → consume `TournamentAnalytics`
 *   - Predictive rankings        → hydrate `PlayerBattingRow` / `PlayerBowlingRow`
 *   - Historical / cross-season  → merge multiple `TournamentAnalytics`
 *   - Cross-academy comparison   → same shape, different loader
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import { listMatchBallEvents, type MCBallEvent } from "@/lib/mc-ball-events";
import {
  computeBatting,
  computeBowling,
  computeFielding,
  computeExtras,
  playerKey,
  type BattingStat,
  type BowlingStat,
  type FieldingStat,
  type PlayerKey,
} from "@/lib/mc-statistics-engine";

/* ================================================================
 * Filters
 * ================================================================ */

export interface TournamentStatsFilters {
  teamId?: string | null;
  groupId?: string | null;
  playerKey?: string | null;
  matchId?: string | null;
  fromDate?: string | null; // ISO yyyy-mm-dd
  toDate?: string | null;
}

/* ================================================================
 * Raw per-match analytics data (batched load)
 * ================================================================ */

interface MatchMeta {
  id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  winner_team: string | null;
  victory_type: string | null;
  winning_margin: number | null;
  winning_margin_type: string | null; // 'runs' | 'wickets' | null
  overs: number;
  scheduled_date: string | null;
  result: string | null;
  player_of_match_athlete_id: string | null;
  group_id: string | null;
}

interface InningsRow {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  innings_number: number;
}

export interface AnalyticsMatch {
  meta: MatchMeta;
  innings: InningsRow[];
  events: MCBallEvent[];
}

export interface AnalyticsData {
  matches: AnalyticsMatch[];
  teamNames: Map<string, string>;
}

export async function loadTournamentAnalyticsData(
  tournamentId: string,
): Promise<AnalyticsData> {
  const { data: mRows } = await supabase
    .from("mc_matches")
    .select(
      `id, team_a_id, team_b_id, winner_team, victory_type, winning_margin,
       winning_margin_type, overs, scheduled_date, result,
       player_of_match_athlete_id, group_id,
       team_a:mc_teams!mc_matches_team_a_id_fkey(id,name),
       team_b:mc_teams!mc_matches_team_b_id_fkey(id,name)`,
    )
    .eq("tournament_id", tournamentId)
    .eq("match_locked", true);

  const rows = (mRows ?? []) as Array<{
    id: string;
    team_a_id: string;
    team_b_id: string;
    winner_team: string | null;
    victory_type: string | null;
    winning_margin: number | null;
    winning_margin_type: string | null;
    overs: number;
    scheduled_date: string | null;
    result: string | null;
    player_of_match_athlete_id: string | null;
    group_id: string | null;
    team_a: { id: string; name: string } | null;
    team_b: { id: string; name: string } | null;
  }>;
  const matchIds = rows.map((r) => r.id);
  const teamNames = new Map<string, string>();
  const metas: MatchMeta[] = rows.map((r) => {
    const ta = r.team_a;
    const tb = r.team_b;
    if (ta) teamNames.set(ta.id, ta.name);
    if (tb) teamNames.set(tb.id, tb.name);
    return {
      id: r.id,
      team_a_id: r.team_a_id,
      team_b_id: r.team_b_id,
      team_a_name: ta?.name ?? null,
      team_b_name: tb?.name ?? null,
      winner_team: r.winner_team,
      victory_type: r.victory_type,
      winning_margin: r.winning_margin,
      winning_margin_type: r.winning_margin_type,
      overs: r.overs,
      scheduled_date: r.scheduled_date,
      result: r.result,
      player_of_match_athlete_id: r.player_of_match_athlete_id,
      group_id: r.group_id,
    };
  });

  let inningsRows: InningsRow[] = [];
  if (matchIds.length > 0) {
    const { data } = await supabase
      .from("mc_innings")
      .select(
        "id, match_id, batting_team_id, bowling_team_id, runs, wickets, overs, balls, innings_number",
      )
      .in("match_id", matchIds);
    inningsRows = (data ?? []) as InningsRow[];
  }
  const inningsByMatch = new Map<string, InningsRow[]>();
  for (const i of inningsRows) {
    const arr = inningsByMatch.get(i.match_id) ?? [];
    arr.push(i);
    inningsByMatch.set(i.match_id, arr);
  }

  const matches: AnalyticsMatch[] = [];
  for (const meta of metas) {
    const events = await listMatchBallEvents(meta.id);
    matches.push({
      meta,
      innings: (inningsByMatch.get(meta.id) ?? []).sort(
        (a, b) => a.innings_number - b.innings_number,
      ),
      events,
    });
  }

  return { matches, teamNames };
}

/* ================================================================
 * Analytics shape
 * ================================================================ */

export interface DashboardKPI {
  totalMatches: number;
  totalPlayers: number;
  totalRuns: number;
  totalWickets: number;
  totalBalls: number;
  totalBoundaries: number;
  totalFours: number;
  totalSixes: number;
  totalExtras: number;
  averageScore: number;
  highestScore: { runs: number; wickets: number; teamId: string; matchId: string } | null;
  lowestDefended: { runs: number; teamId: string; matchId: string } | null;
  highestChase: { runs: number; teamId: string; matchId: string } | null;
}

export interface PlayerBattingRow {
  key: PlayerKey;
  athleteId: string | null;
  name: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  highest: number;
  notOuts: number;
  dismissed: number;
  average: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  potm: number;
  matchWinning: number; // >=50 in a match his team won
  recentScores: number[];
  perMatch: { matchId: string; runs: number; balls: number; notOut: boolean }[];
}

export interface PlayerBowlingRow {
  key: PlayerKey;
  athleteId: string | null;
  name: string;
  matches: number;
  wickets: number;
  runsConceded: number;
  balls: number;
  maidens: number;
  dots: number;
  fiveWicketHauls: number;
  hatTricks: number;
  matchWinning: number; // >=3 wickets in a match his team won
  bestRuns: number;
  bestWickets: number;
  bestDisplay: string;
  economy: number;
  average: number;
  strikeRate: number;
  perMatch: { matchId: string; wickets: number; runs: number; balls: number }[];
}

export interface PlayerFieldingRow {
  key: PlayerKey;
  athleteId: string | null;
  name: string;
  catches: number;
  runOuts: number;
  stumpings: number;
  directHits: number;
  fieldingPoints: number; // 10*catch + 12*stump + 8*run-out + 5 bonus for direct hit
}

export interface TeamAnalyticsRow {
  teamId: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  highest: number;
  lowest: number;
  highestChase: number;
  lowestDefended: number | null;
  powerplayAvg: number; // runs per innings in first 6 overs
  deathAvg: number;    // runs per innings in last 4 overs
  runRate: number;
  boundaryPct: number;
  dotBallPct: number;
}

export interface MatchAnalyticsRow {
  matchId: string;
  teamA: string;
  teamB: string;
  winner: string | null;
  marginText: string;
  totalRuns: number;
  totalWickets: number;
  scheduledDate: string | null;
  isSuperOver: boolean;
  excitementScore: number; // lower margin + more runs → more exciting
}

export interface TournamentAnalytics {
  dashboard: DashboardKPI;
  batting: PlayerBattingRow[];
  bowling: PlayerBowlingRow[];
  fielding: PlayerFieldingRow[];
  teams: TeamAnalyticsRow[];
  matches: MatchAnalyticsRow[];
  filteredMatchCount: number;
}

/* ================================================================
 * Pure aggregator
 * ================================================================ */

function matchPassesFilters(m: AnalyticsMatch, f: TournamentStatsFilters): boolean {
  if (f.teamId && m.meta.team_a_id !== f.teamId && m.meta.team_b_id !== f.teamId)
    return false;
  if (f.groupId && m.meta.group_id !== f.groupId) return false;
  if (f.matchId && m.meta.id !== f.matchId) return false;
  const d = m.meta.scheduled_date;
  if (f.fromDate && (!d || d < f.fromDate)) return false;
  if (f.toDate && (!d || d > f.toDate)) return false;
  return true;
}

function detectHatTricks(events: MCBallEvent[]): Map<string, number> {
  // Consecutive wickets by same bowler across legal deliveries (not necessarily same over).
  const map = new Map<string, number>();
  let streakKey: string | null = null;
  let streak = 0;
  for (const e of events) {
    const bkey = playerKey(e.bowler_athlete_id, e.bowler_name);
    if (!bkey) {
      streak = 0;
      streakKey = null;
      continue;
    }
    if (e.dismissal_type && (e.dismissal_type === "bowled" || e.dismissal_type === "caught" || e.dismissal_type === "lbw" || e.dismissal_type === "stumped" || e.dismissal_type === "hit_wicket" || e.dismissal_type === "caught_and_bowled")) {
      if (bkey === streakKey) streak += 1;
      else {
        streakKey = bkey;
        streak = 1;
      }
      if (streak >= 3) {
        map.set(bkey, (map.get(bkey) ?? 0) + 1);
        streak = 0; // reset after crediting so hat-trick isn't recounted
        streakKey = null;
      }
    } else if (e.dismissal_type) {
      // run-out / retired etc — break the streak (not credited to bowler)
      streak = 0;
      streakKey = null;
    }
  }
  return map;
}

function powerplayDeathFromEvents(
  events: MCBallEvent[],
  totalOvers: number,
): { pp: number; death: number; ppInnings: number; deathInnings: number } {
  // Group by innings (over_number is per-innings). We treat innings switch as
  // when over_number decreases.
  let pp = 0, death = 0, ppInnings = 0, deathInnings = 0;
  let prevOver = -1;
  let inningsSeenPP = false;
  let inningsSeenDeath = false;
  const deathStart = Math.max(0, totalOvers - 4);
  for (const e of events) {
    if (e.over_number < prevOver) {
      if (inningsSeenPP) ppInnings += 1;
      if (inningsSeenDeath) deathInnings += 1;
      inningsSeenPP = false;
      inningsSeenDeath = false;
    }
    const runs = (e.runs_off_bat ?? 0) + (e.extra_runs ?? 0);
    if (e.over_number < 6) {
      pp += runs;
      inningsSeenPP = true;
    }
    if (e.over_number >= deathStart) {
      death += runs;
      inningsSeenDeath = true;
    }
    prevOver = e.over_number;
  }
  if (inningsSeenPP) ppInnings += 1;
  if (inningsSeenDeath) deathInnings += 1;
  return { pp, death, ppInnings, deathInnings };
}

export function buildTournamentAnalytics(
  data: AnalyticsData,
  filters: TournamentStatsFilters = {},
): TournamentAnalytics {
  const matches = data.matches.filter((m) => matchPassesFilters(m, filters));

  const dashboard: DashboardKPI = {
    totalMatches: matches.length,
    totalPlayers: 0,
    totalRuns: 0,
    totalWickets: 0,
    totalBalls: 0,
    totalBoundaries: 0,
    totalFours: 0,
    totalSixes: 0,
    totalExtras: 0,
    averageScore: 0,
    highestScore: null,
    lowestDefended: null,
    highestChase: null,
  };

  // Per-player accumulators
  const bat = new Map<string, PlayerBattingRow>();
  const bowl = new Map<string, PlayerBowlingRow>();
  const field = new Map<string, PlayerFieldingRow>();
  const playersSeen = new Set<string>();

  // Per-team accumulators
  interface TeamAcc {
    teamId: string;
    name: string;
    matches: Set<string>;
    wins: number;
    losses: number;
    scoresBatted: number[];
    ballsFaced: number;
    ppRuns: number; ppInnings: number;
    deathRuns: number; deathInnings: number;
    boundaries: number;
    dotBalls: number;
    legalBallsFaced: number;
    chases: number[]; // successful chase totals
    defended: number[]; // successful defended totals
  }
  const teams = new Map<string, TeamAcc>();
  const ensureTeam = (id: string): TeamAcc => {
    let t = teams.get(id);
    if (!t) {
      t = {
        teamId: id,
        name: data.teamNames.get(id) ?? "—",
        matches: new Set(),
        wins: 0,
        losses: 0,
        scoresBatted: [],
        ballsFaced: 0,
        ppRuns: 0, ppInnings: 0,
        deathRuns: 0, deathInnings: 0,
        boundaries: 0,
        dotBalls: 0,
        legalBallsFaced: 0,
        chases: [],
        defended: [],
      };
      teams.set(id, t);
    }
    return t;
  };

  const matchRows: MatchAnalyticsRow[] = [];

  for (const m of matches) {
    const { meta, innings, events } = m;
    const battingTbl = computeBatting(events);
    const bowlingTbl = computeBowling(events);
    const fieldingTbl = computeFielding(events);
    const extras = computeExtras(events);
    const hatTricks = detectHatTricks(events);

    // Team-scoped totals from innings rows (canonical)
    const teamA = ensureTeam(meta.team_a_id);
    const teamB = ensureTeam(meta.team_b_id);
    teamA.matches.add(meta.id);
    teamB.matches.add(meta.id);

    if (meta.winner_team === meta.team_a_id) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (meta.winner_team === meta.team_b_id) {
      teamB.wins += 1;
      teamA.losses += 1;
    }

    // Totals
    let matchRuns = 0;
    let matchWkts = 0;
    for (const inn of innings) {
      matchRuns += inn.runs;
      matchWkts += inn.wickets;
      dashboard.totalRuns += inn.runs;
      dashboard.totalWickets += inn.wickets;
      dashboard.totalBalls += inn.overs * 6 + inn.balls;

      const bt = ensureTeam(inn.batting_team_id);
      bt.scoresBatted.push(inn.runs);
      bt.ballsFaced += inn.overs * 6 + inn.balls;

      // highest / chase / defended
      if (!dashboard.highestScore || inn.runs > dashboard.highestScore.runs) {
        dashboard.highestScore = {
          runs: inn.runs,
          wickets: inn.wickets,
          teamId: inn.batting_team_id,
          matchId: meta.id,
        };
      }
    }

    // First innings total for defended/chase logic
    if (innings.length >= 2 && meta.winner_team) {
      const first = innings[0];
      const second = innings[1];
      const firstBattingTeam = first.batting_team_id;
      const secondBattingTeam = second.batting_team_id;
      if (meta.winner_team === firstBattingTeam) {
        // defended
        ensureTeam(firstBattingTeam).defended.push(first.runs);
        if (!dashboard.lowestDefended || first.runs < dashboard.lowestDefended.runs) {
          dashboard.lowestDefended = {
            runs: first.runs,
            teamId: firstBattingTeam,
            matchId: meta.id,
          };
        }
      } else if (meta.winner_team === secondBattingTeam) {
        // chase
        ensureTeam(secondBattingTeam).chases.push(second.runs);
        if (!dashboard.highestChase || second.runs > dashboard.highestChase.runs) {
          dashboard.highestChase = {
            runs: second.runs,
            teamId: secondBattingTeam,
            matchId: meta.id,
          };
        }
      }
    }

    dashboard.totalExtras += extras.total;

    // Powerplay / death (both innings combined for team-level averages
    // via batting team; we approximate by attributing pp/death runs to
    // whichever team was batting at the time).
    const pd = powerplayDeathFromEvents(events, meta.overs);
    // Attribute pp/death to both teams proportionally by innings share.
    // Simpler: split between the two batting sides using their innings runs share.
    const totalInn = innings.reduce((a, b) => a + b.runs, 0) || 1;
    for (const inn of innings) {
      const t = ensureTeam(inn.batting_team_id);
      const share = inn.runs / totalInn;
      t.ppRuns += pd.pp * share;
      t.deathRuns += pd.death * share;
      t.ppInnings += 1;
      t.deathInnings += 1;
    }

    // Team-level ball-based counters (attribute via innings_number → batting team)
    const teamByInnings = new Map<number, { batting: string; bowling: string }>();
    for (const inn of innings) {
      teamByInnings.set(inn.innings_number, {
        batting: inn.batting_team_id,
        bowling: inn.bowling_team_id,
      });
    }
    for (const e of events) {
      const runsOff = e.runs_off_bat ?? 0;
      const tm = teamByInnings.get(e.innings_number);
      if (!tm) continue;
      const bt = ensureTeam(tm.batting);
      if (e.extra_type !== "wide") bt.legalBallsFaced += 1;
      if (runsOff === 4 || runsOff === 6) bt.boundaries += 1;
      if (
        e.extra_type == null &&
        runsOff === 0 &&
        !e.dismissal_type
      ) bt.dotBalls += 1;
    }

    // Batting stats aggregation
    for (const bstat of battingTbl.byKey.values()) {
      const key = bstat.player.key;
      let row = bat.get(key);
      if (!row) {
        row = {
          key,
          athleteId: bstat.player.athleteId,
          name: bstat.player.name ?? "—",
          matches: 0,
          innings: 0,
          runs: 0,
          balls: 0,
          highest: 0,
          notOuts: 0,
          dismissed: 0,
          average: 0,
          strikeRate: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          ducks: 0,
          potm: 0,
          matchWinning: 0,
          recentScores: [],
          perMatch: [],
        };
        bat.set(key, row);
      }
      playersSeen.add(key);
      row.matches += 1;
      row.innings += 1;
      row.runs += bstat.runs;
      row.balls += bstat.balls;
      row.fours += bstat.fours;
      row.sixes += bstat.sixes;
      row.highest = Math.max(row.highest, bstat.runs);
      if (bstat.notOut) row.notOuts += 1;
      else row.dismissed += 1;
      if (bstat.duck) row.ducks += 1;
      if (bstat.isHalfCentury) row.fifties += 1;
      if (bstat.isCentury) row.hundreds += 1;
      row.perMatch.push({
        matchId: meta.id,
        runs: bstat.runs,
        balls: bstat.balls,
        notOut: bstat.notOut,
      });
      row.recentScores.push(bstat.runs);
      // Match-winning innings: batter's team won
      const batterTeamWon = (meta.winner_team === meta.team_a_id || meta.winner_team === meta.team_b_id) &&
        eventsPlayerTeam(events, bstat) === meta.winner_team;
      if (batterTeamWon && (bstat.runs >= 50 || (battingTbl.highestScore && battingTbl.highestScore.player.key === key))) {
        row.matchWinning += 1;
      }
    }

    dashboard.totalBoundaries += Array.from(battingTbl.byKey.values()).reduce(
      (a, b) => a + b.fours + b.sixes,
      0,
    );
    dashboard.totalFours += Array.from(battingTbl.byKey.values()).reduce((a, b) => a + b.fours, 0);
    dashboard.totalSixes += Array.from(battingTbl.byKey.values()).reduce((a, b) => a + b.sixes, 0);

    // Bowling stats aggregation
    for (const bwstat of bowlingTbl.byKey.values()) {
      const key = bwstat.player.key;
      let row = bowl.get(key);
      if (!row) {
        row = {
          key,
          athleteId: bwstat.player.athleteId,
          name: bwstat.player.name ?? "—",
          matches: 0,
          wickets: 0,
          runsConceded: 0,
          balls: 0,
          maidens: 0,
          dots: 0,
          fiveWicketHauls: 0,
          hatTricks: 0,
          matchWinning: 0,
          bestRuns: 0,
          bestWickets: 0,
          bestDisplay: "—",
          economy: 0,
          average: 0,
          strikeRate: 0,
          perMatch: [],
        };
        bowl.set(key, row);
      }
      playersSeen.add(key);
      row.matches += 1;
      row.wickets += bwstat.wickets;
      row.runsConceded += bwstat.runsConceded;
      row.balls += bwstat.legalBalls;
      row.maidens += bwstat.maidens;
      row.dots += bwstat.dotBalls;
      if (bwstat.wickets >= 5) row.fiveWicketHauls += 1;
      if (
        bwstat.wickets > row.bestWickets ||
        (bwstat.wickets === row.bestWickets && bwstat.runsConceded < row.bestRuns)
      ) {
        row.bestWickets = bwstat.wickets;
        row.bestRuns = bwstat.runsConceded;
        row.bestDisplay = `${bwstat.wickets}/${bwstat.runsConceded}`;
      }
      row.perMatch.push({
        matchId: meta.id,
        wickets: bwstat.wickets,
        runs: bwstat.runsConceded,
        balls: bwstat.legalBalls,
      });
      // Match-winning spell: >=3 wickets in a match his team won.
      const bowlerTeamWon = (meta.winner_team === meta.team_a_id || meta.winner_team === meta.team_b_id) &&
        eventsBowlerTeam(events, bwstat) === meta.winner_team;
      if (bowlerTeamWon && bwstat.wickets >= 3) row.matchWinning += 1;
      const h = hatTricks.get(key);
      if (h) row.hatTricks = (row.hatTricks ?? 0) + h;
    }

    // Fielding aggregation
    for (const fstat of fieldingTbl.byKey.values()) {
      const key = fstat.player.key;
      let row = field.get(key);
      if (!row) {
        row = {
          key,
          athleteId: fstat.player.athleteId,
          name: fstat.player.name ?? "—",
          catches: 0,
          runOuts: 0,
          stumpings: 0,
          directHits: 0,
          fieldingPoints: 0,
        };
        field.set(key, row);
      }
      playersSeen.add(key);
      row.catches += fstat.catches;
      row.runOuts += fstat.runOuts;
      row.stumpings += fstat.stumpings;
      row.directHits += fstat.directHitRunOuts;
    }

    // POTM
    if (meta.player_of_match_athlete_id) {
      const key = `id:${meta.player_of_match_athlete_id}`;
      const row = bat.get(key);
      if (row) row.potm += 1;
    }

    // Match row
    const marginText = meta.victory_margin != null && meta.victory_margin_type
      ? `${meta.victory_margin} ${meta.victory_margin_type}`
      : meta.result ?? "";
    const excitement =
      matchRuns / Math.max(1, meta.victory_margin ?? 999);
    matchRows.push({
      matchId: meta.id,
      teamA: meta.team_a_name ?? "—",
      teamB: meta.team_b_name ?? "—",
      winner:
        meta.winner_team === meta.team_a_id
          ? meta.team_a_name
          : meta.winner_team === meta.team_b_id
            ? meta.team_b_name
            : null,
      marginText,
      totalRuns: matchRuns,
      totalWickets: matchWkts,
      scheduledDate: meta.scheduled_date,
      isSuperOver: (meta.victory_type ?? "").toLowerCase().includes("super"),
      excitementScore: excitement,
    });
  }

  // Finalize derived batting metrics
  for (const r of bat.values()) {
    r.average = r.dismissed > 0 ? +(r.runs / r.dismissed).toFixed(2) : r.runs;
    r.strikeRate = r.balls > 0 ? +((r.runs / r.balls) * 100).toFixed(2) : 0;
    r.recentScores = r.recentScores.slice(-5);
  }
  for (const r of bowl.values()) {
    const oversFloat = Math.floor(r.balls / 6) + (r.balls % 6) / 6;
    r.economy = oversFloat > 0 ? +(r.runsConceded / oversFloat).toFixed(2) : 0;
    r.average = r.wickets > 0 ? +(r.runsConceded / r.wickets).toFixed(2) : 0;
    r.strikeRate = r.wickets > 0 ? +(r.balls / r.wickets).toFixed(2) : 0;
  }
  for (const r of field.values()) {
    r.fieldingPoints = r.catches * 10 + r.stumpings * 12 + r.runOuts * 8 + r.directHits * 5;
  }

  dashboard.totalPlayers = playersSeen.size;
  dashboard.averageScore =
    matches.length > 0
      ? +(
          Array.from(teams.values()).reduce(
            (a, t) => a + t.scoresBatted.reduce((x, y) => x + y, 0),
            0,
          ) /
          Math.max(
            1,
            Array.from(teams.values()).reduce((a, t) => a + t.scoresBatted.length, 0),
          )
        ).toFixed(1)
      : 0;

  // Finalize team rows
  const teamRows: TeamAnalyticsRow[] = Array.from(teams.values()).map((t) => {
    const matchesCount = t.matches.size;
    const highest = t.scoresBatted.length ? Math.max(...t.scoresBatted) : 0;
    const lowest = t.scoresBatted.length ? Math.min(...t.scoresBatted) : 0;
    const totalRunsBatted = t.scoresBatted.reduce((a, b) => a + b, 0);
    const oversFaced = t.ballsFaced / 6;
    const runRate = oversFaced > 0 ? +(totalRunsBatted / oversFaced).toFixed(2) : 0;
    return {
      teamId: t.teamId,
      name: t.name,
      matches: matchesCount,
      wins: t.wins,
      losses: t.losses,
      winPct: matchesCount > 0 ? +((t.wins / matchesCount) * 100).toFixed(1) : 0,
      highest,
      lowest,
      highestChase: t.chases.length ? Math.max(...t.chases) : 0,
      lowestDefended: t.defended.length ? Math.min(...t.defended) : null,
      powerplayAvg: t.ppInnings > 0 ? +(t.ppRuns / t.ppInnings).toFixed(1) : 0,
      deathAvg: t.deathInnings > 0 ? +(t.deathRuns / t.deathInnings).toFixed(1) : 0,
      runRate,
      boundaryPct:
        t.legalBallsFaced > 0
          ? +((t.boundaries / t.legalBallsFaced) * 100).toFixed(1)
          : 0,
      dotBallPct:
        t.legalBallsFaced > 0
          ? +((t.dotBalls / t.legalBallsFaced) * 100).toFixed(1)
          : 0,
    };
  });

  return {
    dashboard,
    batting: Array.from(bat.values()),
    bowling: Array.from(bowl.values()),
    fielding: Array.from(field.values()),
    teams: teamRows,
    matches: matchRows,
    filteredMatchCount: matches.length,
  };
}

/* ================================================================
 * Helpers to figure out which team a player represented in a match
 * (approx — looks at first appearance in events).
 * ================================================================ */

function eventsPlayerTeam(events: MCBallEvent[], bstat: BattingStat): string | null {
  for (const e of events) {
    if (
      (bstat.player.athleteId && e.striker_athlete_id === bstat.player.athleteId) ||
      (!bstat.player.athleteId && e.striker_name === bstat.player.name)
    ) {
      return e.batting_team_id ?? null;
    }
  }
  return null;
}

function eventsBowlerTeam(events: MCBallEvent[], bwstat: BowlingStat): string | null {
  for (const e of events) {
    if (
      (bwstat.player.athleteId && e.bowler_athlete_id === bwstat.player.athleteId) ||
      (!bwstat.player.athleteId && e.bowler_name === bwstat.player.name)
    ) {
      return e.bowling_team_id ?? null;
    }
  }
  return null;
}

/* ================================================================
 * Convenience sort helpers used by the UI leaderboards.
 * ================================================================ */

export const battingSorts = {
  runs: (a: PlayerBattingRow, b: PlayerBattingRow) => b.runs - a.runs || b.strikeRate - a.strikeRate,
  highest: (a: PlayerBattingRow, b: PlayerBattingRow) => b.highest - a.highest,
  average: (a: PlayerBattingRow, b: PlayerBattingRow) => b.average - a.average,
  strikeRate: (a: PlayerBattingRow, b: PlayerBattingRow) => b.strikeRate - a.strikeRate,
  fifties: (a: PlayerBattingRow, b: PlayerBattingRow) => b.fifties - a.fifties,
  hundreds: (a: PlayerBattingRow, b: PlayerBattingRow) => b.hundreds - a.hundreds,
  fours: (a: PlayerBattingRow, b: PlayerBattingRow) => b.fours - a.fours,
  sixes: (a: PlayerBattingRow, b: PlayerBattingRow) => b.sixes - a.sixes,
  ducks: (a: PlayerBattingRow, b: PlayerBattingRow) => b.ducks - a.ducks,
  notOuts: (a: PlayerBattingRow, b: PlayerBattingRow) => b.notOuts - a.notOuts,
  potm: (a: PlayerBattingRow, b: PlayerBattingRow) => b.potm - a.potm,
  matchWinning: (a: PlayerBattingRow, b: PlayerBattingRow) => b.matchWinning - a.matchWinning,
} as const;

export const bowlingSorts = {
  wickets: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.wickets - a.wickets || a.economy - b.economy,
  best: (a: PlayerBowlingRow, b: PlayerBowlingRow) =>
    b.bestWickets - a.bestWickets || a.bestRuns - b.bestRuns,
  economy: (a: PlayerBowlingRow, b: PlayerBowlingRow) => a.economy - b.economy,
  strikeRate: (a: PlayerBowlingRow, b: PlayerBowlingRow) => a.strikeRate - b.strikeRate,
  maidens: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.maidens - a.maidens,
  dots: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.dots - a.dots,
  fiveWicketHauls: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.fiveWicketHauls - a.fiveWicketHauls,
  hatTricks: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.hatTricks - a.hatTricks,
  matchWinning: (a: PlayerBowlingRow, b: PlayerBowlingRow) => b.matchWinning - a.matchWinning,
} as const;

export const fieldingSorts = {
  catches: (a: PlayerFieldingRow, b: PlayerFieldingRow) => b.catches - a.catches,
  runOuts: (a: PlayerFieldingRow, b: PlayerFieldingRow) => b.runOuts - a.runOuts,
  stumpings: (a: PlayerFieldingRow, b: PlayerFieldingRow) => b.stumpings - a.stumpings,
  directHits: (a: PlayerFieldingRow, b: PlayerFieldingRow) => b.directHits - a.directHits,
  points: (a: PlayerFieldingRow, b: PlayerFieldingRow) => b.fieldingPoints - a.fieldingPoints,
} as const;

/* ================================================================
 * Simple CSV export helper (used by the UI).
 * ================================================================ */

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
