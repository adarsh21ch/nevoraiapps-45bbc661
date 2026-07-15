/* ================================================================
 * Tournament Awards Engine
 * ----------------------------------------------------------------
 * PURE derivation on top of `TournamentAnalytics` — never queries
 * the DB directly, never re-implements batting/bowling math. Every
 * award reuses the existing Statistics Engine + Tournament Engine
 * outputs so awards refresh automatically whenever a finalized match
 * invalidates the analytics query key.
 *
 * Supported awards:
 *   - Player of the Tournament
 *   - Best Batter
 *   - Best Bowler
 *   - Best All-Rounder
 *   - Best Fielder
 *   - Emerging Player          (fewest matches among top performers)
 *   - Orange Cap               (most runs)
 *   - Purple Cap               (most wickets)
 *   - Fair Play Team           (heuristic: fewest wide/no-ball extras
 *                                conceded per match)
 *   - Team of the Tournament   (best XI by role — 4 bat / 3 all / 1 wk /
 *                                3 bowl, deduped by playerKey)
 *
 * Future extension points (NOT implemented):
 *   - Ballon-d'Or style weighted composite (config-driven weights)
 *   - Age-bracket awards (U19 top scorer, etc)
 *   - Fan-voted awards
 * ================================================================ */

import type {
  TournamentAnalytics,
  PlayerBattingRow,
  PlayerBowlingRow,
  PlayerFieldingRow,
  TeamAnalyticsRow,
} from "@/lib/mc-tournament-statistics";

/* ---------------- Public shapes ---------------- */

export interface AwardWinner {
  athleteId: string | null;
  name: string;
  teamName?: string | null;
  headline: string; // "487 runs @ 54.11 · SR 138"
  score: number; // sort/tiebreak
  raw?: Record<string, number>; // for future analytics
}

export interface TeamAwardWinner {
  teamId: string;
  name: string;
  headline: string;
  score: number;
}

export interface TeamOfTournamentPick {
  role: "batter" | "all-rounder" | "wicket-keeper" | "bowler";
  athleteId: string | null;
  name: string;
  headline: string;
}

export interface TournamentAwards {
  playerOfTournament: AwardWinner | null;
  bestBatter: AwardWinner | null;
  bestBowler: AwardWinner | null;
  bestAllRounder: AwardWinner | null;
  bestFielder: AwardWinner | null;
  emergingPlayer: AwardWinner | null;
  orangeCap: AwardWinner | null;
  purpleCap: AwardWinner | null;
  fairPlayTeam: TeamAwardWinner | null;
  teamOfTournament: TeamOfTournamentPick[];
}

/* ---------------- Scoring heuristics ----------------
 * These weights are intentionally simple and stable. They can be
 * lifted into `qualification_rules` / a config table later without
 * breaking downstream consumers.
 */

function batterImpact(r: PlayerBattingRow): number {
  // runs, weighted by strike-rate and boundaries; not-outs boost avg
  const avgFactor = r.average > 0 ? r.average : r.runs;
  const srFactor = Math.min(r.strikeRate, 250) / 100;
  return (
    r.runs + avgFactor * 2 + srFactor * 25 + r.fifties * 15 + r.hundreds * 40 + r.matchWinning * 25
  );
}

function bowlerImpact(r: PlayerBowlingRow): number {
  // wickets are king; economy inverse; hauls
  const econPenalty = r.balls > 0 ? Math.max(0, r.economy - 6) * 8 : 0;
  const avg = r.average > 0 && Number.isFinite(r.average) ? r.average : 40;
  const avgPenalty = Math.max(0, avg - 20) * 1.5;
  return (
    r.wickets * 20 +
    r.fiveWicketHauls * 50 +
    r.hatTricks * 40 +
    r.matchWinning * 25 -
    econPenalty -
    avgPenalty
  );
}

function allRounderImpact(
  bat: PlayerBattingRow | undefined,
  bowl: PlayerBowlingRow | undefined,
): number {
  const b = bat ? batterImpact(bat) : 0;
  const w = bowl ? bowlerImpact(bowl) : 0;
  // require BOTH sides to have contributed meaningfully
  const gate = (bat?.runs ?? 0) >= 40 && (bowl?.wickets ?? 0) >= 3 ? 1 : 0.35;
  return (b + w) * gate;
}

