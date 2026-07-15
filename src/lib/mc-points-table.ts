/* ================================================================
 * Points Table (view layer)
 * ----------------------------------------------------------------
 * PURE, side-effect-free enrichment of the stored standings snapshot
 * held in `mc_tournament_teams`. All heavy aggregation (points, NRR,
 * runs, overs, wickets) already lives in the Tournament Engine and
 * is written back by `rebuildTournamentStandings`. This module ONLY:
 *
 *   - sorts rows with configurable tiebreakers,
 *   - derives per-team form (last 5 finalized matches),
 *   - derives position movement vs the previous matchday,
 *   - stamps qualification/elimination lines per group,
 *   - exposes a per-group grouping helper for the UI.
 *
 * No new queries. No duplicated math. Extension points are documented
 * inline for future ML/qualification-probability modules.
 * ================================================================ */

import type { MCTournament } from "@/lib/mc-tournaments";
import {
  computeQualification,
  type QualificationState,
} from "@/lib/mc-tournament-qualification";

export type FormResult = "W" | "L" | "T" | "N";
export type PositionDelta = "up" | "down" | "same" | "new";

export interface StandingRowInput {
  id: string;
  team_id: string;
  group_id: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number | string;
  net_run_rate: number | string;
  runs_scored: number;
  runs_conceded: number;
  overs_faced: number | string;
  overs_bowled: number | string;
  wickets_lost: number;
  wickets_taken: number;
  position: number | null;
}

export interface FixtureRowInput {
  id: string;
  team_a_id: string;
  team_b_id: string;
  winner_team: string | null;
  victory_type: string | null;
  match_locked: boolean;
  status: string;
  matchday_no: number | null;
  group_id: string | null;
}

export interface GroupInput {
  id: string | null;
  name: string;
  qualify_count: number;
  display_order?: number | null;
}

export interface PointsTableRow {
  team_id: string;
  group_id: string | null;
  position: number;
  previousPosition: number | null;
  positionDelta: PositionDelta;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  net_run_rate: number;
  runs_scored: number;
  runs_conceded: number;
  overs_faced: number;
  overs_bowled: number;
  runDiff: number;
  winPct: number;
  form: FormResult[];
  qualification: QualificationState;
  isQualificationBoundary: boolean;
  isEliminationBoundary: boolean;
}

export interface PointsTableGroup {
  id: string | null;
  name: string;
  qualifyCount: number;
  matchesTotal: number;
  matchesRemaining: number;
  rows: PointsTableRow[];
}

export interface PointsTableResult {
  groups: PointsTableGroup[];
  byTeam: Record<string, PointsTableRow>;
}

/* --------------------------- Tiebreakers --------------------------- */

export type TiebreakerKey =
  | "points"
  | "net_run_rate"
  | "wins"
  | "head_to_head"
  | "run_difference";

export const DEFAULT_TIEBREAKERS: TiebreakerKey[] = [
  "points",
  "net_run_rate",
  "head_to_head",
  "wins",
  "run_difference",
];

function normalizeTiebreakers(raw: unknown): TiebreakerKey[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TIEBREAKERS;
  const allowed = new Set<TiebreakerKey>([
    "points",
    "net_run_rate",
    "wins",
    "head_to_head",
    "run_difference",
  ]);
  const out = raw
    .map((v) => String(v) as TiebreakerKey)
    .filter((v): v is TiebreakerKey => allowed.has(v));
  return out.length > 0 ? out : DEFAULT_TIEBREAKERS;
}

/** Head-to-head points between two teams from finalized fixtures. */
function h2hScore(
  a: string,
  b: string,
  fixtures: FixtureRowInput[],
  pointsForWin: number,
  pointsForTie: number,
): { a: number; b: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const f of fixtures) {
    if (!f.match_locked) continue;
    const pair =
      (f.team_a_id === a && f.team_b_id === b) ||
      (f.team_a_id === b && f.team_b_id === a);
    if (!pair) continue;
    if (f.victory_type === "won" && f.winner_team) {
      if (f.winner_team === a) scoreA += pointsForWin;
      else if (f.winner_team === b) scoreB += pointsForWin;
    } else if (f.victory_type === "tie") {
      scoreA += pointsForTie;
      scoreB += pointsForTie;
    }
  }
  return { a: scoreA, b: scoreB };
}

function compareRows(
  x: PointsTableRow,
  y: PointsTableRow,
  order: TiebreakerKey[],
  fixtures: FixtureRowInput[],
  pointsForWin: number,
  pointsForTie: number,
): number {
  for (const key of order) {
    let delta = 0;
    switch (key) {
      case "points":
        delta = y.points - x.points;
        break;
      case "net_run_rate":
        delta = y.net_run_rate - x.net_run_rate;
        break;
      case "wins":
        delta = y.won - x.won;
        break;
      case "run_difference":
        delta = y.runDiff - x.runDiff;
        break;
      case "head_to_head": {
        const h = h2hScore(x.team_id, y.team_id, fixtures, pointsForWin, pointsForTie);
        delta = h.b - h.a;
        break;
      }
    }
    if (delta !== 0) return delta;
  }
  return 0;
}

