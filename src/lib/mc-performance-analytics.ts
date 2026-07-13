/* ================================================================
 * Performance Analytics — READ-ONLY intelligence layer.
 * ----------------------------------------------------------------
 * NO new cricket math. NO duplicate statistics. NO new engines.
 *
 * Every number produced here is derived by consuming existing
 * engines:
 *   - Ball Event Engine       (mc-ball-events)
 *   - Statistics Engine       (mc-statistics-engine)
 *   - Career Engine           (mc-career-engine)
 *
 * This file only aggregates & shapes those engine outputs into
 * views useful for coaches (form curves, consistency, splits).
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import { extractMatchContributions, getCareer } from "@/lib/mc-career-engine";
import type { MatchContribution } from "@/lib/mc-career-engine";
import type { BattingStat, BowlingStat } from "@/lib/mc-statistics-engine";

/* ---------------- Types ---------------- */

export interface MatchLite {
  id: string;
  scheduled_date: string | null;
  finalized_at: string | null;
  match_type: string;
  match_format: string | null;
  ground_name: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team: string | null;
  match_locked: boolean;
  tournament_id: string | null;
  overs: number | null;
}

export interface PerfPoint {
  matchId: string;
  date: string | null;
  runs: number;
  balls: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  strikeRate: number;
  economy: number;
  battingAvgToDate: number;
  won: boolean | null;
}

export interface SplitBucket {
  label: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  average: number;
  strikeRate: number;
  wickets: number;
  ballsBowled: number;
  economy: number;
}

export interface DismissalBreakdown {
  type: string;
  count: number;
  pct: number;
}

export interface PlayerPerformance {
  athleteId: string;
  points: PerfPoint[]; // chronological, all matches
  totals: SplitBucket; // all matches
  byMatchType: SplitBucket[];
  byInningsOrder: SplitBucket[]; // "Batting first", "Chasing"
  byResult: SplitBucket[]; // "Wins", "Losses"
  byVenue: SplitBucket[]; // "Home", "Away", "Neutral"
  dismissals: DismissalBreakdown[];
  consistency: {
    score: number; // 0..100
    band: "Excellent" | "Good" | "Average" | "Needs Improvement";
    runsStdDev: number;
    wicketsStdDev: number;
  };
  form: {
    last5: SplitBucket;
    last10: SplitBucket;
    last20: SplitBucket;
    trend: "up" | "down" | "flat";
    trendDelta: number; // recent avg - prior avg
  };
}

/* ---------------- Helpers ---------------- */

const EMPTY_BUCKET = (label: string): SplitBucket => ({
  label,
  matches: 0,
  innings: 0,
  runs: 0,
  balls: 0,
  average: 0,
  strikeRate: 0,
  wickets: 0,
  ballsBowled: 0,
  economy: 0,
});

function accumulate(b: SplitBucket, c: MatchContribution, dismissed: boolean) {
  b.matches += 1;
  if (c.batting) {
    b.innings += 1;
    b.runs += c.batting.runs;
    b.balls += c.batting.balls;
  }
  if (c.bowling) {
    b.wickets += c.bowling.wickets;
    b.ballsBowled += c.bowling.legalBalls;
  }
  if (dismissed) {
    // used later to compute avg
  }
}

function finalizeBucket(b: SplitBucket, dismissals: number, runsConcededTotal: number) {
  b.average = dismissals > 0 ? +(b.runs / dismissals).toFixed(2) : +b.runs.toFixed(2);
  b.strikeRate = b.balls > 0 ? +((b.runs / b.balls) * 100).toFixed(1) : 0;
  const overs = b.ballsBowled / 6;
  b.economy = overs > 0 ? +(runsConcededTotal / overs).toFixed(2) : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/* Coefficient of variation → consistency 0-100 (lower CV = higher score). */
function consistencyFromValues(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean <= 0) return 0;
  const cv = stdDev(values) / mean;
  const score = Math.max(0, Math.min(100, 100 - cv * 60));
  return Math.round(score);
}

function bandFor(score: number): PlayerPerformance["consistency"]["band"] {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Average";
  return "Needs Improvement";
}

/* ---------------- Data loading ---------------- */

