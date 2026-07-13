/* ================================================================
 * Recognition Engine
 * ----------------------------------------------------------------
 * READS from Statistics / Career / Tournament / Academy Records
 * engines and DECIDES who deserves recognition.
 *
 * Contract:
 *   - NEVER computes cricket statistics.
 *   - Only reads pre-computed engine outputs.
 *   - Writes to `mc_recognitions` and `mc_academy_timeline`.
 *   - Suggestions default to `status = 'suggested'` — coach approves.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listMatchBallEvents } from "@/lib/mc-ball-events";
import { suggestPlayerOfMatch } from "@/lib/mc-finalization";
import { analyzeMatchInsights } from "@/lib/mc-academy-records";

export type MCRecognition =
  Database["public"]["Tables"]["mc_recognitions"]["Row"];
export type MCCertificateTemplate =
  Database["public"]["Tables"]["mc_certificate_templates"]["Row"];
export type MCAcademyTimelineRow =
  Database["public"]["Tables"]["mc_academy_timeline"]["Row"];

export type RecognitionType =
  | "player_of_match"
  | "player_of_week"
  | "player_of_month"
  | "player_of_year"
  | "best_batter"
  | "best_bowler"
  | "best_allrounder"
  | "best_fielder"
  | "best_captain"
  | "best_team"
  | "emerging_player"
  | "most_improved"
  | "fair_play"
  | "highest_partnership"
  | "highest_score"
  | "five_wicket_haul"
  | "century_club"
  | "half_century_club"
  | "perfect_attendance"
  | "coach_recognition"
  | "lifetime_achievement"
  | "tournament_winner"
  | "custom";

export type RecognitionStatus =
  | "suggested"
  | "approved"
  | "published"
  | "rejected";

export const RECOGNITION_BADGES: Record<string, string> = {
  century_club: "🏏 Century Club",
  half_century_club: "🎯 Half Century",
  five_wicket_haul: "🔥 Five Wicket Haul",
  best_captain: "👑 Captain",
  player_of_match: "⭐ POM",
  player_of_month: "⭐ Player of the Month",
  player_of_year: "🏆 Player of the Year",
  tournament_winner: "🏆 Champion",
  best_batter: "🎯 Top Scorer",
  lifetime_achievement: "🏅 Hall of Fame",
  fair_play: "🤝 Fair Play",
  emerging_player: "🌟 Emerging Player",
};

/* ================================================================
 * Types
 * ================================================================ */

export interface RecognitionSuggestion {
  tenant_id: string;
  recognition_type: RecognitionType;
  title: string;
  description: string;
  athlete_profile_id: string | null;
  team_id?: string | null;
  match_id?: string | null;
  tournament_id?: string | null;
  badge?: string | null;
  period?: string | null;
  status: RecognitionStatus;
  metadata?: Record<string, unknown>;
}

/* ================================================================
 * MATCH-LEVEL AUTO SUGGESTIONS
 *  - Reads Statistics Engine (via analyzeMatchInsights)
 *  - Reads finalization heuristics (POM suggestion)
 *  - Emits `mc_recognitions` rows in `suggested` state
 * ================================================================ */

