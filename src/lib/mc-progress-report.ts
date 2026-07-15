/* ================================================================
 * Player Progress Report data layer.
 * ----------------------------------------------------------------
 * Pure aggregator on top of existing engines:
 *   - Career/Statistics: mc_player_careers via getChildSummary()
 *   - Recognition: mc_recognitions / mc_hall_of_fame / mc_athlete_awards
 *   - AI Insights: mc_ai_reports
 *   - Attendance: attendance_marks + attendance_sessions
 *   - Coach Remarks: mc_coach_remarks (new, RLS-gated to linked parents)
 *
 * No cricket math lives here. Attendance is counted, not scored.
 * The AI summary is deterministic and template-driven — no LLM.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceMonth {
  key: string; // "2026-07"
  label: string; // "Jul 2026"
  present: number;
  absent: number;
  late: number;
  total: number;
  percent: number; // present+late as % of total sessions
}

export interface AttendanceReport {
  current: AttendanceMonth;
  previous: AttendanceMonth;
  trend: { label: string; value: number }[]; // last 6 months, % present
  totalSessions: number;
}

export interface CoachRemark {
  id: string;
  remark: string;
  author_name: string | null;
  created_at: string;
}

export interface HallOfFameEntry {
  id: string;
  category: string;
  achievement_title: string;
  achievement_description: string | null;
  image_url: string | null;
  awarded_at: string | null;
}

export interface AthleteAward {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  event_date: string | null;
}

export interface AIReport {
  id: string;
  title: string;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generated_at: string | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Attendance for the last 6 months, plus current/previous month breakdown. */
export async function fetchAttendanceReport(
  studentId: string,
  tenantId: string,
): Promise<AttendanceReport> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const rangeStartIso = rangeStart.toISOString().slice(0, 10);

  // One join query, capped at 1000 rows (plenty for 6 months of training).
  const { data, error } = await supabase
    .from("attendance_marks")
    .select("status, session:attendance_sessions!inner(session_date)")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .gte("session.session_date", rangeStartIso)
    .limit(1000);

  if (error) throw error;

  const buckets = new Map<string, AttendanceMonth>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    buckets.set(key, {
      key,
      label: monthLabel(d),
      present: 0,
      absent: 0,
      late: 0,
      total: 0,
      percent: 0,
    });
  }

  type Row = {
    status: string | null;
    session: { session_date: string | null } | { session_date: string | null }[] | null;
  };

  for (const row of (data ?? []) as Row[]) {
    const session = Array.isArray(row.session) ? row.session[0] : row.session;
    const date = session?.session_date;
    if (!date) continue;
    const key = date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (row.status === "present") bucket.present += 1;
    else if (row.status === "late") bucket.late += 1;
    else if (row.status === "absent") bucket.absent += 1;
  }

  for (const b of buckets.values()) {
    b.percent = b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 100) : 0;
  }

  const ordered = Array.from(buckets.values());
  const current = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2] ?? current;
  const totalSessions = ordered.reduce((sum, b) => sum + b.total, 0);
  return {
    current,
    previous,
    trend: ordered.map((b) => ({ label: b.label, value: b.percent })),
    totalSessions,
  };
}

export async function fetchCoachRemarks(studentId: string): Promise<CoachRemark[]> {
  const { data, error } = await supabase
    .from("mc_coach_remarks")
    .select("id, remark, author_name, created_at, visible_to_parents")
    .eq("student_id", studentId)
    .eq("visible_to_parents", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    remark: r.remark,
    author_name: r.author_name,
    created_at: r.created_at,
  }));
}

export async function fetchHallOfFame(
  tenantId: string,
  athleteProfileId: string | null,
): Promise<HallOfFameEntry[]> {
  if (!athleteProfileId) return [];
  const { data, error } = await supabase
    .from("mc_hall_of_fame")
    .select("id, category, achievement_title, achievement_description, image_url, awarded_at")
    .eq("tenant_id", tenantId)
    .eq("athlete_profile_id", athleteProfileId)
    .order("awarded_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as HallOfFameEntry[];
}

export async function fetchAthleteAwards(athleteProfileId: string | null): Promise<AthleteAward[]> {
  if (!athleteProfileId) return [];
  const { data, error } = await supabase
    .from("mc_athlete_awards")
    .select("id, kind, title, description, event_date")
    .eq("athlete_profile_id", athleteProfileId)
    .order("event_date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AthleteAward[];
}

export async function fetchLatestAIReport(
  athleteProfileId: string | null,
): Promise<AIReport | null> {
  if (!athleteProfileId) return null;
  const { data, error } = await supabase
    .from("mc_ai_reports")
    .select("id, title, summary, strengths, weaknesses, recommendations, generated_at")
    .eq("reference_type", "athlete")
    .eq("reference_id", athleteProfileId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    id: data.id,
    title: data.title,
    summary: data.summary,
    strengths: arr(data.strengths),
    weaknesses: arr(data.weaknesses),
    recommendations: arr(data.recommendations),
    generated_at: data.generated_at,
  };
}

/* ---------------- Deterministic parent-friendly summary ---------------- */

export interface DeterministicSummaryInput {
  studentName: string;
  attendance: AttendanceReport;
  career: {
    matches?: number;
    runs?: number;
    wickets?: number;
    average?: number | null;
    strike_rate?: number | null;
    highest_score?: number | null;
    catches?: number;
  };
  ai?: AIReport | null;
}

/**
 * Produce a warm, parent-friendly paragraph purely from data.
 * Deterministic — same inputs always yield the same paragraph.
 */
export function buildParentSummary(input: DeterministicSummaryInput): string {
  const { studentName, attendance, career, ai } = input;
  const first = studentName.split(" ")[0];
  const cur = attendance.current;
  const prev = attendance.previous;
  const parts: string[] = [];

  if (cur.total > 0) {
    let phrase = `This month ${first} attended ${cur.percent}% of training sessions`;
    const diff = cur.percent - prev.percent;
    if (prev.total > 0 && Math.abs(diff) >= 5) {
      phrase +=
        diff > 0
          ? ` — up ${diff} points from last month`
          : ` — down ${Math.abs(diff)} points from last month`;
    }
    parts.push(phrase + ".");
  } else {
    parts.push(`No training sessions logged for ${first} this month yet.`);
  }

  const matches = career.matches ?? 0;
  if (matches > 0) {
    const bits: string[] = [];
    if ((career.runs ?? 0) > 0) bits.push(`${career.runs} career runs`);
    if ((career.wickets ?? 0) > 0) bits.push(`${career.wickets} wickets`);
    if ((career.catches ?? 0) > 0) bits.push(`${career.catches} catches`);
    if (bits.length) {
      parts.push(
        `Across ${matches} match${matches === 1 ? "" : "es"}, ${first} has recorded ${bits.join(", ")}.`,
      );
    }
    if (career.average != null && career.average > 0) {
      parts.push(
        `Batting average is ${Number(career.average).toFixed(1)} with a strike rate of ${Number(career.strike_rate ?? 0).toFixed(0)}.`,
      );
    }
  }

  const rec = ai?.recommendations?.[0];
  if (rec) parts.push(`Coach's focus area: ${rec}`);
  else if (cur.percent >= 90 && matches > 0)
    parts.push(
      `Keep encouraging consistent attendance — it is clearly translating into on-field performance.`,
    );
  else if (cur.percent < 70 && cur.total > 0)
    parts.push(
      `Improving attendance in the coming weeks will help ${first} develop match-readiness.`,
    );

  return parts.join(" ");
}