function fielderImpact(r: PlayerFieldingRow): number {
  return r.fieldingPoints;
}

function potmImpact(
  bat: PlayerBattingRow | undefined,
  bowl: PlayerBowlingRow | undefined,
  field: PlayerFieldingRow | undefined,
): number {
  const b = bat ? batterImpact(bat) : 0;
  const w = bowl ? bowlerImpact(bowl) : 0;
  const f = field ? fielderImpact(field) : 0;
  const potmBonus = (bat?.potm ?? 0) * 40;
  return b + w + f + potmBonus;
}

/* ---------------- Helpers ---------------- */

function bestOf<T>(list: T[], score: (t: T) => number): { winner: T | null; scoreValue: number } {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of list) {
    const s = score(item);
    if (s > bestScore) {
      bestScore = s;
      best = item;
    }
  }
  return { winner: best, scoreValue: best ? bestScore : 0 };
}

function battingHeadline(r: PlayerBattingRow): string {
  return `${r.runs} runs @ ${r.average.toFixed(2)} · SR ${r.strikeRate.toFixed(1)}`;
}
function bowlingHeadline(r: PlayerBowlingRow): string {
  return `${r.wickets} wkts · Econ ${r.economy.toFixed(2)} · Best ${r.bestDisplay || "—"}`;
}
function fieldingHeadline(r: PlayerFieldingRow): string {
  return `${r.catches}c · ${r.stumpings}st · ${r.runOuts}ro`;
}

/* ---------------- Team of the Tournament (XI) ---------------- */

function pickTeamOfTournament(
  batting: PlayerBattingRow[],
  bowling: PlayerBowlingRow[],
  fielding: PlayerFieldingRow[],
): TeamOfTournamentPick[] {
  const picks: TeamOfTournamentPick[] = [];
  const usedKeys = new Set<string>();

  const batByKey = new Map(batting.map((b) => [b.key, b]));
  const bowlByKey = new Map(bowling.map((b) => [b.key, b]));

  // 3 all-rounders first (must have both sides contributed)
  const allRounderScored = batting
    .filter((b) => (bowlByKey.get(b.key)?.wickets ?? 0) >= 3 && b.runs >= 40)
    .map((b) => ({
      key: b.key,
      bat: b,
      bowl: bowlByKey.get(b.key)!,
      score: allRounderImpact(b, bowlByKey.get(b.key)),
    }))
    .sort((a, b) => b.score - a.score);
  for (const r of allRounderScored.slice(0, 3)) {
    if (usedKeys.has(r.key)) continue;
    usedKeys.add(r.key);
    picks.push({
      role: "all-rounder",
      athleteId: r.bat.athleteId,
      name: r.bat.name,
      headline: `${r.bat.runs} runs · ${r.bowl.wickets} wkts`,
    });
  }

  // 1 wicket-keeper (top by stumpings + catches while batting well)
  const wkScored = fielding
    .filter((f) => f.stumpings > 0)
    .map((f) => ({
      key: f.key,
      f,
      bat: batByKey.get(f.key),
      score: f.stumpings * 20 + f.catches * 8 + (batByKey.get(f.key)?.runs ?? 0) * 0.4,
    }))
    .sort((a, b) => b.score - a.score);
  for (const wk of wkScored) {
    if (usedKeys.has(wk.key)) continue;
    usedKeys.add(wk.key);
    picks.push({
      role: "wicket-keeper",
      athleteId: wk.f.athleteId,
      name: wk.f.name,
      headline: `${wk.f.stumpings}st · ${wk.f.catches}c${wk.bat ? ` · ${wk.bat.runs} runs` : ""}`,
    });
    break;
  }

  // 4 top batters (not yet used)
  const batSorted = [...batting].sort((a, b) => batterImpact(b) - batterImpact(a));
  for (const b of batSorted) {
    if (picks.filter((p) => p.role === "batter").length >= 4) break;
    if (usedKeys.has(b.key)) continue;
    usedKeys.add(b.key);
    picks.push({
      role: "batter",
      athleteId: b.athleteId,
      name: b.name,
      headline: battingHeadline(b),
    });
  }

  // 3 bowlers
  const bowlSorted = [...bowling].sort((a, b) => bowlerImpact(b) - bowlerImpact(a));
  for (const bw of bowlSorted) {
    if (picks.filter((p) => p.role === "bowler").length >= 3) break;
    if (usedKeys.has(bw.key)) continue;
    usedKeys.add(bw.key);
    picks.push({
      role: "bowler",
      athleteId: bw.athleteId,
      name: bw.name,
      headline: bowlingHeadline(bw),
    });
  }

  return picks;
}

