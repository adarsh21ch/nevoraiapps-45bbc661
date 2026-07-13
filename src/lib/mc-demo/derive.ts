/* ================================================================
 * Demo Derivation Layer
 * ----------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for every stats/records/leaderboard view
 * rendered against a demo academy. Reads only:
 *   - demo.ballEvents  (immutable event log)
 *   - demo.matches / demo.teams / demo.players (metadata)
 *   - demo.matchSquads (batting/bowling order per match)
 *
 * Feeds the existing statistics engine (`computeBatting`,
 * `computeBowling`, `computeFielding`) — the same primitives used
 * by the real Supabase-backed pipeline — so demo numbers are
 * guaranteed to agree with the scorebook down to the last run.
 *
 * Contract: pure. No I/O, no side-effects, no Date/now.
 * ================================================================ */

import {
  computeBatting,
  computeBowling,
  computeFielding,
  playerKey,
  type BattingStat,
  type BowlingStat,
  type FieldingStat,
} from "@/lib/mc-statistics-engine";
import type { DemoData } from "@/lib/mc-demo/generate";
import type { MCBallEvent } from "@/lib/mc-ball-events";

/* ---------------- Helpers ---------------- */

function eventsFor(demo: DemoData, matchId: string): MCBallEvent[] {
  return demo.ballEvents.filter((e) => e.match_id === matchId);
}

/** Only matches that have any ball events (i.e. actually played). */
export function playedMatches(demo: DemoData) {
  const withEvents = new Set(demo.ballEvents.map((e) => e.match_id));
  return demo.matches.filter((m) => withEvents.has(m.id));
}

function teamNameById(demo: DemoData, teamId: string | null | undefined): string {
  if (!teamId) return "—";
  return demo.teams.find((t) => t.id === teamId)?.name ?? "—";
}

/** Map innings_id → { batting_team_id, bowling_team_id } for O(1) event → team lookup. */
function inningsTeamMap(demo: DemoData): Map<string, { batting: string; bowling: string }> {
  const m = new Map<string, { batting: string; bowling: string }>();
  for (const i of demo.innings) {
    m.set(i.id, { batting: i.batting_team_id, bowling: i.bowling_team_id });
  }
  return m;
}

/* ---------------- Player: career derivation ---------------- */

export interface PlayerMatchLine {
  matchId: string;
  date: string | null;
  opponent: string;
  battedRuns: number;
  battedBalls: number;
  battedOut: boolean;
  bowledOvers: string; // "3.2"
  bowledRuns: number;
  bowledWickets: number;
  fieldingCatches: number;
  fieldingRunOuts: number;
  fieldingStumpings: number;
}

export interface PlayerCareer {
  athleteId: string;
  batting: {
    matches: number;
    innings: number;
    runs: number;
    highest: number;
    average: number;
    strikeRate: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
    ducks: number;
    notOuts: number;
  };
  bowling: {
    innings: number;
    overs: string;
    legalBalls: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    economy: number;
    average: number;
    strikeRate: number;
    bestFigures: string;
    bestWickets: number;
    bestRuns: number;
  };
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
  };
  matchHistory: PlayerMatchLine[];
}