/* --------------------------- Form + previous position --------------------------- */

/** Return the last N finalized results for a team, most recent first. */
function formForTeam(team: string, fixtures: FixtureRowInput[], n = 5): FormResult[] {
  const finalized = fixtures.filter(
    (f) => f.match_locked && (f.team_a_id === team || f.team_b_id === team),
  );
  finalized.sort((a, b) => (b.matchday_no ?? 0) - (a.matchday_no ?? 0));
  const out: FormResult[] = [];
  for (const f of finalized) {
    if (out.length >= n) break;
    if (f.victory_type === "tie") out.push("T");
    else if (f.victory_type === "no_result" || f.victory_type === "abandoned") out.push("N");
    else if (f.victory_type === "won" && f.winner_team === team) out.push("W");
    else if (f.victory_type === "won") out.push("L");
  }
  return out;
}

interface MiniAgg {
  points: number;
  net_run_rate: number;
  won: number;
  runDiff: number;
}
/**
 * Rebuild a lightweight standings snapshot as of "before the most recent matchday",
 * used ONLY to compute position movement arrows. Point/NRR values are derived from
 * fixtures without touching innings data — this deliberately does not replace the
 * authoritative Tournament Engine standings; it is a display-only diff.
 */
function previousPositionMap(
  rows: PointsTableRow[],
  fixtures: FixtureRowInput[],
  pointsForWin: number,
  pointsForTie: number,
  pointsForNoResult: number,
  order: TiebreakerKey[],
): Map<string, number> {
  const latestMatchday = fixtures
    .filter((f) => f.match_locked)
    .reduce((m, f) => Math.max(m, f.matchday_no ?? 0), 0);
  if (latestMatchday <= 1) return new Map();

  const priorFixtures = fixtures.filter(
    (f) => f.match_locked && (f.matchday_no ?? 0) < latestMatchday,
  );
  const byGroup = new Map<string | null, MiniAgg[]>();
  const teamGroup = new Map<string, string | null>();
  for (const r of rows) teamGroup.set(r.team_id, r.group_id);

  const aggByTeam = new Map<string, MiniAgg>();
  const ensure = (id: string) => {
    let a = aggByTeam.get(id);
    if (!a) {
      a = { points: 0, net_run_rate: 0, won: 0, runDiff: 0 };
      aggByTeam.set(id, a);
    }
    return a;
  };
  for (const f of priorFixtures) {
    const a = ensure(f.team_a_id);
    const b = ensure(f.team_b_id);
    if (f.victory_type === "won" && f.winner_team) {
      if (f.winner_team === f.team_a_id) {
        a.points += pointsForWin;
        a.won += 1;
      } else {
        b.points += pointsForWin;
        b.won += 1;
      }
    } else if (f.victory_type === "tie") {
      a.points += pointsForTie;
      b.points += pointsForTie;
    } else if (f.victory_type === "no_result" || f.victory_type === "abandoned") {
      a.points += pointsForNoResult;
      b.points += pointsForNoResult;
    }
  }

  const perGroup = new Map<string | null, PointsTableRow[]>();
  for (const r of rows) {
    const gid = r.group_id;
    const a = aggByTeam.get(r.team_id) ?? { points: 0, net_run_rate: 0, won: 0, runDiff: 0 };
    const clone: PointsTableRow = {
      ...r,
      points: a.points,
      net_run_rate: a.net_run_rate,
      won: a.won,
      runDiff: a.runDiff,
    };
    if (!perGroup.has(gid)) perGroup.set(gid, []);
    perGroup.get(gid)!.push(clone);
    if (!byGroup.has(gid)) byGroup.set(gid, []);
  }

  const posMap = new Map<string, number>();
  for (const [, list] of perGroup) {
    list.sort((x, y) => compareRows(x, y, order, priorFixtures, pointsForWin, pointsForTie));
    list.forEach((row, idx) => posMap.set(row.team_id, idx + 1));
  }
  return posMap;
}

/* --------------------------- Public entrypoint --------------------------- */