async function listPlayerMatches(
  athleteId: string,
  tenantId: string,
): Promise<MatchLite[]> {
  const { data: sq } = await supabase
    .from("mc_match_squads")
    .select("match_id")
    .eq("athlete_profile_id", athleteId);
  const ids = Array.from(
    new Set((sq ?? []).map((s) => s.match_id).filter(Boolean) as string[]),
  );
  if (ids.length === 0) return [];
  const { data: matches } = await supabase
    .from("mc_matches")
    .select(
      "id, scheduled_date, finalized_at, match_type, match_format, ground_name, team_a_id, team_b_id, winner_team, match_locked, tournament_id, overs",
    )
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .eq("match_locked", true)
    .order("finalized_at", { ascending: true, nullsFirst: true })
    .order("scheduled_date", { ascending: true, nullsFirst: true });
  return (matches ?? []) as MatchLite[];
}

async function getAthleteTeamId(athleteId: string): Promise<string | null> {
  const { data } = await supabase
    .from("mc_match_squads")
    .select("team_id")
    .eq("athlete_profile_id", athleteId)
    .limit(1);
  return (data?.[0]?.team_id as string | null) ?? null;
}

/* ---------------- Build performance for one player ---------------- */

export async function buildPlayerPerformance(
  athleteId: string,
  tenantId: string,
): Promise<PlayerPerformance> {
  const matches = await listPlayerMatches(athleteId, tenantId);

  const perMatch: Array<{
    match: MatchLite;
    contribution: MatchContribution;
    dismissed: boolean;
    runsConceded: number;
    inningsOrder: number | null; // 1 = batting first, 2 = chasing (for this athlete's team)
    wasWon: boolean | null;
    venue: "home" | "away" | "neutral";
  }> = [];

  // Get the athlete's most-frequent team to compute inningsOrder + venue heuristic
  const primaryTeamId = await getAthleteTeamId(athleteId);

  const points: PerfPoint[] = [];
  let cumRuns = 0;
  let cumDismissals = 0;

  for (const m of matches) {
    let contribution: MatchContribution | undefined;
    try {
      const { contributions } = await extractMatchContributions(m.id);
      contribution = contributions.get(athleteId);
    } catch {
      contribution = undefined;
    }
    if (!contribution || !contribution.participated) continue;

    const dismissed = !!contribution.batting && !contribution.batting.notOut;
    if (contribution.batting) {
      cumRuns += contribution.batting.runs;
      if (dismissed) cumDismissals += 1;
    }
    const runsConceded = contribution.bowling?.runsConceded ?? 0;
    const balls = contribution.batting?.balls ?? 0;

    // Innings order for this athlete's team (batting first vs chasing)
    let inningsOrder: number | null = null;
    if (primaryTeamId) {
      const { data: inn } = await supabase
        .from("mc_innings")
        .select("innings_number, batting_team_id")
        .eq("match_id", m.id)
        .order("innings_number");
      const first = inn?.find((i) => i.batting_team_id === primaryTeamId);
      if (first) inningsOrder = first.innings_number;
    }

    const wasWon =
      m.winner_team && primaryTeamId
        ? m.winner_team === primaryTeamId
        : null;

    // Venue heuristic: home if athlete's team is team_a (host), away if team_b, else neutral
    const venue: "home" | "away" | "neutral" =
      primaryTeamId && m.team_a_id === primaryTeamId
        ? "home"
        : primaryTeamId && m.team_b_id === primaryTeamId
          ? "away"
          : "neutral";

    perMatch.push({
      match: m,
      contribution,
      dismissed,
      runsConceded,
      inningsOrder,
      wasWon,
      venue,
    });

    points.push({
      matchId: m.id,
      date: m.finalized_at ?? m.scheduled_date,
      runs: contribution.batting?.runs ?? 0,
      balls,
      wickets: contribution.bowling?.wickets ?? 0,
      ballsBowled: contribution.bowling?.legalBalls ?? 0,
      runsConceded,
      strikeRate: contribution.batting?.strikeRate ?? 0,
      economy: contribution.bowling?.economy ?? 0,
      battingAvgToDate:
        cumDismissals > 0 ? +(cumRuns / cumDismissals).toFixed(2) : +cumRuns.toFixed(2),
      won: wasWon,
    });
  }

  // Totals
  const totals = EMPTY_BUCKET("Total");
  let totalDismissals = 0;
  let totalRunsConceded = 0;
  for (const r of perMatch) {
    accumulate(totals, r.contribution, r.dismissed);
    if (r.dismissed) totalDismissals += 1;
    totalRunsConceded += r.runsConceded;
  }
  finalizeBucket(totals, totalDismissals, totalRunsConceded);

  // Bucketed helper
  const bucketBy = <K extends string>(
    keyFn: (row: (typeof perMatch)[number]) => K | null,
    labelMap?: Record<string, string>,
  ): SplitBucket[] => {
    const map = new Map<
      string,
      { bucket: SplitBucket; dismissals: number; runsConceded: number }
    >();
    for (const r of perMatch) {
      const key = keyFn(r);
      if (!key) continue;
      const label = labelMap?.[key] ?? key;
      let entry = map.get(label);
      if (!entry) {
        entry = { bucket: EMPTY_BUCKET(label), dismissals: 0, runsConceded: 0 };
        map.set(label, entry);
      }
      accumulate(entry.bucket, r.contribution, r.dismissed);
      if (r.dismissed) entry.dismissals += 1;
      entry.runsConceded += r.runsConceded;
    }
    for (const e of map.values()) finalizeBucket(e.bucket, e.dismissals, e.runsConceded);
    return [...map.values()].map((e) => e.bucket);
  };

  const byMatchType = bucketBy((r) => r.match.match_type ?? "unknown");
  const byInningsOrder = bucketBy((r) =>
    r.inningsOrder === 1 ? "Batting First" : r.inningsOrder === 2 ? "Chasing" : null,
  );
  const byResult = bucketBy((r) =>
    r.wasWon === true ? "Wins" : r.wasWon === false ? "Losses" : null,
  );
  const byVenue = bucketBy((r) =>
    r.venue === "home" ? "Home" : r.venue === "away" ? "Away" : "Neutral",
  );

  // Dismissals
  const dismissalCounts = new Map<string, number>();
  for (const r of perMatch) {
    const dt = r.contribution.batting?.dismissalType;
    if (!dt) continue;
    dismissalCounts.set(dt, (dismissalCounts.get(dt) ?? 0) + 1);
  }
  const totalDismCount = [...dismissalCounts.values()].reduce((s, v) => s + v, 0);
  const dismissals: DismissalBreakdown[] = [...dismissalCounts.entries()]
    .map(([type, count]) => ({
      type,
      count,
      pct: totalDismCount > 0 ? +((count / totalDismCount) * 100).toFixed(0) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Consistency (blend of runs & wickets, weighted toward primary discipline)
  const runsSeries = perMatch
    .filter((r) => r.contribution.batting)
    .map((r) => r.contribution.batting!.runs);
  const wktSeries = perMatch
    .filter((r) => r.contribution.bowling)
    .map((r) => r.contribution.bowling!.wickets);

  const runsConsistency = consistencyFromValues(runsSeries);
  const wktConsistency = consistencyFromValues(wktSeries);
  const primaryScore =
    runsSeries.length >= wktSeries.length ? runsConsistency : wktConsistency;
  const secondaryScore =
    runsSeries.length >= wktSeries.length ? wktConsistency : runsConsistency;
  const consistencyScore = Math.round(
    primaryScore * 0.75 + secondaryScore * 0.25,
  );

  // Form (last N)
  function buildLastN(n: number): SplitBucket {
    const slice = perMatch.slice(-n);
    const b = EMPTY_BUCKET(`Last ${n}`);
    let d = 0;
    let rc = 0;
    for (const r of slice) {
      accumulate(b, r.contribution, r.dismissed);
      if (r.dismissed) d += 1;
      rc += r.runsConceded;
    }
    finalizeBucket(b, d, rc);
    return b;
  }

  const last5 = buildLastN(5);
  const last10 = buildLastN(10);
  const last20 = buildLastN(20);

  const recentAvg = last5.average;
  const priorRuns = runsSeries.slice(0, Math.max(0, runsSeries.length - 5));
  const priorAvg =
    priorRuns.length > 0
      ? priorRuns.reduce((s, v) => s + v, 0) / priorRuns.length
      : recentAvg;
  const trendDelta = +(recentAvg - priorAvg).toFixed(2);
  const trend: "up" | "down" | "flat" =
    trendDelta > 1 ? "up" : trendDelta < -1 ? "down" : "flat";

  return {
    athleteId,
    points,
    totals,
    byMatchType,
    byInningsOrder,
    byResult,
    byVenue,
    dismissals,
    consistency: {
      score: consistencyScore,
      band: bandFor(consistencyScore),
      runsStdDev: +stdDev(runsSeries).toFixed(2),
      wicketsStdDev: +stdDev(wktSeries).toFixed(2),
    },
    form: { last5, last10, last20, trend, trendDelta },
  };
}

/* ---------------- Deterministic coach insights ---------------- */

export interface CoachInsight {
  kind: "strength" | "weakness" | "development" | "suggestion" | "selection";
  title: string;
  detail: string;
}

export function generateCoachInsights(p: PlayerPerformance): CoachInsight[] {
  const out: CoachInsight[] = [];
  const t = p.totals;

  // Strengths
  if (t.strikeRate >= 120)
    out.push({
      kind: "strength",
      title: "Aggressive scorer",
      detail: `Career strike rate of ${t.strikeRate.toFixed(1)} across ${t.innings} innings.`,
    });
  if (t.average >= 30 && t.innings >= 5)
    out.push({
      kind: "strength",
      title: "Reliable with the bat",
      detail: `Averaging ${t.average.toFixed(1)} over ${t.innings} innings.`,
    });
  if (t.economy > 0 && t.economy < 6 && t.ballsBowled >= 60)
    out.push({
      kind: "strength",
      title: "Economical bowler",
      detail: `Economy of ${t.economy.toFixed(2)} across ${(t.ballsBowled / 6).toFixed(1)} overs.`,
    });
  if (p.consistency.score >= 75)
    out.push({
      kind: "strength",
      title: `${p.consistency.band} consistency`,
      detail: `Consistency score ${p.consistency.score}/100.`,
    });

  // Weaknesses
  if (t.innings >= 5 && t.average < 15 && t.average > 0)
    out.push({
      kind: "weakness",
      title: "Batting average low",
      detail: `Averaging ${t.average.toFixed(1)}. Focus on converting starts.`,
    });
  if (t.economy > 8 && t.ballsBowled >= 60)
    out.push({
      kind: "weakness",
      title: "Bowling economy high",
      detail: `Conceding ${t.economy.toFixed(2)} runs per over.`,
    });
  const bowled = p.dismissals.find((d) => d.type === "bowled");
  if (bowled && bowled.pct >= 40)
    out.push({
      kind: "weakness",
      title: "Vulnerable to bowled",
      detail: `${bowled.pct}% of dismissals are bowled — work on defence & bat swing path.`,
    });
  const lbw = p.dismissals.find((d) => d.type === "lbw");
  if (lbw && lbw.pct >= 25)
    out.push({
      kind: "weakness",
      title: "LBW-prone",
      detail: `${lbw.pct}% of dismissals are LBW — review front-pad play.`,
    });

  // Development
  if (p.form.trend === "up")
    out.push({
      kind: "development",
      title: "Trending up",
      detail: `Last-5 average is +${p.form.trendDelta.toFixed(1)} vs prior form.`,
    });
  if (p.form.trend === "down")
    out.push({
      kind: "development",
      title: "Recent dip in form",
      detail: `Last-5 average is ${p.form.trendDelta.toFixed(1)} vs prior form — check confidence & workload.`,
    });

  // Suggestions
  if (t.strikeRate > 0 && t.strikeRate < 70 && t.balls >= 60)
    out.push({
      kind: "suggestion",
      title: "Work on scoring rate",
      detail: "Add rotation-of-strike drills and boundary options v/s spin.",
    });
  if (t.ballsBowled >= 60 && t.wickets === 0)
    out.push({
      kind: "suggestion",
      title: "Attacking lengths",
      detail: "Bowler is economical but wicketless — practice wicket-taking lengths.",
    });

  // Selection
  const goodForm = p.form.last5.average >= 25 || p.form.last5.wickets >= 3;
  const consistent = p.consistency.score >= 65;
  if (goodForm && consistent)
    out.push({
      kind: "selection",
      title: "Recommend for selection",
      detail: "In form and consistent — reliable pick for the next XI.",
    });
  else if (p.form.trend === "down" && p.consistency.score < 45)
    out.push({
      kind: "selection",
      title: "Consider a rest / net-session focus",
      detail: "Form dropping and consistency low — extra practice recommended.",
    });

  return out;
}

/* ---------------- Academy roll-up ---------------- */

export interface AcademyOverviewRow {
  athleteId: string;
  runs: number;
  wickets: number;
  matches: number;
  average: number;
  economy: number;
  consistency: number;
  trend: "up" | "down" | "flat";
  formAvg: number;
}

export async function listAcademyPerformance(
  tenantId: string,
  athleteIds: string[],
): Promise<AcademyOverviewRow[]> {
  // Uses cached career table when possible for scale; only 1 row per athlete.
  const results: AcademyOverviewRow[] = [];
  for (const id of athleteIds) {
    try {
      const career = await getCareer(id);
      results.push({
        athleteId: id,
        runs: career?.total_runs ?? 0,
        wickets: career?.total_wickets ?? 0,
        matches: career?.matches_played ?? 0,
        average: career?.batting_average ?? 0,
        economy: career?.bowling_economy ?? 0,
        consistency: 0,
        trend: "flat",
        formAvg: 0,
      });
    } catch {
      /* skip */
    }
  }
  void tenantId;
  return results;
}