function oversDisplay(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

/** Aggregate a player's entire demo career from ball events. */
export function derivePlayerCareer(
  demo: DemoData,
  athleteId: string,
): PlayerCareer {
  const key = playerKey(athleteId, null);
  const history: PlayerMatchLine[] = [];

  let matches = 0;
  let innings = 0;
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  let fifties = 0;
  let hundreds = 0;
  let ducks = 0;
  let notOuts = 0;
  let highest = 0;

  let bowlInns = 0;
  let bowlLegalBalls = 0;
  let bowlMaidens = 0;
  let bowlRuns = 0;
  let bowlWkts = 0;
  let bestW = 0;
  let bestR = Number.POSITIVE_INFINITY;

  let catches = 0;
  let runOuts = 0;
  let stumpings = 0;

  for (const m of playedMatches(demo)) {
    const events = eventsFor(demo, m.id);
    if (events.length === 0) continue;

    const bat = computeBatting(events);
    const bowl = computeBowling(events);
    const field = computeFielding(events);

    const b: BattingStat | undefined = key ? bat.byKey.get(key) : undefined;
    const bo: BowlingStat | undefined = key ? bowl.byKey.get(key) : undefined;
    const f: FieldingStat | undefined = key ? field.byKey.get(key) : undefined;

    const played = !!b || !!bo || !!f;
    if (!played) continue;
    matches += 1;

    if (b) {
      innings += 1;
      runs += b.runs;
      ballsFaced += b.balls;
      fours += b.fours;
      sixes += b.sixes;
      if (b.isCentury) hundreds += 1;
      else if (b.isHalfCentury) fifties += 1;
      if (b.duck) ducks += 1;
      if (b.notOut) notOuts += 1;
      if (b.runs > highest) highest = b.runs;
    }

    if (bo) {
      bowlInns += 1;
      bowlLegalBalls += bo.legalBalls;
      bowlMaidens += bo.maidens;
      bowlRuns += bo.runsConceded;
      bowlWkts += bo.wickets;
      if (
        bo.bestBowlingWickets > bestW ||
        (bo.bestBowlingWickets === bestW && bo.bestBowlingRuns < bestR)
      ) {
        bestW = bo.bestBowlingWickets;
        bestR = bo.bestBowlingRuns;
      }
    }

    const squadsForMatch = demo.matchSquads?.[m.id] ?? {};
    const teamAId = m.team_a_id ?? "";
    const teamBId = m.team_b_id ?? "";
    const inTeamA = squadsForMatch[teamAId]?.some((p) => p.id === athleteId) ?? false;
    const opponentTeamId = inTeamA ? teamBId : teamAId;
    history.push({
      matchId: m.id,
      date: m.scheduled_date ?? null,
      opponent: teamNameById(demo, opponentTeamId),
      battedRuns: b?.runs ?? 0,
      battedBalls: b?.balls ?? 0,
      battedOut: b ? !b.notOut : false,
      bowledOvers: bo ? oversDisplay(bo.legalBalls) : "0.0",
      bowledRuns: bo?.runsConceded ?? 0,
      bowledWickets: bo?.wickets ?? 0,
      fieldingCatches: f?.catches ?? 0,
      fieldingRunOuts: f?.runOuts ?? 0,
      fieldingStumpings: f?.stumpings ?? 0,
    });

    catches += f?.catches ?? 0;
    runOuts += f?.runOuts ?? 0;
    stumpings += f?.stumpings ?? 0;
  }

  const dismissals = innings - notOuts;
  const average = dismissals > 0 ? runs / dismissals : runs > 0 ? runs : 0;
  const strikeRate = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  const bowlOversStr = oversDisplay(bowlLegalBalls);
  const economy = bowlLegalBalls > 0 ? (bowlRuns / bowlLegalBalls) * 6 : 0;
  const bowlAverage = bowlWkts > 0 ? bowlRuns / bowlWkts : 0;
  const bowlSR = bowlWkts > 0 ? bowlLegalBalls / bowlWkts : 0;
  const bestFigures = bestW > 0 ? `${bestW}/${bestR}` : "—";

  return {
    athleteId,
    batting: {
      matches,
      innings,
      runs,
      highest,
      average: Math.round(average * 100) / 100,
      strikeRate: Math.round(strikeRate * 100) / 100,
      ballsFaced,
      fours,
      sixes,
      fifties,
      hundreds,
      ducks,
      notOuts,
    },
    bowling: {
      innings: bowlInns,
      overs: bowlOversStr,
      legalBalls: bowlLegalBalls,
      maidens: bowlMaidens,
      runsConceded: bowlRuns,
      wickets: bowlWkts,
      economy: Math.round(economy * 100) / 100,
      average: Math.round(bowlAverage * 100) / 100,
      strikeRate: Math.round(bowlSR * 100) / 100,
      bestFigures,
      bestWickets: bestW,
      bestRuns: bestW > 0 ? bestR : 0,
    },
    fielding: { catches, runOuts, stumpings },
    matchHistory: history.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
  };
}

/* ---------------- Team: profile derivation ---------------- */

export interface TeamProfile {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  winPct: number;
  totalRuns: number;
  totalWickets: number;
  highestTotal: number;
  lowestTotal: number;
  squad: Array<{ athleteId: string; name: string }>;
  topBatter: { athleteId: string; name: string; runs: number } | null;
  topBowler: { athleteId: string; name: string; wickets: number } | null;
}

export function deriveTeamProfile(demo: DemoData, teamId: string): TeamProfile {
  let played = 0;
  let won = 0;
  let lost = 0;
  let tied = 0;
  let totalRuns = 0;
  let totalWickets = 0;
  let highestTotal = 0;
  let lowestTotal = Number.POSITIVE_INFINITY;

  const runsByAthlete = new Map<string, number>();
  const wktsByAthlete = new Map<string, number>();
  const squad = new Map<string, string>();

  for (const m of playedMatches(demo)) {
    if (m.team_a_id !== teamId && m.team_b_id !== teamId) continue;
    played += 1;
    const events = eventsFor(demo, m.id);
    // team totals: sum "batting_team_id" runs, "bowling_team_id" wickets
    let ownTotal = 0;
    for (const e of events) {
      if (e.batting_team_id === teamId) {
        ownTotal += (e.runs_off_bat ?? 0) + (e.extra_runs ?? 0);
      }
      if (e.bowling_team_id === teamId) {
        if (e.dismissal_type) totalWickets += 1;
      }
    }
    totalRuns += ownTotal;
    if (ownTotal > highestTotal) highestTotal = ownTotal;
    if (ownTotal < lowestTotal) lowestTotal = ownTotal;

    // W/L/T from stored result string when present, else infer from totals
    const result = (m.result ?? "").toLowerCase();
    const teamName = teamNameById(demo, teamId).toLowerCase();
    if (result.includes("tie")) tied += 1;
    else if (teamName && result.startsWith(teamName)) won += 1;
    else if (m.status === "completed") lost += 1;

    // Batter/bowler aggregates for THIS team's players
    const bat = computeBatting(events);
    const bowl = computeBowling(events);
    const squadForTeam = demo.matchSquads?.[m.id]?.[teamId] ?? [];
    for (const p of squadForTeam) {
      squad.set(p.id, p.name);
      const bkey = playerKey(p.id, null);
      const b = bkey ? bat.byKey.get(bkey) : undefined;
      const bo = bkey ? bowl.byKey.get(bkey) : undefined;
      if (b) runsByAthlete.set(p.id, (runsByAthlete.get(p.id) ?? 0) + b.runs);
      if (bo) wktsByAthlete.set(p.id, (wktsByAthlete.get(p.id) ?? 0) + bo.wickets);
    }
  }

  const winPct = played > 0 ? Math.round((won / played) * 1000) / 10 : 0;
  const lowest = lowestTotal === Number.POSITIVE_INFINITY ? 0 : lowestTotal;

  const topBatter = (() => {
    let best: { athleteId: string; name: string; runs: number } | null = null;
    runsByAthlete.forEach((runs, id) => {
      const name = squad.get(id) ?? "—";
      if (!best || runs > best.runs) best = { athleteId: id, name, runs };
    });
    return best;
  })();

  const topBowler = (() => {
    let best: { athleteId: string; name: string; wickets: number } | null = null;
    wktsByAthlete.forEach((wickets, id) => {
      const name = squad.get(id) ?? "—";
      if (!best || wickets > best.wickets) best = { athleteId: id, name, wickets };
    });
    return best;
  })();

  return {
    teamId,
    played,
    won,
    lost,
    tied,
    winPct,
    totalRuns,
    totalWickets,
    highestTotal,
    lowestTotal: lowest,
    squad: Array.from(squad.entries()).map(([athleteId, name]) => ({ athleteId, name })),
    topBatter,
    topBowler,
  };
}

/* ---------------- Academy leaderboards & records ---------------- */

export interface LeaderRow {
  athleteId: string | null;
  name: string;
  value: number;
  extra?: string;
}

function nameForKey(demo: DemoData, athleteId: string | null, fallback: string) {
  if (!athleteId) return fallback;
  const p = demo.players.find((x) => x.id === athleteId);
  return p?.student?.name ?? fallback;
}

export function deriveLeaderboards(demo: DemoData) {
  const runs = new Map<string, LeaderRow>();
  const wkts = new Map<string, LeaderRow>();
  const boundaries = new Map<string, LeaderRow>();

  for (const m of playedMatches(demo)) {
    const events = eventsFor(demo, m.id);
    const bat = computeBatting(events);
    const bowl = computeBowling(events);

    bat.byKey.forEach((s) => {
      const id = s.player.athleteId;
      const key = id ?? s.player.name ?? s.player.key;
      const name = nameForKey(demo, id, s.player.name ?? "Unknown");
      const rRow = runs.get(key) ?? { athleteId: id, name, value: 0 };
      rRow.value += s.runs;
      runs.set(key, rRow);
      const bRow = boundaries.get(key) ?? { athleteId: id, name, value: 0 };
      bRow.value += s.fours + s.sixes;
      boundaries.set(key, bRow);
    });

    bowl.byKey.forEach((s) => {
      const id = s.player.athleteId;
      const key = id ?? s.player.name ?? s.player.key;
      const name = nameForKey(demo, id, s.player.name ?? "Unknown");
      const wRow = wkts.get(key) ?? { athleteId: id, name, value: 0 };
      wRow.value += s.wickets;
      wkts.set(key, wRow);
    });
  }

  const sortedRuns = Array.from(runs.values())
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const sortedWkts = Array.from(wkts.values())
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const sortedBoundaries = Array.from(boundaries.values())
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    mostRuns: sortedRuns,
    mostWickets: sortedWkts,
    mostBoundaries: sortedBoundaries,
  };
}