export async function generateMatchRecognitions(
  matchId: string,
): Promise<RecognitionSuggestion[]> {
  const { data: match, error } = await supabase
    .from("mc_matches")
    .select("id, tenant_id, tournament_id, match_locked")
    .eq("id", matchId)
    .single();
  if (error || !match) throw error ?? new Error("Match not found");
  if (!match.match_locked) return [];

  const tenantId = match.tenant_id;
  const events = await listMatchBallEvents(matchId);
  const insights = await analyzeMatchInsights(matchId);

  const suggestions: RecognitionSuggestion[] = [];

  // ---- Player of the Match (delegated to finalization heuristic) ----
  const pom = suggestPlayerOfMatch(events);
  if (pom && pom.athleteId) {
    suggestions.push({
      tenant_id: tenantId,
      recognition_type: "player_of_match",
      title: "Player of the Match",
      description: pom.reason,
      athlete_profile_id: pom.athleteId,
      match_id: matchId,
      tournament_id: match.tournament_id,
      badge: RECOGNITION_BADGES.player_of_match,
      status: "suggested",
      metadata: { category: pom.category, score: pom.score, name: pom.name },
    });
  }

  // ---- Best Batter (highest individual score in match) ----
  if (insights.highestIndividualScore) {
    const b = insights.highestIndividualScore;
    if (b.athleteId) {
      suggestions.push({
        tenant_id: tenantId,
        recognition_type: "best_batter",
        title: "Match — Best Batter",
        description: `${b.name} scored ${b.runs} (${b.balls}) — ${b.fours} × 4s, ${b.sixes} × 6s`,
        athlete_profile_id: b.athleteId,
        match_id: matchId,
        tournament_id: match.tournament_id,
        badge: RECOGNITION_BADGES.best_batter,
        status: "suggested",
        metadata: {
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          name: b.name,
        },
      });
      // Century / half-century add-on badges
      if (b.runs >= 100) {
        suggestions.push({
          tenant_id: tenantId,
          recognition_type: "century_club",
          title: "Century",
          description: `${b.name} — ${b.runs} runs`,
          athlete_profile_id: b.athleteId,
          match_id: matchId,
          tournament_id: match.tournament_id,
          badge: RECOGNITION_BADGES.century_club,
          status: "suggested",
          metadata: { runs: b.runs, name: b.name },
        });
      } else if (b.runs >= 50) {
        suggestions.push({
          tenant_id: tenantId,
          recognition_type: "half_century_club",
          title: "Half Century",
          description: `${b.name} — ${b.runs} runs`,
          athlete_profile_id: b.athleteId,
          match_id: matchId,
          tournament_id: match.tournament_id,
          badge: RECOGNITION_BADGES.half_century_club,
          status: "suggested",
          metadata: { runs: b.runs, name: b.name },
        });
      }
    }
  }

  // ---- Best Bowler (best figures) ----
  if (insights.bestBowling) {
    const bw = insights.bestBowling;
    if (bw.athleteId) {
      suggestions.push({
        tenant_id: tenantId,
        recognition_type: "best_bowler",
        title: "Match — Best Bowler",
        description: `${bw.name} took ${bw.wickets}/${bw.runsConceded} in ${bw.overs} overs`,
        athlete_profile_id: bw.athleteId,
        match_id: matchId,
        tournament_id: match.tournament_id,
        badge: RECOGNITION_BADGES.best_bowler,
        status: "suggested",
        metadata: {
          wickets: bw.wickets,
          runsConceded: bw.runsConceded,
          overs: bw.overs,
          name: bw.name,
        },
      });
      if (bw.wickets >= 5) {
        suggestions.push({
          tenant_id: tenantId,
          recognition_type: "five_wicket_haul",
          title: "Five Wicket Haul",
          description: `${bw.name} — ${bw.wickets}/${bw.runsConceded}`,
          athlete_profile_id: bw.athleteId,
          match_id: matchId,
          tournament_id: match.tournament_id,
          badge: RECOGNITION_BADGES.five_wicket_haul,
          status: "suggested",
          metadata: {
            wickets: bw.wickets,
            runsConceded: bw.runsConceded,
            name: bw.name,
          },
        });
      }
    }
  }

  // ---- Best Partnership ----
  if (insights.highestPartnership) {
    const p = insights.highestPartnership;
    suggestions.push({
      tenant_id: tenantId,
      recognition_type: "highest_partnership",
      title: "Match — Best Partnership",
      description: `${p.p1Name} & ${p.p2Name} — ${p.runs} in ${p.balls} balls`,
      athlete_profile_id: p.p1AthleteId,
      match_id: matchId,
      tournament_id: match.tournament_id,
      badge: null,
      status: "suggested",
      metadata: {
        p1: p.p1Name,
        p2: p.p2Name,
        p2AthleteId: p.p2AthleteId,
        runs: p.runs,
        balls: p.balls,
      },
    });
  }

  return suggestions;
}

/**
 * Persist a batch of suggestions, deduping against existing suggestions
 * for the same (match, recognition_type, athlete).
 */
