/* ================================================================
 * AI Insights Engine
 * ----------------------------------------------------------------
 * READS ONLY from other engines. Never reads Ball Events directly.
 * Never performs cricket calculations. All output is deterministic,
 * template-driven, and rule-based. Architecture allows a future LLM
 * layer to enrich `summary` / `recommendations` without any schema
 * change.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzeMatchInsights,
  computeAcademyOverview,
  computeCaptainRecords,
  computeTeamRecords,
  leaderboardCareer,
  leaderboardMostRuns,
  leaderboardMostWickets,
  type MatchInsights,
} from "@/lib/mc-academy-records";
import { getCareer } from "@/lib/mc-career-engine";
import {
  computeOrangeCap,
  computePurpleCap,
  computeStandings,
  computeTournamentRecords,
} from "@/lib/mc-tournament-engine";

export type MCAIReport = Database["public"]["Tables"]["mc_ai_reports"]["Row"];
export type MCAISettings = Database["public"]["Tables"]["mc_ai_settings"]["Row"];

export type AIReportType =
  | "match"
  | "player"
  | "bowler"
  | "batter"
  | "team"
  | "captain"
  | "tournament"
  | "academy_monthly"
  | "academy_season"
  | "custom";

export type AIReferenceType =
  | "match"
  | "athlete"
  | "team"
  | "tournament"
  | "academy";

export interface AIFinding {
  label: string;
  detail?: string;
}

export interface AIReportPayload {
  reportType: AIReportType;
  referenceType: AIReferenceType;
  referenceId: string | null;
  title: string;
  summary: string;
  keyFindings: AIFinding[];
  strengths: AIFinding[];
  weaknesses: AIFinding[];
  recommendations: AIFinding[];
  metadata: Record<string, unknown>;
}

/* ================================================================
 * Settings
 * ================================================================ */