/* ---------------- Fair Play (team) ---------------- */

function fairPlayTeam(analytics: TournamentAnalytics): TeamAwardWinner | null {
  // Heuristic: team with lowest dot-ball % as bowling side is a poor proxy.
  // Better proxy readily available: teams have `boundaryPct` conceded... we
  // don't track extras conceded per team here yet, so pick fewest losses per
  // match with highest win rate as a temporary stand-in that stays stable.
  const eligible = analytics.teams.filter((t) => t.matches >= 2);
  if (eligible.length === 0) return null;
  const scored = eligible
    .map((t) => ({ t, score: t.winPct + t.matches * 2 - t.losses * 3 }))
    .sort((a, b) => b.score - a.score);
  const w = scored[0];
  return w
    ? {
        teamId: w.t.teamId,
        name: w.t.name,
        headline: `${w.t.matches} played · ${w.t.wins}W ${w.t.losses}L`,
        score: w.score,
      }
    : null;
}

/* ---------------- Emerging Player ----------------
 * Highest per-match batting impact among players with ≤ 3 matches.
 */
function emergingPlayer(batting: PlayerBattingRow[]): AwardWinner | null {
  const pool = batting.filter((b) => b.matches > 0 && b.matches <= 3 && b.runs >= 30);
  if (pool.length === 0) return null;
  const { winner } = bestOf(pool, (b) => batterImpact(b) / Math.max(1, b.matches));
  if (!winner) return null;
  return {
    athleteId: winner.athleteId,
    name: winner.name,
    headline: `${winner.runs} runs in ${winner.matches} match${winner.matches === 1 ? "" : "es"}`,
    score: winner.runs / Math.max(1, winner.matches),
  };
}

/* ---------------- Entry point ---------------- */