export async function persistSuggestions(
  suggestions: RecognitionSuggestion[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const s of suggestions) {
    // Dedupe
    const { data: existing } = await supabase
      .from("mc_recognitions")
      .select("id")
      .eq("tenant_id", s.tenant_id)
      .eq("recognition_type", s.recognition_type)
      .eq("match_id", s.match_id ?? "")
      .eq("athlete_profile_id", s.athlete_profile_id ?? "")
      .limit(1);
    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("mc_recognitions").insert({
      tenant_id: s.tenant_id,
      recognition_type: s.recognition_type,
      title: s.title,
      description: s.description,
      athlete_profile_id: s.athlete_profile_id,
      team_id: s.team_id ?? null,
      match_id: s.match_id ?? null,
      tournament_id: s.tournament_id ?? null,
      badge: s.badge ?? null,
      period: s.period ?? null,
      status: s.status,
      metadata: (s.metadata ?? {}) as never,
    });
    if (!error) inserted++;
  }

  return { inserted, skipped };
}

/**
 * Full pipeline for a finalized match: suggest + persist + timeline.
 * Target: <300ms for a typical innings.
 */
export async function processMatchRecognitions(
  matchId: string,
): Promise<{ inserted: number; skipped: number; suggestions: RecognitionSuggestion[] }> {
  const suggestions = await generateMatchRecognitions(matchId);
  const { inserted, skipped } = await persistSuggestions(suggestions);
  return { inserted, skipped, suggestions };
}

/* ================================================================
 * MONTHLY RECOGNITION
 *  - Reads Career cache only. No cricket math.
 * ================================================================ */

interface CareerRow {
  athlete_profile_id: string;
  runs: number;
  wickets: number;
  matches: number;
  captain_matches: number;
  captain_wins: number;
  mc_athlete_profiles?: { students?: { name?: string } | null } | null;
}

async function fetchTenantCareers(tenantId: string): Promise<CareerRow[]> {
  const { data, error } = await supabase
    .from("mc_player_careers")
    .select("*, mc_athlete_profiles(id, students(name))")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as unknown as CareerRow[];
}

function nameFrom(c: CareerRow): string {
  return c.mc_athlete_profiles?.students?.name ?? "Player";
}

export async function generateMonthlyRecognitions(
  tenantId: string,
  period: string, // e.g. "2026-07"
): Promise<RecognitionSuggestion[]> {
  const careers = await fetchTenantCareers(tenantId);
  const out: RecognitionSuggestion[] = [];

  const topRuns = [...careers]
    .filter((c) => c.runs > 0)
    .sort((a, b) => b.runs - a.runs)[0];
  const topWkts = [...careers]
    .filter((c) => c.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets)[0];
  const topCap = [...careers]
    .filter((c) => c.captain_matches >= 3)
    .sort(
      (a, b) =>
        b.captain_wins / Math.max(b.captain_matches, 1) -
        a.captain_wins / Math.max(a.captain_matches, 1),
    )[0];

  if (topRuns) {
    out.push({
      tenant_id: tenantId,
      recognition_type: "best_batter",
      title: `Top Run Scorer — ${period}`,
      description: `${nameFrom(topRuns)} with ${topRuns.runs} career runs`,
      athlete_profile_id: topRuns.athlete_profile_id,
      badge: RECOGNITION_BADGES.best_batter,
      period,
      status: "suggested",
      metadata: { runs: topRuns.runs, name: nameFrom(topRuns) },
    });
    out.push({
      tenant_id: tenantId,
      recognition_type: "player_of_month",
      title: `Player of the Month — ${period}`,
      description: `${nameFrom(topRuns)} led all batting`,
      athlete_profile_id: topRuns.athlete_profile_id,
      badge: RECOGNITION_BADGES.player_of_month,
      period,
      status: "suggested",
      metadata: { name: nameFrom(topRuns) },
    });
  }
  if (topWkts) {
    out.push({
      tenant_id: tenantId,
      recognition_type: "best_bowler",
      title: `Top Wicket Taker — ${period}`,
      description: `${nameFrom(topWkts)} with ${topWkts.wickets} career wickets`,
      athlete_profile_id: topWkts.athlete_profile_id,
      badge: RECOGNITION_BADGES.best_bowler,
      period,
      status: "suggested",
      metadata: { wickets: topWkts.wickets, name: nameFrom(topWkts) },
    });
  }
  if (topCap) {
    const winPct = +((topCap.captain_wins / topCap.captain_matches) * 100).toFixed(1);
    out.push({
      tenant_id: tenantId,
      recognition_type: "best_captain",
      title: `Best Captain — ${period}`,
      description: `${nameFrom(topCap)} — ${winPct}% wins across ${topCap.captain_matches} matches`,
      athlete_profile_id: topCap.athlete_profile_id,
      badge: RECOGNITION_BADGES.best_captain,
      period,
      status: "suggested",
      metadata: { winPct, matches: topCap.captain_matches },
    });
  }

  return out;
}

