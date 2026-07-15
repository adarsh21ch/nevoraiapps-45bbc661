/* ================================================================
 * Bracket Builder (pure view layer)
 * ----------------------------------------------------------------
 * Reads mc_tournament_rounds + linked mc_matches + innings summaries
 * and produces a UI-ready column-per-stage tree. All progression
 * arithmetic (winner → next slot) already lives in
 * `advanceKnockoutWinner` inside the Fixture Engine and runs
 * automatically on match finalization — this module never mutates.
 *
 * Extension points (documented, not implemented):
 *   - double-elimination: emit a second "losers" tree column set.
 *   - custom trees: allow `stage` to be an arbitrary string, columns
 *     already key on `stage_order`.
 *   - regional / national tiers: add `tier` column and split into
 *     multiple BracketTree instances stitched by a parent stage.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";

export type BracketStage =
  | "round_of_64"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "final"
  | "third_place"
  | string;

export interface BracketTeamLite {
  id: string;
  name: string;
  short: string | null;
  logo: string | null;
  color: string | null;
}

export interface BracketScore {
  teamId: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
}

export interface BracketMatchStatus {
  status: string;
  locked: boolean;
  live: boolean;
  completed: boolean;
  upcoming: boolean;
}

export interface BracketNode {
  id: string; // round id
  stage: BracketStage;
  stageOrder: number;
  slotIndex: number;
  name: string | null;
  matchId: string | null;
  teamA: BracketTeamLite | null;
  teamB: BracketTeamLite | null;
  winnerTeamId: string | null;
  victoryType: string | null;
  result: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: BracketMatchStatus;
  scoreA: BracketScore | null;
  scoreB: BracketScore | null;
  feederAId: string | null;
  feederBId: string | null;
  advancesToId: string | null;
  isThirdPlace: boolean;
  isFinal: boolean;
  isChampionPath: boolean;
}

export interface BracketColumn {
  stage: BracketStage;
  stageOrder: number;
  label: string;
  nodes: BracketNode[];
  isCurrent: boolean;
  isCompleted: boolean;
}

export interface BracketTree {
  columns: BracketColumn[]; // main knockout ladder
  thirdPlace: BracketNode | null; // separated so it doesn't stretch the ladder
  champion: BracketTeamLite | null;
  runnerUp: BracketTeamLite | null;
  totalNodes: number;
  completedNodes: number;
}

/* --------------------------- Stage labels --------------------------- */

const STAGE_LABEL: Record<string, string> = {
  round_of_64: "Round of 64",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_final: "Quarter Finals",
  semi_final: "Semi Finals",
  final: "Final",
  third_place: "Third Place",
};

