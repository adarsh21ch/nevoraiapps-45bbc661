/* ================================================================
 * Tournament Qualification Math
 * ----------------------------------------------------------------
 * Pure, side-effect-free classification of teams into:
 *   - qualified       : cannot fall out of the qualification slots
 *   - eliminated      : cannot reach the qualification slots
 *   - in_contention   : still fighting
 *
 * Uses only data already available in the workspace (standings +
 * fixtures + group qualify_count). No new database queries.
 * ================================================================ */

export type QualificationState = "qualified" | "eliminated" | "in_contention";

export interface StandingRow {
  team_id: string;
  group_id: string | null;
  points: number;
  played: number;
}

export interface FixtureRow {
  team_a_id: string;
  team_b_id: string;
  match_locked: boolean;
  status: string;
  group_id?: string | null;
}

export interface GroupSpec {
  id: string | null; // null = whole-tournament (league) bucket
  name: string;
  qualify_count: number;
}

export interface QualificationResult {
  byTeam: Record<string, QualificationState>;
  byGroup: Record<
    string,
    {
      qualified: string[];
      eliminated: string[];
      contention: string[];
      leader: string | null;
      runnerUp: string | null;
      matchesRemaining: number;
      matchesTotal: number;
    }
  >;
}

/**
 * Compute qualification for every team.
 *
 * Best-case points for a team = current points + (remaining games × pointsForWin).
 * Worst-case points for the reference team = current points (no more wins).
 *
 *   qualified  ⇔ current points >  best-case of the team currently at slot (qc + 1)
 *   eliminated ⇔ best-case points ≤ current points of team at slot qc
 *   otherwise  ⇒ in_contention
 */
export function computeQualification(input: {
  standings: StandingRow[];
  fixtures: FixtureRow[];
  groups: GroupSpec[];
  pointsForWin: number;
}): QualificationResult {
  const { standings, fixtures, groups, pointsForWin } = input;

  const remainingByTeam = new Map<string, number>();
  const totalByGroup = new Map<string | null, number>();
  const remainingByGroup = new Map<string | null, number>();

  for (const f of fixtures) {
    const done = f.match_locked || f.status === "completed";
    const key = f.group_id ?? null;
    totalByGroup.set(key, (totalByGroup.get(key) ?? 0) + 1);
    if (!done) {
      remainingByGroup.set(key, (remainingByGroup.get(key) ?? 0) + 1);
      remainingByTeam.set(f.team_a_id, (remainingByTeam.get(f.team_a_id) ?? 0) + 1);
      remainingByTeam.set(f.team_b_id, (remainingByTeam.get(f.team_b_id) ?? 0) + 1);
    }
  }

  const byGroup: QualificationResult["byGroup"] = {};
  const byTeam: Record<string, QualificationState> = {};

  for (const group of groups) {
    const roster = standings
      .filter((s) => (s.group_id ?? null) === (group.id ?? null))
      .slice()
      .sort((a, b) => b.points - a.points);
    const qc = Math.max(1, group.qualify_count);

    // Reference values
    const boundaryTeam = roster[qc - 1]; // last team currently in
    const nextOutTeam = roster[qc]; // first team currently out
    const boundaryPoints = boundaryTeam ? boundaryTeam.points : 0;
    const nextOutBest = nextOutTeam
      ? nextOutTeam.points + (remainingByTeam.get(nextOutTeam.team_id) ?? 0) * pointsForWin
      : -Infinity;

    const qualified: string[] = [];
    const eliminated: string[] = [];
    const contention: string[] = [];

    for (const row of roster) {
      const remaining = remainingByTeam.get(row.team_id) ?? 0;
      const best = row.points + remaining * pointsForWin;

      let state: QualificationState;
      if (roster.length <= qc) {
        // Everyone in the group qualifies by default.
        state = "qualified";
      } else if (row.points > nextOutBest) {
        state = "qualified";
      } else if (best < boundaryPoints) {
        state = "eliminated";
      } else {
        state = "in_contention";
      }
      byTeam[row.team_id] = state;
      if (state === "qualified") qualified.push(row.team_id);
      else if (state === "eliminated") eliminated.push(row.team_id);
      else contention.push(row.team_id);
    }

    byGroup[group.id ?? "__league__"] = {
      qualified,
      eliminated,
      contention,
      leader: roster[0]?.team_id ?? null,
      runnerUp: roster[1]?.team_id ?? null,
      matchesRemaining: remainingByGroup.get(group.id ?? null) ?? 0,
      matchesTotal: totalByGroup.get(group.id ?? null) ?? 0,
    };
  }

  return { byTeam, byGroup };
}