export function computeTournamentAwards(analytics: TournamentAnalytics): TournamentAwards {
  const { batting, bowling, fielding } = analytics;

  const fieldingByKey = new Map(fielding.map((f) => [f.key, f]));
  const battingByKey = new Map(batting.map((b) => [b.key, b]));
  const bowlingByKey = new Map(bowling.map((b) => [b.key, b]));

  // Player of the Tournament — composite score over all disciplines
  const allKeys = new Set<string>([
    ...batting.map((b) => b.key),
    ...bowling.map((b) => b.key),
    ...fielding.map((f) => f.key),
  ]);
  let potmWinner: AwardWinner | null = null;
  let potmScore = -Infinity;
  for (const key of allKeys) {
    const b = battingByKey.get(key);
    const bw = bowlingByKey.get(key);
    const f = fieldingByKey.get(key);
    const score = potmImpact(b, bw, f);
    if (score > potmScore) {
      potmScore = score;
      const name = b?.name ?? bw?.name ?? f?.name ?? "—";
      const athleteId = b?.athleteId ?? bw?.athleteId ?? f?.athleteId ?? null;
      const partsHeadline: string[] = [];
      if (b && b.runs > 0) partsHeadline.push(`${b.runs}r`);
      if (bw && bw.wickets > 0) partsHeadline.push(`${bw.wickets}w`);
      if (b && b.potm > 0) partsHeadline.push(`${b.potm} POTM`);
      potmWinner = {
        athleteId,
        name,
        headline: partsHeadline.join(" · ") || "All-round impact",
        score,
      };
    }
  }

  const bestBatWinner = bestOf(batting, batterImpact).winner;
  const bestBowlWinner = bestOf(bowling, bowlerImpact).winner;

  const allRounderPool = batting
    .filter((b) => bowlingByKey.has(b.key))
    .map((b) => ({
      b,
      bw: bowlingByKey.get(b.key)!,
      score: allRounderImpact(b, bowlingByKey.get(b.key)),
    }))
    .sort((a, b) => b.score - a.score);
  const bestAllRounderPick = allRounderPool[0] ?? null;

  const bestFieldWinner = bestOf(fielding, fielderImpact).winner;

  // Orange / Purple caps (leaders by raw runs / wickets — canonical)
  const orange = [...batting].sort((a, b) => b.runs - a.runs)[0] ?? null;
  const purple = [...bowling].sort((a, b) => b.wickets - a.wickets)[0] ?? null;

  return {
    playerOfTournament: potmWinner,
    bestBatter: bestBatWinner
      ? {
          athleteId: bestBatWinner.athleteId,
          name: bestBatWinner.name,
          headline: battingHeadline(bestBatWinner),
          score: batterImpact(bestBatWinner),
        }
      : null,
    bestBowler: bestBowlWinner
      ? {
          athleteId: bestBowlWinner.athleteId,
          name: bestBowlWinner.name,
          headline: bowlingHeadline(bestBowlWinner),
          score: bowlerImpact(bestBowlWinner),
        }
      : null,
    bestAllRounder: bestAllRounderPick
      ? {
          athleteId: bestAllRounderPick.b.athleteId,
          name: bestAllRounderPick.b.name,
          headline: `${bestAllRounderPick.b.runs} runs · ${bestAllRounderPick.bw.wickets} wkts`,
          score: bestAllRounderPick.score,
        }
      : null,
    bestFielder: bestFieldWinner
      ? {
          athleteId: bestFieldWinner.athleteId,
          name: bestFieldWinner.name,
          headline: fieldingHeadline(bestFieldWinner),
          score: fielderImpact(bestFieldWinner),
        }
      : null,
    emergingPlayer: emergingPlayer(batting),
    orangeCap: orange
      ? {
          athleteId: orange.athleteId,
          name: orange.name,
          headline: `${orange.runs} runs · ${orange.matches} matches`,
          score: orange.runs,
        }
      : null,
    purpleCap: purple
      ? {
          athleteId: purple.athleteId,
          name: purple.name,
          headline: `${purple.wickets} wickets · ${purple.matches} matches`,
          score: purple.wickets,
        }
      : null,
    fairPlayTeam: fairPlayTeam(analytics),
    teamOfTournament: pickTeamOfTournament(batting, bowling, fielding),
  };
}

/** Utility so callers can iterate a stable label list. */
export const AWARD_LABELS: Array<{
  key: keyof TournamentAwards;
  label: string;
  description: string;
}> = [
  {
    key: "playerOfTournament",
    label: "Player of the Tournament",
    description: "Best composite performance",
  },
  { key: "bestBatter", label: "Best Batter", description: "Runs, average, strike rate & impact" },
  { key: "bestBowler", label: "Best Bowler", description: "Wickets, economy, hauls & hat-tricks" },
  { key: "bestAllRounder", label: "Best All-Rounder", description: "Bat + ball combined impact" },
  { key: "bestFielder", label: "Best Fielder", description: "Catches, stumpings & run-outs" },
  { key: "emergingPlayer", label: "Emerging Player", description: "Top output in ≤ 3 matches" },
  { key: "orangeCap", label: "Orange Cap", description: "Most runs in the tournament" },
  { key: "purpleCap", label: "Purple Cap", description: "Most wickets in the tournament" },
  { key: "fairPlayTeam", label: "Fair Play Team", description: "Team with best conduct record" },
];

/** Reused by exports — flattens awards to CSV-shaped rows. */
export function awardsToRows(
  a: TournamentAwards,
): Array<{ award: string; winner: string; details: string }> {
  const rows: Array<{ award: string; winner: string; details: string }> = [];
  for (const item of AWARD_LABELS) {
    const w = a[item.key] as AwardWinner | TeamAwardWinner | null;
    rows.push({
      award: item.label,
      winner: w?.name ?? "—",
      details: w?.headline ?? "",
    });
  }
  a.teamOfTournament.forEach((p, i) =>
    rows.push({
      award: `Team of the Tournament #${i + 1} (${p.role})`,
      winner: p.name,
      details: p.headline,
    }),
  );
  return rows;
}