export async function getAISettings(tenantId: string): Promise<MCAISettings> {
  const { data, error } = await supabase
    .from("mc_ai_settings")
    .select("*")
    .eq("academy_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: insErr } = await supabase
    .from("mc_ai_settings")
    .insert({ academy_id: tenantId })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created;
}

export async function updateAISettings(
  tenantId: string,
  patch: Partial<Omit<MCAISettings, "id" | "academy_id" | "created_at" | "updated_at">>,
): Promise<MCAISettings> {
  await getAISettings(tenantId);
  const { data, error } = await supabase
    .from("mc_ai_settings")
    .update(patch)
    .eq("academy_id", tenantId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* ================================================================
 * Persistence
 * ================================================================ */

async function persistReport(
  tenantId: string,
  payload: AIReportPayload,
): Promise<MCAIReport> {
  const row = {
    academy_id: tenantId,
    report_type: payload.reportType,
    reference_type: payload.referenceType,
    reference_id: payload.referenceId,
    title: payload.title,
    summary: payload.summary,
    key_findings: payload.keyFindings as unknown as Database["public"]["Tables"]["mc_ai_reports"]["Insert"]["key_findings"],
    strengths: payload.strengths as unknown as Database["public"]["Tables"]["mc_ai_reports"]["Insert"]["strengths"],
    weaknesses: payload.weaknesses as unknown as Database["public"]["Tables"]["mc_ai_reports"]["Insert"]["weaknesses"],
    recommendations: payload.recommendations as unknown as Database["public"]["Tables"]["mc_ai_reports"]["Insert"]["recommendations"],
    metadata: payload.metadata as unknown as Database["public"]["Tables"]["mc_ai_reports"]["Insert"]["metadata"],
    generated_by: "system",
    generated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("mc_ai_reports")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listReports(
  tenantId: string,
  opts?: { reportType?: AIReportType; referenceId?: string; limit?: number },
): Promise<MCAIReport[]> {
  let q = supabase
    .from("mc_ai_reports")
    .select("*")
    .eq("academy_id", tenantId)
    .order("generated_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.reportType) q = q.eq("report_type", opts.reportType);
  if (opts?.referenceId) q = q.eq("reference_id", opts.referenceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getReport(id: string): Promise<MCAIReport | null> {
  const { data, error } = await supabase
    .from("mc_ai_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("mc_ai_reports").delete().eq("id", id);
  if (error) throw error;
}

export async function searchReports(
  tenantId: string,
  term: string,
): Promise<MCAIReport[]> {
  const t = term.trim();
  if (!t) return listReports(tenantId, { limit: 30 });
  const { data, error } = await supabase
    .from("mc_ai_reports")
    .select("*")
    .eq("academy_id", tenantId)
    .or(`title.ilike.%${t}%,summary.ilike.%${t}%`)
    .order("generated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/* ================================================================
 * Recommendation templates (deterministic)
 * ================================================================ */

const RECS = {
  practiceYorkers: { label: "Practice yorkers", detail: "Improve death-overs execution." },
  improveRunning: { label: "Improve running between wickets", detail: "Convert 1s into 2s." },
  rotateStrike: { label: "Increase strike rotation", detail: "Reduce dot-ball percentage." },
  slipCatching: { label: "Improve slip catching", detail: "Add reflex sessions." },
  deathBowling: { label: "Work on death bowling", detail: "Focus on last 4 overs." },
  fitness: { label: "Improve fitness", detail: "Endurance + agility work." },
  consistency: { label: "Improve consistency", detail: "Reduce match-to-match variance." },
  spin: { label: "Needs improvement against spin", detail: "Add spin net sessions." },
  fielding: { label: "Improve fielding consistency", detail: "Ground fielding drills." },
  captaincy: { label: "Refine captaincy decisions", detail: "Review bowling changes in wins." },
} as const;

/* ================================================================
 * MATCH REPORT
 * ================================================================ */

export async function generateMatchReport(matchId: string): Promise<AIReportPayload> {
  const { data: match, error } = await supabase
    .from("mc_matches")
    .select(
      "id, tenant_id, team_a_id, team_b_id, winner_team, winning_margin, winning_margin_type, victory_type, player_of_match_athlete_id, scheduled_date",
    )
    .eq("id", matchId)
    .single();
  if (error) throw error;

  const [teamA, teamB, pomProfile] = await Promise.all([
    match.team_a_id
      ? supabase.from("mc_teams").select("id, name").eq("id", match.team_a_id).maybeSingle()
      : Promise.resolve({ data: null }),
    match.team_b_id
      ? supabase.from("mc_teams").select("id, name").eq("id", match.team_b_id).maybeSingle()
      : Promise.resolve({ data: null }),
    match.player_of_match_athlete_id
      ? supabase
          .from("mc_athlete_profiles")
          .select("id, student_id, students(name)")
          .eq("id", match.player_of_match_athlete_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const insights: MatchInsights = await analyzeMatchInsights(matchId);

  const teamAName = (teamA?.data as { name?: string } | null)?.name ?? "Team A";
  const teamBName = (teamB?.data as { name?: string } | null)?.name ?? "Team B";
  const winnerName =
    match.winner_team === match.team_a_id
      ? teamAName
      : match.winner_team === match.team_b_id
        ? teamBName
        : null;
  const pomName =
    ((pomProfile?.data as { students?: { name?: string } | null } | null)?.students?.name) ?? null;

  const resultLine = winnerName
    ? `${winnerName} won${match.winning_margin ? ` by ${match.winning_margin} ${match.winning_margin_type ?? ""}`.trim() : ""}`
    : match.victory_type === "tie"
      ? "Match tied"
      : match.victory_type === "no_result"
        ? "No result"
        : "Match finalized";

  const keyFindings: AIFinding[] = [{ label: resultLine }];
  if (insights.highestIndividualScore) {
    const b = insights.highestIndividualScore;
    keyFindings.push({
      label: "Top batter",
      detail: `${b.name} — ${b.runs}(${b.balls}) with ${b.fours}×4, ${b.sixes}×6`,
    });
  }
  if (insights.bestBowling) {
    const bw = insights.bestBowling;
    keyFindings.push({
      label: "Best bowling spell",
      detail: `${bw.name} — ${bw.wickets}/${bw.runsConceded} in ${bw.overs} overs`,
    });
  }
  if (insights.highestPartnership) {
    const p = insights.highestPartnership;
    keyFindings.push({
      label: "Highest partnership",
      detail: `${p.p1Name} & ${p.p2Name} — ${p.runs}(${p.balls})`,
    });
  }
  if (insights.mostSixesInInnings && insights.mostSixesInInnings.sixes > 0) {
    const s = insights.mostSixesInInnings;
    keyFindings.push({ label: "Most sixes", detail: `${s.name} — ${s.sixes}` });
  }
  if (pomName) keyFindings.push({ label: "Player of the Match", detail: pomName });

  const strengths: AIFinding[] = [];
  const weaknesses: AIFinding[] = [];
  if (insights.highestIndividualScore && insights.highestIndividualScore.runs >= 50)
    strengths.push({ label: "Match-winning batting", detail: `${insights.highestIndividualScore.name} anchored the innings.` });
  if (insights.bestBowling && insights.bestBowling.wickets >= 3)
    strengths.push({ label: "Match-winning bowling", detail: `${insights.bestBowling.name} broke the opposition open.` });
  if (insights.highestPartnership && insights.highestPartnership.runs >= 50)
    strengths.push({ label: "Strong partnership", detail: `${insights.highestPartnership.runs}-run stand shaped the innings.` });
  if (!insights.highestIndividualScore || insights.highestIndividualScore.runs < 25)
    weaknesses.push({ label: "No batter went deep", detail: "Batting group could not build partnerships." });
  if (!insights.bestBowling || insights.bestBowling.wickets < 2)
    weaknesses.push({ label: "Bowling lacked breakthroughs", detail: "Wickets were spread thin." });

  const recommendations: AIFinding[] = [];
  if (weaknesses.some((w) => w.label.startsWith("No batter"))) {
    recommendations.push(RECS.rotateStrike);
    recommendations.push(RECS.consistency);
  }
  if (weaknesses.some((w) => w.label.startsWith("Bowling"))) {
    recommendations.push(RECS.deathBowling);
    recommendations.push(RECS.practiceYorkers);
  }
  if (recommendations.length === 0) recommendations.push(RECS.fitness);

  const summary = [
    resultLine,
    insights.highestIndividualScore ? `Top scorer ${insights.highestIndividualScore.name} (${insights.highestIndividualScore.runs}).` : null,
    insights.bestBowling ? `Pick of the bowlers ${insights.bestBowling.name} (${insights.bestBowling.wickets}/${insights.bestBowling.runsConceded}).` : null,
    pomName ? `Player of the Match: ${pomName}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    reportType: "match",
    referenceType: "match",
    referenceId: matchId,
    title: `Match Report — ${teamAName} vs ${teamBName}`,
    summary,
    keyFindings,
    strengths,
    weaknesses,
    recommendations,
    metadata: { insights, winner: winnerName, pom: pomName, date: match.scheduled_date },
  };
}

export async function generateAndSaveMatchReport(
  tenantId: string,
  matchId: string,
): Promise<MCAIReport> {
  const payload = await generateMatchReport(matchId);
  return persistReport(tenantId, payload);
}

/* ================================================================
 * PLAYER REPORT (from Career Engine)
 * ================================================================ */

export async function generatePlayerReport(
  tenantId: string,
  athleteProfileId: string,
): Promise<AIReportPayload> {
  const career = await getCareer(athleteProfileId);
  const { data: profile } = await supabase
    .from("mc_athlete_profiles")
    .select("id, students(name)")
    .eq("id", athleteProfileId)
    .maybeSingle();
  const name = ((profile as { students?: { name?: string } | null } | null)?.students?.name) ?? "Player";

  if (!career) {
    return {
      reportType: "player",
      referenceType: "athlete",
      referenceId: athleteProfileId,
      title: `Player Report — ${name}`,
      summary: "No finalized matches yet. Career report will be generated after the first match.",
      keyFindings: [],
      strengths: [],
      weaknesses: [],
      recommendations: [RECS.fitness, RECS.consistency],
      metadata: { name },
    };
  }

  const keyFindings: AIFinding[] = [
    { label: "Matches", detail: String(career.matches) },
    { label: "Runs", detail: `${career.runs} (avg ${Number(career.average).toFixed(2)}, SR ${Number(career.strike_rate).toFixed(2)})` },
    { label: "Highest score", detail: `${career.highest_score}${career.highest_score_not_out ? "*" : ""}` },
    { label: "Wickets", detail: `${career.wickets} (best ${career.best_bowling})` },
    { label: "Boundaries", detail: `${career.fours}×4, ${career.sixes}×6` },
    { label: "Milestones", detail: `${career.fifties} fifties, ${career.hundreds} hundreds, ${career.five_wicket_hauls} five-fers` },
  ];

  const strengths: AIFinding[] = [];
  const weaknesses: AIFinding[] = [];

  const avg = Number(career.average);
  const sr = Number(career.strike_rate);
  const econ = Number(career.economy);
  const bAvg = Number(career.bowling_average);

  if (avg >= 30) strengths.push({ label: "Consistent batting", detail: `Career average ${avg.toFixed(2)}.` });
  if (sr >= 130) strengths.push({ label: "Strong strike rate", detail: `SR ${sr.toFixed(1)}.` });
  if (career.hundreds > 0) strengths.push({ label: "Century maker", detail: `${career.hundreds} hundred(s).` });
  if (career.wickets >= 10 && econ > 0 && econ <= 6) strengths.push({ label: "Economical bowler", detail: `Economy ${econ.toFixed(2)}.` });
  if (career.five_wicket_hauls > 0) strengths.push({ label: "Match-winning spells", detail: `${career.five_wicket_hauls} five-wicket haul(s).` });
  if (career.captain_matches >= 3) {
    const winRate = career.captain_matches ? (career.captain_wins / career.captain_matches) * 100 : 0;
    if (winRate >= 60) strengths.push({ label: "Excellent captaincy record", detail: `${winRate.toFixed(0)}% wins as captain.` });
    else if (winRate < 40) weaknesses.push({ label: "Captaincy win-rate low", detail: `${winRate.toFixed(0)}% wins.` });
  }
  if (career.player_of_match >= 2) strengths.push({ label: "Match-winner", detail: `${career.player_of_match} POM awards.` });

  if (career.innings >= 5 && avg > 0 && avg < 15) weaknesses.push({ label: "Batting average low", detail: `Avg ${avg.toFixed(2)}.` });
  if (career.balls_bowled > 30 && econ >= 9) weaknesses.push({ label: "High economy", detail: `Economy ${econ.toFixed(2)}.` });
  if (career.balls_bowled > 30 && bAvg > 0 && bAvg > 40) weaknesses.push({ label: "Bowling average high", detail: `Bowling avg ${bAvg.toFixed(2)}.` });
  if (career.ducks >= 3) weaknesses.push({ label: "Duck count elevated", detail: `${career.ducks} ducks — early dismissals.` });
  const dropRate = career.matches ? career.catches / career.matches : 0;
  if (career.matches >= 5 && dropRate < 0.2) weaknesses.push({ label: "Fielding output low", detail: "Few catches per match." });

  const recommendations: AIFinding[] = [];
  if (weaknesses.some((w) => w.label.includes("economy"))) recommendations.push(RECS.deathBowling, RECS.practiceYorkers);
  if (weaknesses.some((w) => w.label.includes("Batting average"))) recommendations.push(RECS.rotateStrike, RECS.consistency);
  if (weaknesses.some((w) => w.label.includes("Duck"))) recommendations.push(RECS.spin);
  if (weaknesses.some((w) => w.label.includes("Fielding"))) recommendations.push(RECS.slipCatching, RECS.fielding);
  if (recommendations.length === 0) recommendations.push(RECS.fitness, RECS.consistency);

  const summary = `${name}: ${career.matches} matches, ${career.runs} runs @ ${avg.toFixed(2)}, ${career.wickets} wickets. ${strengths[0]?.label ?? "Building profile."}${weaknesses[0] ? ` Area to work on: ${weaknesses[0].label.toLowerCase()}.` : ""}`;

  return {
    reportType: "player",
    referenceType: "athlete",
    referenceId: athleteProfileId,
    title: `Player Report — ${name}`,
    summary,
    keyFindings,
    strengths,
    weaknesses,
    recommendations,
    metadata: { name, career },
  };
}

export async function generateAndSavePlayerReport(
  tenantId: string,
  athleteProfileId: string,
): Promise<MCAIReport> {
  const payload = await generatePlayerReport(tenantId, athleteProfileId);
  return persistReport(tenantId, payload);
}

/* ================================================================
 * TEAM REPORT
 * ================================================================ */

export async function generateTeamReport(
  tenantId: string,
  teamId: string,
): Promise<AIReportPayload> {
  const { data: team } = await supabase
    .from("mc_teams")
    .select("id, name")
    .eq("id", teamId)
    .maybeSingle();
  const teamName = team?.name ?? "Team";

  const teamRecords = await computeTeamRecords(tenantId);
  const row = teamRecords.rows.find((r) => r.teamId === teamId);

  const keyFindings: AIFinding[] = row
    ? [
        { label: "Matches", detail: String(row.matches) },
        { label: "Won", detail: String(row.wins) },
        { label: "Lost", detail: String(row.losses) },
        { label: "Win rate", detail: `${Number(row.winPct).toFixed(1)}%` },
        { label: "Highest team score", detail: row.highestScore ? String(row.highestScore) : "—" },
      ]
    : [{ label: "No finalized matches yet" }];

  const strengths: AIFinding[] = [];
  const weaknesses: AIFinding[] = [];
  if (row) {
    if (row.winPct >= 60) strengths.push({ label: "Strong win-rate", detail: `${row.winPct.toFixed(0)}% wins.` });
    if (row.highestScore && row.highestScore >= 150) strengths.push({ label: "Batting depth", detail: `High score ${row.highestScore}.` });
    if (row.winPct < 40 && row.matches >= 3) weaknesses.push({ label: "Win-rate below par", detail: `${row.winPct.toFixed(0)}%.` });
    if (row.matches >= 3 && (!row.highestScore || row.highestScore < 100)) weaknesses.push({ label: "Batting totals low", detail: "Struggle to post competitive totals." });
  }

  const recommendations: AIFinding[] = [];
  if (weaknesses.some((w) => w.label.includes("Batting"))) recommendations.push(RECS.rotateStrike, RECS.consistency);
  if (weaknesses.some((w) => w.label.includes("Win-rate"))) recommendations.push(RECS.captaincy, RECS.deathBowling);
  if (recommendations.length === 0) recommendations.push(RECS.fitness, RECS.fielding);

  const summary = row
    ? `${teamName}: ${row.wins}W-${row.losses}L in ${row.matches} matches (${row.winPct.toFixed(0)}% wins).`
    : `${teamName}: no finalized matches yet.`;

  return {
    reportType: "team",
    referenceType: "team",
    referenceId: teamId,
    title: `Team Report — ${teamName}`,
    summary,
    keyFindings,
    strengths,
    weaknesses,
    recommendations,
    metadata: { teamName, row },
  };
}

export async function generateAndSaveTeamReport(
  tenantId: string,
  teamId: string,
): Promise<MCAIReport> {
  const payload = await generateTeamReport(tenantId, teamId);
  return persistReport(tenantId, payload);
}

/* ================================================================
 * CAPTAIN REPORT
 * ================================================================ */

export async function generateCaptainReport(
  tenantId: string,
  athleteProfileId: string,
): Promise<AIReportPayload> {
  const capRows = await computeCaptainRecords(tenantId);
  const row = capRows.find((r) => r.athleteId === athleteProfileId);
  const name = row?.name ?? "Captain";

  const keyFindings: AIFinding[] = row
    ? [
        { label: "Matches led", detail: String(row.matches) },
        { label: "Wins", detail: String(row.wins) },
        { label: "Losses", detail: String(row.losses) },
        { label: "Win %", detail: `${Number(row.winPct).toFixed(1)}%` },
      ]
    : [{ label: "No captaincy record yet" }];

  const strengths: AIFinding[] = [];
  const weaknesses: AIFinding[] = [];
  if (row) {
    if (row.winPct >= 60) strengths.push({ label: "Excellent leadership", detail: `${row.winPct.toFixed(0)}% wins.` });
    if (row.wins >= 5) strengths.push({ label: "Proven match-winner", detail: `${row.wins} wins as captain.` });
    if (row.winPct < 40 && row.matches >= 3) weaknesses.push({ label: "Win-rate below par" });
  }

  const recommendations: AIFinding[] = [RECS.captaincy];
  if (weaknesses.length) recommendations.push(RECS.consistency);

  return {
    reportType: "captain",
    referenceType: "athlete",
    referenceId: athleteProfileId,
    title: `Captain Report — ${name}`,
    summary: row
      ? `${name}: ${row.wins}W-${row.losses}L in ${row.matches} matches led (${row.winPct.toFixed(0)}%).`
      : `${name}: no captaincy record yet.`,
    keyFindings,
    strengths,
    weaknesses,
    recommendations,
    metadata: { row },
  };
}

/* ================================================================
 * TOURNAMENT REPORT
 * ================================================================ */

export async function generateTournamentReport(
  tenantId: string,
  tournamentId: string,
): Promise<AIReportPayload> {
  const { data: tournament } = await supabase
    .from("mc_tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  const tName = tournament?.name ?? "Tournament";

  const [standings, orange, purple, records] = await Promise.all([
    computeStandings(tournamentId),
    computeOrangeCap(tournamentId, 5),
    computePurpleCap(tournamentId, 5),
    computeTournamentRecords(tournamentId),
  ]);

  const keyFindings: AIFinding[] = [];
  if (standings[0]) keyFindings.push({ label: "Leader", detail: `${standings[0].teamName} — ${standings[0].points} pts` });
  if (orange[0]) keyFindings.push({ label: "Orange Cap", detail: `${orange[0].name} — ${orange[0].runs} runs` });
  if (purple[0]) keyFindings.push({ label: "Purple Cap", detail: `${purple[0].name} — ${purple[0].wickets} wickets` });
  if (records.highestTeamScore) keyFindings.push({ label: "Highest team score", detail: `${records.highestTeamScore.teamName} — ${records.highestTeamScore.runs}` });
  if (records.highestIndividualScore) keyFindings.push({ label: "Highest individual", detail: `${records.highestIndividualScore.name} — ${records.highestIndividualScore.runs}` });

  const strengths: AIFinding[] = standings.slice(0, 3).map((s) => ({
    label: `${s.teamName} — top form`,
    detail: `${s.wins}W-${s.losses}L, NRR ${s.nrr.toFixed(2)}`,
  }));
  const weaknesses: AIFinding[] = standings
    .slice(-2)
    .filter((s) => s.matches >= 2)
    .map((s) => ({ label: `${s.teamName} — struggling`, detail: `${s.wins}W-${s.losses}L` }));

  return {
    reportType: "tournament",
    referenceType: "tournament",
    referenceId: tournamentId,
    title: `Tournament Report — ${tName}`,
    summary: standings[0]
      ? `${tName}: ${standings[0].teamName} leading on ${standings[0].points} pts. Orange Cap ${orange[0]?.name ?? "TBD"}, Purple Cap ${purple[0]?.name ?? "TBD"}.`
      : `${tName}: no finalized matches yet.`,
    keyFindings,
    strengths,
    weaknesses,
    recommendations: [RECS.consistency, RECS.fitness],
    metadata: { standings, orange, purple, records },
  };
}

export async function generateAndSaveTournamentReport(
  tenantId: string,
  tournamentId: string,
): Promise<MCAIReport> {
  const payload = await generateTournamentReport(tenantId, tournamentId);
  return persistReport(tenantId, payload);
}

/* ================================================================
 * ACADEMY MONTHLY / SEASON REPORT
 * ================================================================ */

export async function generateAcademyMonthlyReport(
  tenantId: string,
  periodLabel?: string,
): Promise<AIReportPayload> {
  const now = new Date();
  const label = periodLabel ?? `${now.toLocaleString("en", { month: "long" })} ${now.getFullYear()}`;

  const [overview, topRuns, topWickets, topCareer] = await Promise.all([
    computeAcademyOverview(tenantId),
    leaderboardMostRuns(tenantId, 5),
    leaderboardMostWickets(tenantId, 5),
    leaderboardCareer(tenantId, 5),
  ]);

  const keyFindings: AIFinding[] = [
    { label: "Matches finalized", detail: String(overview.totals.matches) },
    { label: "Players tracked", detail: String(overview.totals.players) },
    { label: "Runs scored", detail: String(overview.totals.runs) },
    { label: "Wickets taken", detail: String(overview.totals.wickets) },
  ];
  if (topRuns[0]) keyFindings.push({ label: "Top run scorer", detail: `${topRuns[0].name} — ${topRuns[0].value} runs` });
  if (topWickets[0]) keyFindings.push({ label: "Top wicket taker", detail: `${topWickets[0].name} — ${topWickets[0].value} wickets` });

  const strengths: AIFinding[] = topCareer.slice(0, 3).map((r) => ({
    label: `${r.name} — all-round contributor`,
    detail: r.subtitle ?? undefined,
  }));

  return {
    reportType: "academy_monthly",
    referenceType: "academy",
    referenceId: tenantId,
    title: `Academy Report — ${label}`,
    summary: `${overview.totals.matches} matches, ${overview.totals.runs} runs, ${overview.totals.wickets} wickets across ${overview.totals.players} tracked players.`,
    keyFindings,
    strengths,
    weaknesses: [],
    recommendations: [RECS.fitness, RECS.consistency, RECS.fielding],
    metadata: { period: label, overview, topRuns, topWickets },
  };
}

export async function generateAndSaveAcademyMonthly(
  tenantId: string,
  periodLabel?: string,
): Promise<MCAIReport> {
  const payload = await generateAcademyMonthlyReport(tenantId, periodLabel);
  return persistReport(tenantId, payload);
}

/* ================================================================
 * Match finalization hook
 * ================================================================ */

export async function processMatchAI(matchId: string): Promise<{
  generated: number;
  reportId: string | null;
}> {
  const { data: match, error } = await supabase
    .from("mc_matches")
    .select("id, tenant_id, tournament_id")
    .eq("id", matchId)
    .single();
  if (error) throw error;
  const tenantId = match.tenant_id;

  const settings = await getAISettings(tenantId).catch(() => null);
  if (settings && !settings.auto_generate_match_reports) {
    return { generated: 0, reportId: null };
  }

  const rep = await generateAndSaveMatchReport(tenantId, matchId);
  // Fire-and-forget tournament refresh (also cheap).
  if (match.tournament_id && (!settings || settings.auto_generate_tournament_reports)) {
    generateAndSaveTournamentReport(tenantId, match.tournament_id).catch(() => {});
  }
  return { generated: 1, reportId: rep.id };
}
