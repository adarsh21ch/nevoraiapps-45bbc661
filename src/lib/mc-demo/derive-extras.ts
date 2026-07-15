/* ================================================================
 * Demo Derivation Layer — Extras
 * ----------------------------------------------------------------
 * Recognitions, Awards, Player Performance and Parent Summary all
 * derived from the SAME immutable demo ball-event log used by the
 * production statistics/derivation engines. No new cricket math.
 * ================================================================ */

import {
  computeBatting,
  computeBowling,
  computeFielding,
  playerKey,
  type BattingStat,
  type BowlingStat,
} from "@/lib/mc-statistics-engine";
import type { DemoData } from "@/lib/mc-demo/generate";
import type { MCBallEvent } from "@/lib/mc-ball-events";
import { derivePlayerCareer, type PlayerCareer } from "@/lib/mc-demo/derive";

/* ---------------- Recognitions ---------------- */

export interface DerivedRecognition {
  id: string;
  matchId: string;
  matchLabel: string;
  matchDate: string | null;
  recognitionType:
    | "player_of_match"
    | "century"
    | "half_century"
    | "five_wicket_haul"
    | "hat_trick"
    | "best_batter"
    | "best_bowler";
  title: string;
  description: string;
  athleteId: string | null;
  athleteName: string;
  badge: string;
  awardedAt: string;
}

function eventsFor(demo: DemoData, matchId: string): MCBallEvent[] {
  return demo.ballEvents.filter((e) => e.match_id === matchId);
}

function nameFor(demo: DemoData, id: string | null, fallback: string) {
  if (!id) return fallback;
  const p = demo.players.find((x) => x.id === id);
  return p?.student?.name ?? fallback;
}

function detectHatTricks(
  events: MCBallEvent[],
): Array<{ bowler: string; bowlerId: string | null }> {
  const hats: Array<{ bowler: string; bowlerId: string | null }> = [];
  let streak: Array<{ bowler: string; bowlerId: string | null }> = [];
  for (const e of events) {
    if (!e.dismissal_type) {
      // legal non-dismissal breaks streak only if bowler changes
      continue;
    }
    const cur = { bowler: e.bowler_name ?? "", bowlerId: e.bowler_athlete_id ?? null };
    if (streak.length && streak[streak.length - 1].bowler !== cur.bowler) streak = [];
    streak.push(cur);
    if (streak.length >= 3) {
      hats.push(cur);
      streak = [];
    }
  }
  return hats;
}