export function labelForStage(stage: string): string {
  return STAGE_LABEL[stage] ?? stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* --------------------------- Fetch + assemble --------------------------- */

interface RawRound {
  id: string;
  stage: string;
  stage_order: number;
  slot_index: number;
  name: string | null;
  match_id: string | null;
  feeder_a_round_id: string | null;
  feeder_b_round_id: string | null;
  advances_to_round_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
}

interface RawMatch {
  id: string;
  status: string;
  match_locked: boolean;
  winner_team: string | null;
  victory_type: string | null;
  result: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
}

interface RawInnings {
  match_id: string;
  batting_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
}

interface RawTeam {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  team_color: string | null;
}

export async function fetchBracketTree(tournamentId: string): Promise<BracketTree> {
  const { data: rounds, error: rErr } = await supabase
    .from("mc_tournament_rounds")
    .select(
      "id, stage, stage_order, slot_index, name, match_id, feeder_a_round_id, feeder_b_round_id, advances_to_round_id, team_a_id, team_b_id",
    )
    .eq("tournament_id", tournamentId)
    .order("stage_order", { ascending: true })
    .order("slot_index", { ascending: true });
  if (rErr) throw rErr;
  const roundList = (rounds ?? []) as RawRound[];

  const matchIds = Array.from(
    new Set(roundList.map((r) => r.match_id).filter((v): v is string => !!v)),
  );
  const teamIds = Array.from(
    new Set(roundList.flatMap((r) => [r.team_a_id, r.team_b_id]).filter((v): v is string => !!v)),
  );

  const [matchesRes, inningsRes, teamsRes] = await Promise.all([
    matchIds.length > 0
      ? supabase
          .from("mc_matches")
          .select(
            "id, status, match_locked, winner_team, victory_type, result, scheduled_date, scheduled_time",
          )
          .in("id", matchIds)
      : Promise.resolve({ data: [] as RawMatch[], error: null }),
    matchIds.length > 0
      ? supabase
          .from("mc_innings")
          .select("match_id, batting_team_id, runs, wickets, overs, balls")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [] as RawInnings[], error: null }),
    teamIds.length > 0
      ? supabase
          .from("mc_teams")
          .select("id, name, short_name, logo_url, team_color")
          .in("id", teamIds)
      : Promise.resolve({ data: [] as RawTeam[], error: null }),
  ]);
  if (matchesRes.error) throw matchesRes.error;
  if (inningsRes.error) throw inningsRes.error;
  if (teamsRes.error) throw teamsRes.error;

  const matchMap = new Map<string, RawMatch>();
  for (const m of (matchesRes.data ?? []) as RawMatch[]) matchMap.set(m.id, m);
  const inningsByMatch = new Map<string, RawInnings[]>();
  for (const i of (inningsRes.data ?? []) as RawInnings[]) {
    const arr = inningsByMatch.get(i.match_id) ?? [];
    arr.push(i);
    inningsByMatch.set(i.match_id, arr);
  }
  const teamMap = new Map<string, BracketTeamLite>();
  for (const t of (teamsRes.data ?? []) as RawTeam[]) {
    teamMap.set(t.id, {
      id: t.id,
      name: t.name,
      short: t.short_name,
      logo: t.logo_url,
      color: t.team_color,
    });
  }

  // Build nodes.
  const nodes: BracketNode[] = roundList.map((r) => {
    const match = r.match_id ? (matchMap.get(r.match_id) ?? null) : null;
    const inn = r.match_id ? (inningsByMatch.get(r.match_id) ?? []) : [];
    const scoreFor = (teamId: string | null): BracketScore | null => {
      if (!teamId) return null;
      const row = inn.find((x) => x.batting_team_id === teamId);
      if (!row) return null;
      return {
        teamId,
        runs: row.runs,
        wickets: row.wickets,
        overs: row.overs,
        balls: row.balls,
      };
    };
    const status: BracketMatchStatus = {
      status: match?.status ?? "scheduled",
      locked: !!match?.match_locked,
      live: match?.status === "in_progress",
      completed: !!match?.match_locked,
      upcoming: !match || (match.status !== "in_progress" && !match.match_locked),
    };
    return {
      id: r.id,
      stage: r.stage,
      stageOrder: r.stage_order,
      slotIndex: r.slot_index,
      name: r.name,
      matchId: r.match_id,
      teamA: r.team_a_id ? (teamMap.get(r.team_a_id) ?? null) : null,
      teamB: r.team_b_id ? (teamMap.get(r.team_b_id) ?? null) : null,
      winnerTeamId: match?.winner_team ?? null,
      victoryType: match?.victory_type ?? null,
      result: match?.result ?? null,
      scheduledDate: match?.scheduled_date ?? null,
      scheduledTime: match?.scheduled_time ?? null,
      status,
      scoreA: scoreFor(r.team_a_id),
      scoreB: scoreFor(r.team_b_id),
      feederAId: r.feeder_a_round_id,
      feederBId: r.feeder_b_round_id,
      advancesToId: r.advances_to_round_id,
      isThirdPlace: r.stage === "third_place",
      isFinal: r.stage === "final",
      isChampionPath: false,
    };
  });

  // Group into columns (excluding third place).
  const mainNodes = nodes.filter((n) => !n.isThirdPlace);
  const byStage = new Map<string, BracketNode[]>();
  for (const n of mainNodes) {
    if (!byStage.has(n.stage)) byStage.set(n.stage, []);
    byStage.get(n.stage)!.push(n);
  }

  const columns: BracketColumn[] = Array.from(byStage.entries())
    .map(([stage, list]) => {
      list.sort((a, b) => a.slotIndex - b.slotIndex);
      const stageOrder = list[0]?.stageOrder ?? 0;
      const isCompleted = list.every((n) => n.status.completed);
      const isCurrent = !isCompleted && list.some((n) => n.status.live || n.status.completed);
      return {
        stage,
        stageOrder,
        label: labelForStage(stage),
        nodes: list,
        isCurrent,
        isCompleted,
      };
    })
    .sort((a, b) => a.stageOrder - b.stageOrder);

  // Ensure exactly one column is flagged "current".
  const anyCurrent = columns.some((c) => c.isCurrent);
  if (!anyCurrent) {
    const nextIncomplete = columns.find((c) => !c.isCompleted);
    if (nextIncomplete) nextIncomplete.isCurrent = true;
  }

  const thirdPlace = nodes.find((n) => n.isThirdPlace) ?? null;
  const finalNode = mainNodes.find((n) => n.isFinal) ?? null;
  const champion =
    finalNode && finalNode.status.completed && finalNode.winnerTeamId
      ? (teamMap.get(finalNode.winnerTeamId) ?? null)
      : null;
  const runnerUp =
    finalNode && finalNode.status.completed && finalNode.winnerTeamId
      ? finalNode.winnerTeamId === finalNode.teamA?.id
        ? finalNode.teamB
        : finalNode.teamA
      : null;

  // Champion path: walk feeders backwards from the final's winner.
  if (champion) {
    const byId = new Map<string, BracketNode>();
    for (const n of nodes) byId.set(n.id, n);
    const stack: BracketNode[] = finalNode ? [finalNode] : [];
    while (stack.length) {
      const n = stack.pop()!;
      n.isChampionPath = true;
      // pick the feeder whose winner is the champion's ancestor.
      const feeders = [n.feederAId, n.feederBId]
        .map((id) => (id ? (byId.get(id) ?? null) : null))
        .filter((x): x is BracketNode => x !== null);
      for (const f of feeders) {
        if (
          f.winnerTeamId &&
          (f.winnerTeamId === champion.id || descendantWon(f, champion.id, byId))
        ) {
          stack.push(f);
        }
      }
    }
  }

  const totalNodes = nodes.length;
  const completedNodes = nodes.filter((n) => n.status.completed).length;

  return { columns, thirdPlace, champion, runnerUp, totalNodes, completedNodes };
}

function descendantWon(node: BracketNode, teamId: string, byId: Map<string, BracketNode>): boolean {
  if (node.winnerTeamId === teamId) return true;
  const feeders = [node.feederAId, node.feederBId]
    .map((id) => (id ? (byId.get(id) ?? null) : null))
    .filter((x): x is BracketNode => x !== null);
  return feeders.some((f) => descendantWon(f, teamId, byId));
}

/* --------------------------- Helpers --------------------------- */

export function formatScore(s: BracketScore | null): string {
  if (!s) return "";
  return `${s.runs}/${s.wickets} (${s.overs}.${s.balls})`;
}