export interface RecordRow {
  category: string;
  title: string;
  holderName: string;
  athleteId: string | null;
  value: string;
  matchId?: string;
}

export function deriveRecords(demo: DemoData): RecordRow[] {
  let bestBat: (BattingStat & { matchId: string }) | null = null;
  let bestBowl: (BowlingStat & { matchId: string }) | null = null;
  let mostSixes: LeaderRow | null = null;
  let highestPartnership: {
    p1: string;
    p2: string;
    runs: number;
    matchId: string;
  } | null = null;
  let highestTeamTotal: { team: string; runs: number; matchId: string } | null =
    null;

  const sixesMap = new Map<string, LeaderRow>();

  for (const m of playedMatches(demo)) {
    const events = eventsFor(demo, m.id);
    const bat = computeBatting(events);
    const bowl = computeBowling(events);

    bat.byKey.forEach((s) => {
      if (!bestBat || s.runs > bestBat.runs) bestBat = { ...s, matchId: m.id };
      const id = s.player.athleteId;
      const key = id ?? s.player.name ?? s.player.key;
      const name = nameForKey(demo, id, s.player.name ?? "Unknown");
      const row = sixesMap.get(key) ?? { athleteId: id, name, value: 0 };
      row.value += s.sixes;
      sixesMap.set(key, row);
    });

    bowl.byKey.forEach((s) => {
      if (
        !bestBowl ||
        s.wickets > bestBowl.wickets ||
        (s.wickets === bestBowl.wickets && s.runsConceded < bestBowl.runsConceded)
      ) {
        bestBowl = { ...s, matchId: m.id };
      }
    });

    // Team totals
    const totals = new Map<string, number>();
    for (const e of events) {
      const t = e.batting_team_id;
      if (!t) continue;
      totals.set(t, (totals.get(t) ?? 0) + (e.runs_off_bat ?? 0) + (e.extra_runs ?? 0));
    }
    totals.forEach((runs, teamId) => {
      if (!highestTeamTotal || runs > highestTeamTotal.runs) {
        highestTeamTotal = { team: teamNameById(demo, teamId), runs, matchId: m.id };
      }
    });

    // Highest partnership (approximate: longest unbroken run between two batters)
    let currentPair: { a: string; b: string; runs: number } | null = null;
    let lastStriker = "";
    let lastNonStriker = "";
    for (const e of events) {
      const s = e.striker_name ?? "";
      const ns = e.non_striker_name ?? "";
      if (!s || !ns) continue;
      const pair = [s, ns].sort().join("|");
      const prevPair = [lastStriker, lastNonStriker].sort().join("|");
      if (pair !== prevPair) currentPair = { a: s, b: ns, runs: 0 };
      if (currentPair) {
        currentPair.runs += (e.runs_off_bat ?? 0) + (e.extra_runs ?? 0);
        if (!highestPartnership || currentPair.runs > highestPartnership.runs) {
          highestPartnership = {
            p1: currentPair.a,
            p2: currentPair.b,
            runs: currentPair.runs,
            matchId: m.id,
          };
        }
      }
      if (e.dismissal_type) currentPair = null;
      lastStriker = s;
      lastNonStriker = ns;
    }
  }

  sixesMap.forEach((r) => {
    if (!mostSixes || r.value > mostSixes.value) mostSixes = r;
  });

  const rows: RecordRow[] = [];
  if (bestBat) {
    const b = bestBat as BattingStat & { matchId: string };
    rows.push({
      category: "Batting",
      title: "Highest Individual Score",
      holderName: nameForKey(demo, b.player.athleteId, b.player.name ?? "—"),
      athleteId: b.player.athleteId,
      value: `${b.runs} (${b.balls})`,
      matchId: b.matchId,
    });
  }
  if (bestBowl) {
    const bo = bestBowl as BowlingStat & { matchId: string };
    rows.push({
      category: "Bowling",
      title: "Best Bowling Figures",
      holderName: nameForKey(demo, bo.player.athleteId, bo.player.name ?? "—"),
      athleteId: bo.player.athleteId,
      value: `${bo.wickets}/${bo.runsConceded}`,
      matchId: bo.matchId,
    });
  }
  if (highestPartnership) {
    const hp = highestPartnership as {
      p1: string;
      p2: string;
      runs: number;
      matchId: string;
    };
    rows.push({
      category: "Partnership",
      title: "Highest Partnership",
      holderName: `${hp.p1} & ${hp.p2}`,
      athleteId: null,
      value: `${hp.runs} runs`,
      matchId: hp.matchId,
    });
  }
  if (highestTeamTotal) {
    const ht = highestTeamTotal as { team: string; runs: number; matchId: string };
    rows.push({
      category: "Team",
      title: "Highest Team Total",
      holderName: ht.team,
      athleteId: null,
      value: `${ht.runs}`,
      matchId: ht.matchId,
    });
  }
  if (mostSixes) {
    const ms = mostSixes as LeaderRow;
    rows.push({
      category: "Batting",
      title: "Most Sixes",
      holderName: ms.name,
      athleteId: ms.athleteId,
      value: String(ms.value),
    });
  }
  return rows;
}