export function deriveRecognitions(demo: DemoData): DerivedRecognition[] {
  const out: DerivedRecognition[] = [];

  for (const m of demo.matches) {
    const events = eventsFor(demo, m.id);
    if (events.length === 0) continue;
    const label = `${m.team_a?.name ?? "Team A"} vs ${m.team_b?.name ?? "Team B"}`;
    const date = m.scheduled_date ?? null;
    const awardedAt = date ?? new Date().toISOString();

    const bat = computeBatting(events);
    const bowl = computeBowling(events);
    const field = computeFielding(events);

    // Player of the match: max (runs + wkts*20 + catches*10)
    let pomKey: string | null = null;
    let pomScore = -1;
    let pomAthleteId: string | null = null;
    let pomName = "—";
    const scoreMap = new Map<string, number>();
    bat.byKey.forEach((s, k) => {
      const score = s.runs;
      scoreMap.set(k, (scoreMap.get(k) ?? 0) + score);
    });
    bowl.byKey.forEach((s, k) => {
      scoreMap.set(k, (scoreMap.get(k) ?? 0) + s.wickets * 20);
    });
    field.byKey.forEach((s, k) => {
      scoreMap.set(k, (scoreMap.get(k) ?? 0) + (s.catches + s.stumpings + s.runOuts) * 10);
    });
    scoreMap.forEach((v, k) => {
      if (v > pomScore) {
        pomScore = v;
        pomKey = k;
      }
    });
    if (pomKey) {
      const b = bat.byKey.get(pomKey);
      const bo = bowl.byKey.get(pomKey);
      const anchor = b?.player ?? bo?.player;
      if (anchor) {
        pomAthleteId = anchor.athleteId;
        pomName = nameFor(demo, anchor.athleteId, anchor.name ?? "Unknown");
        const runsPart = b ? `${b.runs} (${b.balls})` : "";
        const wktsPart = bo && bo.wickets > 0 ? `${bo.wickets}/${bo.runsConceded}` : "";
        out.push({
          id: `demo-pom-${m.id}`,
          matchId: m.id,
          matchLabel: label,
          matchDate: date,
          recognitionType: "player_of_match",
          title: "Player of the Match",
          description: [runsPart, wktsPart].filter(Boolean).join(" · ") || "Standout performance",
          athleteId: pomAthleteId,
          athleteName: pomName,
          badge: "🏅",
          awardedAt,
        });
      }
    }

    // Centuries and fifties
    bat.byKey.forEach((s) => {
      const name = nameFor(demo, s.player.athleteId, s.player.name ?? "Unknown");
      if (s.isCentury) {
        out.push({
          id: `demo-100-${m.id}-${s.player.key}`,
          matchId: m.id,
          matchLabel: label,
          matchDate: date,
          recognitionType: "century",
          title: "Century Club",
          description: `Scored ${s.runs} (${s.balls}) — ${s.fours}×4, ${s.sixes}×6`,
          athleteId: s.player.athleteId,
          athleteName: name,
          badge: "💯",
          awardedAt,
        });
      } else if (s.isHalfCentury) {
        out.push({
          id: `demo-50-${m.id}-${s.player.key}`,
          matchId: m.id,
          matchLabel: label,
          matchDate: date,
          recognitionType: "half_century",
          title: "Fifty Club",
          description: `Scored ${s.runs} (${s.balls})`,
          athleteId: s.player.athleteId,
          athleteName: name,
          badge: "5️⃣0️⃣",
          awardedAt,
        });
      }
    });

    // Five wicket hauls
    bowl.byKey.forEach((s) => {
      if (s.wickets >= 5) {
        const name = nameFor(demo, s.player.athleteId, s.player.name ?? "Unknown");
        out.push({
          id: `demo-5w-${m.id}-${s.player.key}`,
          matchId: m.id,
          matchLabel: label,
          matchDate: date,
          recognitionType: "five_wicket_haul",
          title: "Five-Wicket Club",
          description: `${s.wickets}/${s.runsConceded} in ${Math.floor(s.legalBalls / 6)}.${s.legalBalls % 6} overs`,
          athleteId: s.player.athleteId,
          athleteName: name,
          badge: "🎯",
          awardedAt,
        });
      }
    });

    // Hat tricks
    for (const h of detectHatTricks(events)) {
      const name = nameFor(demo, h.bowlerId, h.bowler || "Bowler");
      out.push({
        id: `demo-hat-${m.id}-${h.bowlerId ?? h.bowler}`,
        matchId: m.id,
        matchLabel: label,
        matchDate: date,
        recognitionType: "hat_trick",
        title: "Hat Trick",
        description: "Three wickets in three consecutive balls",
        athleteId: h.bowlerId,
        athleteName: name,
        badge: "🎩",
        awardedAt,
      });
    }
  }

  return out.sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? ""));
}

/* ---------------- Awards ---------------- */

export interface DerivedAward {
  id: string;
  category: "season" | "tournament" | "match" | "career";
  title: string;
  holderName: string;
  athleteId: string | null;
  value: string;
  detail?: string;
}