export async function processMonthlyRecognitions(
  tenantId: string,
  period: string,
): Promise<{ inserted: number; skipped: number }> {
  const s = await generateMonthlyRecognitions(tenantId, period);
  return persistSuggestions(s);
}

/* ================================================================
 * YEARLY RECOGNITION
 * ================================================================ */

export async function generateYearlyRecognitions(
  tenantId: string,
  period: string, // "2026"
): Promise<RecognitionSuggestion[]> {
  const careers = await fetchTenantCareers(tenantId);
  const out: RecognitionSuggestion[] = [];

  const topRuns = [...careers].sort((a, b) => b.runs - a.runs)[0];
  const topWkts = [...careers].sort((a, b) => b.wickets - a.wickets)[0];

  if (topRuns) {
    out.push({
      tenant_id: tenantId,
      recognition_type: "player_of_year",
      title: `Player of the Year — ${period}`,
      description: `${nameFrom(topRuns)} led the academy in career runs`,
      athlete_profile_id: topRuns.athlete_profile_id,
      badge: RECOGNITION_BADGES.player_of_year,
      period,
      status: "suggested",
      metadata: { runs: topRuns.runs, name: nameFrom(topRuns) },
    });
    out.push({
      tenant_id: tenantId,
      recognition_type: "best_batter",
      title: `Best Batter — ${period}`,
      description: `${nameFrom(topRuns)} — ${topRuns.runs} career runs`,
      athlete_profile_id: topRuns.athlete_profile_id,
      badge: RECOGNITION_BADGES.best_batter,
      period,
      status: "suggested",
    });
  }
  if (topWkts) {
    out.push({
      tenant_id: tenantId,
      recognition_type: "best_bowler",
      title: `Best Bowler — ${period}`,
      description: `${nameFrom(topWkts)} — ${topWkts.wickets} career wickets`,
      athlete_profile_id: topWkts.athlete_profile_id,
      badge: RECOGNITION_BADGES.best_bowler,
      period,
      status: "suggested",
    });
  }
  // Hall of Fame candidate — highest combined career output
  const hofCandidate = [...careers].sort(
    (a, b) => b.runs + b.wickets * 20 - (a.runs + a.wickets * 20),
  )[0];
  if (hofCandidate) {
    out.push({
      tenant_id: tenantId,
      recognition_type: "lifetime_achievement",
      title: `Hall of Fame candidate — ${period}`,
      description: `${nameFrom(hofCandidate)} — ${hofCandidate.runs} runs, ${hofCandidate.wickets} wkts`,
      athlete_profile_id: hofCandidate.athlete_profile_id,
      badge: RECOGNITION_BADGES.lifetime_achievement,
      period,
      status: "suggested",
    });
  }

  return out;
}

export async function processYearlyRecognitions(
  tenantId: string,
  period: string,
): Promise<{ inserted: number; skipped: number }> {
  const s = await generateYearlyRecognitions(tenantId, period);
  return persistSuggestions(s);
}

/* ================================================================
 * Approval workflow
 * ================================================================ */