export function computePointsTable(input: {
  tournament: Pick<
    MCTournament,
    "points_for_win" | "points_for_tie" | "points_for_no_result" | "tiebreak_rules"
  >;
  standings: StandingRowInput[];
  fixtures: FixtureRowInput[];
  groups: GroupInput[];
}): PointsTableResult {
  const { tournament, standings, fixtures, groups } = input;
  const pointsForWin = Number(tournament.points_for_win) || 2;
  const pointsForTie = Number(tournament.points_for_tie) || 1;
  const pointsForNoResult = Number(tournament.points_for_no_result) || 1;
  const order = normalizeTiebreakers(tournament.tiebreak_rules);

  // Fall back to a single "league" bucket when no groups exist.
  const effectiveGroups: GroupInput[] =
    groups.length > 0
      ? [...groups].sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
        )
      : [{ id: null, name: "Standings", qualify_count: standings.length }];

  const groupById = new Map<string | null, GroupInput>();
  for (const g of effectiveGroups) groupById.set(g.id, g);

  // Enrich raw standings.
  const enriched: PointsTableRow[] = standings.map((s) => {
    const played = s.played;
    const wins = s.won;
    const points = Number(s.points);
    const nrr = Number(s.net_run_rate);
    const oversFaced = Number(s.overs_faced);
    const oversBowled = Number(s.overs_bowled);
    const runDiff = s.runs_scored - s.runs_conceded;
    const winPct = played > 0 ? (wins / played) * 100 : 0;
    const form = formForTeam(s.team_id, fixtures);
    return {
      team_id: s.team_id,
      group_id: s.group_id,
      position: 0,
      previousPosition: null,
      positionDelta: "new",
      played,
      won: wins,
      lost: s.lost,
      tied: s.tied,
      no_result: s.no_result,
      points,
      net_run_rate: nrr,
      runs_scored: s.runs_scored,
      runs_conceded: s.runs_conceded,
      overs_faced: oversFaced,
      overs_bowled: oversBowled,
      runDiff,
      winPct,
      form,
      qualification: "in_contention",
      isQualificationBoundary: false,
      isEliminationBoundary: false,
    };
  });

  // Sort per group.
  const groupsOut: PointsTableGroup[] = [];
  const byTeam: Record<string, PointsTableRow> = {};
  const posByTeam = new Map<string, number>();
  for (const g of effectiveGroups) {
    const rows = enriched
      .filter((r) => (r.group_id ?? null) === (g.id ?? null))
      .sort((x, y) => compareRows(x, y, order, fixtures, pointsForWin, pointsForTie));
    rows.forEach((row, idx) => {
      row.position = idx + 1;
      posByTeam.set(row.team_id, idx + 1);
    });
    const matchesTotal = fixtures.filter(
      (f) => (f.group_id ?? null) === (g.id ?? null),
    ).length;
    const matchesRemaining = fixtures.filter(
      (f) =>
        (f.group_id ?? null) === (g.id ?? null) &&
        !f.match_locked &&
        f.status !== "cancelled",
    ).length;
    groupsOut.push({
      id: g.id,
      name: g.name,
      qualifyCount: Math.max(1, g.qualify_count),
      matchesTotal,
      matchesRemaining,
      rows,
    });
  }

  // Qualification (reuses pure module).
  const qual = computeQualification({
    standings: enriched.map((r) => ({
      team_id: r.team_id,
      group_id: r.group_id,
      points: r.points,
      played: r.played,
    })),
    fixtures: fixtures.map((f) => ({
      team_a_id: f.team_a_id,
      team_b_id: f.team_b_id,
      match_locked: f.match_locked,
      status: f.status,
      group_id: f.group_id,
    })),
    groups: effectiveGroups.map((g) => ({
      id: g.id,
      name: g.name,
      qualify_count: g.qualify_count,
    })),
    pointsForWin,
  });

  for (const group of groupsOut) {
    group.rows.forEach((row) => {
      row.qualification = qual.byTeam[row.team_id] ?? "in_contention";
      row.isQualificationBoundary = row.position === group.qualifyCount;
      row.isEliminationBoundary =
        group.rows.length > group.qualifyCount &&
        row.position === group.qualifyCount + 1;
      byTeam[row.team_id] = row;
    });
  }

  // Position movement.
  const prevMap = previousPositionMap(
    enriched,
    fixtures,
    pointsForWin,
    pointsForTie,
    pointsForNoResult,
    order,
  );
  for (const group of groupsOut) {
    for (const row of group.rows) {
      const prev = prevMap.get(row.team_id);
      row.previousPosition = prev ?? null;
      if (prev == null) row.positionDelta = "new";
      else if (prev > row.position) row.positionDelta = "up";
      else if (prev < row.position) row.positionDelta = "down";
      else row.positionDelta = "same";
    }
  }

  return { groups: groupsOut, byTeam };
}

/* ================================================================
 * Extension points (not implemented yet — documented for Step 13+):
 *   - qualificationProbability(row, group, remainingFixtures)
 *   - historicalComparison(seasonA, seasonB)
 *   - crossTournamentRanking(tenantId)
 *   - aiInsight(row, group) → natural-language commentary
 * All would consume PointsTableResult without changing this module.
 * ================================================================ */