export function deriveAwards(demo: DemoData): DerivedAward[] {
  const runsByPlayer = new Map<string, { name: string; id: string | null; runs: number }>();
  const wktsByPlayer = new Map<string, { name: string; id: string | null; wickets: number }>();
  const fieldByPlayer = new Map<string, { name: string; id: string | null; total: number }>();
  const srByPlayer = new Map<
    string,
    { name: string; id: string | null; runs: number; balls: number; matches: number }
  >();

  for (const m of demo.matches) {
    const events = eventsFor(demo, m.id);
    if (!events.length) continue;
    const bat = computeBatting(events);
    const bowl = computeBowling(events);
    const field = computeFielding(events);

    bat.byKey.forEach((s, k) => {
      const name = nameFor(demo, s.player.athleteId, s.player.name ?? "Unknown");
      const r = runsByPlayer.get(k) ?? { name, id: s.player.athleteId, runs: 0 };
      r.runs += s.runs;
      runsByPlayer.set(k, r);
      const sr = srByPlayer.get(k) ?? {
        name,
        id: s.player.athleteId,
        runs: 0,
        balls: 0,
        matches: 0,
      };
      sr.runs += s.runs;
      sr.balls += s.balls;
      sr.matches += 1;
      srByPlayer.set(k, sr);
    });
    bowl.byKey.forEach((s, k) => {
      const name = nameFor(demo, s.player.athleteId, s.player.name ?? "Unknown");
      const r = wktsByPlayer.get(k) ?? { name, id: s.player.athleteId, wickets: 0 };
      r.wickets += s.wickets;
      wktsByPlayer.set(k, r);
    });
    field.byKey.forEach((s, k) => {
      const name = nameFor(demo, s.player.athleteId, s.player.name ?? "Unknown");
      const r = fieldByPlayer.get(k) ?? { name, id: s.player.athleteId, total: 0 };
      r.total += s.catches + s.stumpings + s.runOuts;
      fieldByPlayer.set(k, r);
    });
  }

  const awards: DerivedAward[] = [];

  const bestBat = Array.from(runsByPlayer.values()).sort((a, b) => b.runs - a.runs)[0];
  if (bestBat && bestBat.runs > 0) {
    awards.push({
      id: "award-batter-season",
      category: "season",
      title: "Batter of the Season",
      holderName: bestBat.name,
      athleteId: bestBat.id,
      value: `${bestBat.runs} runs`,
    });
  }
  const bestBowl = Array.from(wktsByPlayer.values()).sort((a, b) => b.wickets - a.wickets)[0];
  if (bestBowl && bestBowl.wickets > 0) {
    awards.push({
      id: "award-bowler-season",
      category: "season",
      title: "Bowler of the Season",
      holderName: bestBowl.name,
      athleteId: bestBowl.id,
      value: `${bestBowl.wickets} wickets`,
    });
  }
  const bestField = Array.from(fieldByPlayer.values()).sort((a, b) => b.total - a.total)[0];
  if (bestField && bestField.total > 0) {
    awards.push({
      id: "award-fielder-season",
      category: "season",
      title: "Fielder of the Season",
      holderName: bestField.name,
      athleteId: bestField.id,
      value: `${bestField.total} dismissals`,
    });
  }
  // All-rounder: highest combined (runs + wickets*20)
  const allR = new Map<
    string,
    { name: string; id: string | null; score: number; runs: number; wkts: number }
  >();
  runsByPlayer.forEach((v, k) => {
    allR.set(k, { name: v.name, id: v.id, score: v.runs, runs: v.runs, wkts: 0 });
  });
  wktsByPlayer.forEach((v, k) => {
    const cur = allR.get(k) ?? { name: v.name, id: v.id, score: 0, runs: 0, wkts: 0 };
    cur.wkts = v.wickets;
    cur.score += v.wickets * 20;
    allR.set(k, cur);
  });
  const bestAll = Array.from(allR.values())
    .filter((v) => v.runs > 0 && v.wkts > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (bestAll) {
    awards.push({
      id: "award-all-rounder-season",
      category: "season",
      title: "All-Rounder of the Season",
      holderName: bestAll.name,
      athleteId: bestAll.id,
      value: `${bestAll.runs} runs · ${bestAll.wkts} wkts`,
    });
  }
  // Rising Star: highest strike rate (min 3 matches, min 60 balls faced)
  const rising = Array.from(srByPlayer.values())
    .filter((r) => r.matches >= 3 && r.balls >= 60)
    .map((r) => ({ ...r, sr: (r.runs / r.balls) * 100 }))
    .sort((a, b) => b.sr - a.sr)[0];
  if (rising) {
    awards.push({
      id: "award-rising-star",
      category: "season",
      title: "Rising Star",
      holderName: rising.name,
      athleteId: rising.id,
      value: `SR ${rising.sr.toFixed(1)}`,
      detail: `${rising.runs} runs off ${rising.balls} balls`,
    });
  }
  return awards;
}

/* ---------------- Player Performance (matches PlayerPerformance shape) ---------------- */

export interface DemoPlayerPerformance {
  athleteId: string;
  points: Array<{
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
  }>;
  totals: {
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
  };
  byMatchType: DemoPlayerPerformance["totals"][];
  byInningsOrder: DemoPlayerPerformance["totals"][];
  byResult: DemoPlayerPerformance["totals"][];
  byVenue: DemoPlayerPerformance["totals"][];
  dismissals: Array<{ type: string; count: number; pct: number }>;
  consistency: {
    score: number;
    band: "Excellent" | "Good" | "Average" | "Needs Improvement";
    runsStdDev: number;
    wicketsStdDev: number;
  };
  form: {
    last5: DemoPlayerPerformance["totals"];
    last10: DemoPlayerPerformance["totals"];
    last20: DemoPlayerPerformance["totals"];
    trend: "up" | "down" | "flat";
    trendDelta: number;
  };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function bucketFromPoints(
  label: string,
  points: DemoPlayerPerformance["points"],
  career: PlayerCareer,
): DemoPlayerPerformance["totals"] {
  const runs = points.reduce((s, p) => s + p.runs, 0);
  const balls = points.reduce((s, p) => s + p.balls, 0);
  const wkts = points.reduce((s, p) => s + p.wickets, 0);
  const ballsBowled = points.reduce((s, p) => s + p.ballsBowled, 0);
  const runsConceded = points.reduce((s, p) => s + p.runsConceded, 0);
  const dismissals = Math.max(1, points.length - career.batting.notOuts);
  return {
    label,
    matches: points.length,
    innings: points.filter((p) => p.balls > 0 || p.runs > 0).length,
    runs,
    balls,
    average: dismissals > 0 ? +(runs / dismissals).toFixed(2) : +runs.toFixed(2),
    strikeRate: balls > 0 ? +((runs / balls) * 100).toFixed(1) : 0,
    wickets: wkts,
    ballsBowled,
    economy: ballsBowled > 0 ? +((runsConceded / ballsBowled) * 6).toFixed(2) : 0,
  };
}

export function derivePlayerPerformance(
  demo: DemoData,
  athleteId: string,
): DemoPlayerPerformance | null {
  const career = derivePlayerCareer(demo, athleteId);
  if (career.matchHistory.length === 0) return null;
  const key = playerKey(athleteId, null);

  const points: DemoPlayerPerformance["points"] = [];
  const dismissalCounts = new Map<string, number>();
  let cumRuns = 0;
  let cumDismissals = 0;
  // chronological (career.matchHistory is desc; reverse)
  const chrono = [...career.matchHistory].reverse();

  for (const h of chrono) {
    const events = demo.ballEvents.filter((e) => e.match_id === h.matchId);
    const bat = computeBatting(events);
    const bowl = computeBowling(events);
    const b = key ? bat.byKey.get(key) : undefined;
    const bo = key ? bowl.byKey.get(key) : undefined;
    if (b && !b.notOut) cumDismissals += 1;
    cumRuns += b?.runs ?? 0;
    const avg = cumDismissals > 0 ? cumRuns / cumDismissals : cumRuns;
    points.push({
      matchId: h.matchId,
      date: h.date,
      runs: b?.runs ?? 0,
      balls: b?.balls ?? 0,
      wickets: bo?.wickets ?? 0,
      ballsBowled: bo?.legalBalls ?? 0,
      runsConceded: bo?.runsConceded ?? 0,
      strikeRate: b && b.balls ? (b.runs / b.balls) * 100 : 0,
      economy: bo && bo.legalBalls ? (bo.runsConceded / bo.legalBalls) * 6 : 0,
      battingAvgToDate: +avg.toFixed(2),
      won: null,
    });
    // dismissals for player
    if (b?.dismissalType) {
      dismissalCounts.set(b.dismissalType, (dismissalCounts.get(b.dismissalType) ?? 0) + 1);
    }
  }

  const totalDismiss = Array.from(dismissalCounts.values()).reduce((s, v) => s + v, 0);
  const dismissals = Array.from(dismissalCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      pct: totalDismiss > 0 ? Math.round((count / totalDismiss) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totals = bucketFromPoints("All", points, career);
  const runsSeries = points.map((p) => p.runs);
  const wktsSeries = points.map((p) => p.wickets);
  const runsSd = stdDev(runsSeries);
  const wktsSd = stdDev(wktsSeries);
  const mean = runsSeries.reduce((s, v) => s + v, 0) / Math.max(1, runsSeries.length);
  const cv = mean > 0 ? runsSd / mean : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - cv * 60)));
  const band: DemoPlayerPerformance["consistency"]["band"] =
    score >= 80
      ? "Excellent"
      : score >= 65
        ? "Good"
        : score >= 45
          ? "Average"
          : "Needs Improvement";

  const last = (n: number) => bucketFromPoints(`Last ${n}`, points.slice(-n), career);
  const l5 = last(5);
  const l10 = last(10);
  const l20 = last(20);
  const recent =
    points.slice(-5).reduce((s, p) => s + p.runs, 0) / Math.max(1, Math.min(5, points.length));
  const prior =
    points.slice(-10, -5).reduce((s, p) => s + p.runs, 0) /
    Math.max(1, Math.min(5, points.length - 5));
  const delta = +(recent - prior).toFixed(2);
  const trend: "up" | "down" | "flat" = Math.abs(delta) < 2 ? "flat" : delta > 0 ? "up" : "down";

  return {
    athleteId,
    points,
    totals,
    byMatchType: [],
    byInningsOrder: [],
    byResult: [],
    byVenue: [],
    dismissals,
    consistency: { score, band, runsStdDev: runsSd, wicketsStdDev: wktsSd },
    form: { last5: l5, last10: l10, last20: l20, trend, trendDelta: delta },
  };
}

/* ---------------- Parent Summary (ChildSummary-compatible) ---------------- */

export interface DemoChildSummary {
  student: Record<string, unknown> | null;
  athlete_profile_id: string | null;
  cricket_profile: Record<string, unknown> | null;
  career: Record<string, unknown> | null;
  recognitions: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  recent_matches: Array<{
    match_id: string;
    scheduled_date: string | null;
    team_a_id: string | null;
    team_b_id: string | null;
    winner_team: string | null;
    result: string | null;
    match_locked: boolean;
  }>;
}

export function deriveChildSummary(demo: DemoData, athleteId: string): DemoChildSummary | null {
  const player = demo.players.find((p) => p.id === athleteId);
  if (!player) return null;
  const career = derivePlayerCareer(demo, athleteId);
  const recognitions = deriveRecognitions(demo).filter((r) => r.athleteId === athleteId);
  const recentMatches = career.matchHistory.slice(0, 20).map((h) => {
    const m = demo.matches.find((x) => x.id === h.matchId);
    return {
      match_id: h.matchId,
      scheduled_date: h.date,
      team_a_id: m?.team_a_id ?? null,
      team_b_id: m?.team_b_id ?? null,
      winner_team:
        (m as unknown as { winner_team?: string | null } | undefined)?.winner_team ?? null,
      result: m?.result ?? null,
      match_locked: m?.status === "completed",
    };
  });

  return {
    student: (player.student ?? null) as Record<string, unknown> | null,
    athlete_profile_id: athleteId,
    cricket_profile: (player.cricket ?? null) as Record<string, unknown> | null,
    career: {
      matches: career.batting.matches,
      innings: career.batting.innings,
      runs: career.batting.runs,
      average: career.batting.average,
      strike_rate: career.batting.strikeRate,
      highest_score: career.batting.highest,
      highest_score_not_out: false,
      fifties: career.batting.fifties,
      hundreds: career.batting.hundreds,
      fours: career.batting.fours,
      sixes: career.batting.sixes,
      wickets: career.bowling.wickets,
      overs: career.bowling.overs,
      economy: career.bowling.economy,
      best_bowling: career.bowling.bestFigures,
      five_wicket_hauls: recognitions.filter((r) => r.recognitionType === "five_wicket_haul")
        .length,
      maidens: career.bowling.maidens,
      catches: career.fielding.catches,
      stumpings: career.fielding.stumpings,
      run_outs: career.fielding.runOuts,
      player_of_match: recognitions.filter((r) => r.recognitionType === "player_of_match").length,
      captain_matches: 0,
      captain_wins: 0,
      captain_losses: 0,
    },
    recognitions: recognitions.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      awarded_at: r.awardedAt,
      recognition_type: r.recognitionType,
      badge: r.badge,
    })),
    achievements: recognitions
      .filter(
        (r) =>
          r.recognitionType === "century" ||
          r.recognitionType === "five_wicket_haul" ||
          r.recognitionType === "hat_trick",
      )
      .map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        event_date: r.awardedAt,
        kind: r.recognitionType,
      })),
    timeline: recognitions.slice(0, 20).map((r) => ({
      id: r.id,
      title: `${r.badge} ${r.title}`,
      description: `${r.athleteName} · ${r.description}`,
      event_date: r.awardedAt,
    })),
    recent_matches: recentMatches,
  };
}