export async function approveRecognition(
  id: string,
  actorId: string | null,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("mc_recognitions")
    .update({
      status: "approved",
      awarded_by: actorId,
      awarded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await appendAcademyTimeline({
    tenantId: row.tenant_id,
    eventType: row.recognition_type,
    title: row.title,
    description: row.description ?? undefined,
    referenceType: "recognition",
    referenceId: row.id,
  });
}

export async function publishRecognition(
  id: string,
  actorId: string | null,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("mc_recognitions")
    .update({
      status: "published",
      awarded_by: actorId,
      awarded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await appendAcademyTimeline({
    tenantId: row.tenant_id,
    eventType: row.recognition_type,
    title: row.title,
    description: row.description ?? undefined,
    referenceType: "recognition",
    referenceId: row.id,
  });
}

export async function rejectRecognition(id: string): Promise<void> {
  const { error } = await supabase
    .from("mc_recognitions")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) throw error;
}

export async function updateRecognition(
  id: string,
  patch: Partial<
    Pick<
      MCRecognition,
      "title" | "description" | "athlete_profile_id" | "badge" | "certificate_template"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("mc_recognitions")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function createCustomRecognition(input: {
  tenantId: string;
  athleteProfileId: string | null;
  title: string;
  description?: string;
  badge?: string;
  awardedBy?: string | null;
}): Promise<MCRecognition> {
  const { data, error } = await supabase
    .from("mc_recognitions")
    .insert({
      tenant_id: input.tenantId,
      recognition_type: "custom",
      title: input.title,
      description: input.description ?? null,
      athlete_profile_id: input.athleteProfileId,
      badge: input.badge ?? null,
      status: "approved",
      awarded_by: input.awardedBy ?? null,
      awarded_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  await appendAcademyTimeline({
    tenantId: input.tenantId,
    eventType: "custom",
    title: input.title,
    description: input.description,
    referenceType: "recognition",
    referenceId: data.id,
  });
  return data;
}

/* ================================================================
 * Reads
 * ================================================================ */

export async function listRecognitions(
  tenantId: string,
  filter?: { status?: RecognitionStatus; athleteId?: string; period?: string },
): Promise<Array<MCRecognition & { athleteName?: string }>> {
  let q = supabase
    .from("mc_recognitions")
    .select("*, mc_athlete_profiles(id, students(name))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.athleteId) q = q.eq("athlete_profile_id", filter.athleteId);
  if (filter?.period) q = q.eq("period", filter.period);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const ap = (r as unknown as { mc_athlete_profiles?: { students?: { name?: string } | null } | null })
      .mc_athlete_profiles;
    return { ...(r as MCRecognition), athleteName: ap?.students?.name };
  });
}

export async function listRecognitionsForAthlete(
  athleteProfileId: string,
): Promise<MCRecognition[]> {
  const { data, error } = await supabase
    .from("mc_recognitions")
    .select("*")
    .eq("athlete_profile_id", athleteProfileId)
    .in("status", ["approved", "published"])
    .order("awarded_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ================================================================
 * Certificate templates CRUD
 * ================================================================ */

export async function listCertificateTemplates(
  tenantId: string,
): Promise<MCCertificateTemplate[]> {
  const { data, error } = await supabase
    .from("mc_certificate_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCertificateTemplate(
  input: Partial<MCCertificateTemplate> & {
    tenant_id: string;
    name: string;
  },
): Promise<MCCertificateTemplate> {
  const { data, error } = await supabase
    .from("mc_certificate_templates")
    .upsert({
      id: input.id,
      tenant_id: input.tenant_id,
      name: input.name,
      template_type: input.template_type ?? "generic",
      background_image: input.background_image ?? null,
      logo: input.logo ?? null,
      primary_color: input.primary_color ?? "#0f172a",
      secondary_color: input.secondary_color ?? "#f59e0b",
      signature_name: input.signature_name ?? null,
      signature_image: input.signature_image ?? null,
      is_default: input.is_default ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCertificateTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("mc_certificate_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Pure certificate rendering helper — returns an inline SVG string
 * so it can be exported to PDF later. No side effects.
 */
export function renderCertificateSVG(input: {
  template: MCCertificateTemplate | null;
  recipientName: string;
  awardTitle: string;
  description?: string;
  issueDate: string;
  certificateNumber: string;
  academyName: string;
}): string {
  const primary = input.template?.primary_color ?? "#0f172a";
  const secondary = input.template?.secondary_color ?? "#f59e0b";
  const signatureName = input.template?.signature_name ?? "Head Coach";
  const desc = input.description ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
  <rect width="1000" height="700" fill="#fff" stroke="${primary}" stroke-width="12"/>
  <rect x="30" y="30" width="940" height="640" fill="none" stroke="${secondary}" stroke-width="3"/>
  <text x="500" y="120" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="${primary}" font-weight="bold">Certificate of Achievement</text>
  <text x="500" y="170" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${primary}">${escapeXml(input.academyName)}</text>
  <text x="500" y="270" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#555">This certificate is proudly presented to</text>
  <text x="500" y="340" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="${secondary}" font-weight="bold">${escapeXml(input.recipientName)}</text>
  <text x="500" y="400" text-anchor="middle" font-family="sans-serif" font-size="24" fill="${primary}">${escapeXml(input.awardTitle)}</text>
  <text x="500" y="440" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#555">${escapeXml(desc)}</text>
  <line x1="200" y1="580" x2="400" y2="580" stroke="${primary}" stroke-width="2"/>
  <text x="300" y="605" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${primary}">${escapeXml(signatureName)}</text>
  <line x1="600" y1="580" x2="800" y2="580" stroke="${primary}" stroke-width="2"/>
  <text x="700" y="605" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${primary}">${escapeXml(input.issueDate)}</text>
  <text x="500" y="660" text-anchor="middle" font-family="monospace" font-size="12" fill="#999">Certificate №${escapeXml(input.certificateNumber)}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ================================================================
 * Academy timeline
 * ================================================================ */

export async function appendAcademyTimeline(input: {
  tenantId: string;
  eventType: string;
  title: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("mc_academy_timeline").insert({
    tenant_id: input.tenantId,
    event_type: input.eventType,
    title: input.title,
    description: input.description ?? null,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    image_url: input.imageUrl ?? null,
    metadata: (input.metadata ?? {}) as never,
  });
  if (error) {
    // best-effort — timeline should never break the primary flow.
    // eslint-disable-next-line no-console
    console.error("appendAcademyTimeline failed", error);
  }
}

export async function listAcademyTimeline(
  tenantId: string,
  limit = 100,
): Promise<MCAcademyTimelineRow[]> {
  const { data, error } = await supabase
    .from("mc_academy_timeline")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/* ================================================================
 * Global search (recognition scope)
 * ================================================================ */

export interface RecognitionSearchHit {
  kind: "recognition" | "timeline" | "template";
  title: string;
  subtitle?: string;
  id: string;
}

export async function searchRecognitions(
  tenantId: string,
  term: string,
): Promise<RecognitionSearchHit[]> {
  const q = term.trim().toLowerCase();
  if (!q) return [];

  const [recs, timeline, templates] = await Promise.all([
    listRecognitions(tenantId),
    listAcademyTimeline(tenantId, 200),
    listCertificateTemplates(tenantId),
  ]);

  const hits: RecognitionSearchHit[] = [];
  for (const r of recs) {
    if (
      r.title.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.athleteName ?? "").toLowerCase().includes(q) ||
      r.recognition_type.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "recognition",
        title: r.title,
        subtitle: r.athleteName,
        id: r.id,
      });
    }
  }
  for (const t of timeline) {
    if (
      t.title.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q)
    ) {
      hits.push({ kind: "timeline", title: t.title, subtitle: t.description ?? undefined, id: t.id });
    }
  }
  for (const t of templates) {
    if (t.name.toLowerCase().includes(q)) {
      hits.push({ kind: "template", title: t.name, id: t.id });
    }
  }
  return hits.slice(0, 100);
}

/* ================================================================
 * Pure-function aliases
 * ================================================================ */

export const suggestMatchRecognitions = generateMatchRecognitions;
export const suggestMonthlyRecognitions = generateMonthlyRecognitions;
export const suggestYearlyRecognitions = generateYearlyRecognitions;
