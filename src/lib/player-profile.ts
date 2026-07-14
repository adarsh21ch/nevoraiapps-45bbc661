/**
 * AcademyOS V2 — Player Profile data layer.
 *
 * Thin composition of frozen modules (Attendance, Match Center). No new
 * business logic — just typed queries scoped to a single student/athlete.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentVisits, groupVisitsByDay, type AttendanceVisit } from "@/lib/attendance/queries";

export const playerKeys = {
  athlete: (tid: string, sid: string) => ["player", "athlete", tid, sid] as const,
  career: (aid: string) => ["player", "career", aid] as const,
  achievements: (aid: string) => ["player", "achievements", aid] as const,
  awards: (aid: string) => ["player", "awards", aid] as const,
  visits: (tid: string, sid: string) => ["player", "visits", tid, sid] as const,
  matches: (aid: string) => ["player", "matches", aid] as const,
  remarks: (sid: string) => ["player", "remarks", sid] as const,
};

export async function fetchAthleteByStudent(tenantId: string, studentId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .select("*, cricket:mc_cricket_profiles(*)")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as { cricket: unknown } & Record<string, unknown>;
  const cricket = Array.isArray(r.cricket) ? (r.cricket[0] ?? null) : (r.cricket ?? null);
  return { ...r, cricket } as Record<string, unknown> & { id: string; cricket: Record<string, unknown> | null };
}

export type PlayerCareer = {
  matches: number;
  runs: number;
  wickets: number;
  average: number | null;
  strike_rate: number | null;
  bowling_average: number | null;
  economy: number | null;
  highest_score: number | null;
  best_bowling: string | null;
  fifties: number;
  hundreds: number;
  catches: number;
  player_of_match: number;
  balls: number;
  innings: number;
  not_outs: number;
  fours: number;
  sixes: number;
};

export async function fetchPlayerCareer(athleteProfileId: string): Promise<PlayerCareer | null> {
  const { data, error } = await supabase
    .from("mc_player_careers")
    .select(
      "matches, innings, not_outs, runs, balls, wickets, average, strike_rate, bowling_average, economy, highest_score, best_bowling, fifties, hundreds, fours, sixes, catches, player_of_match",
    )
    .eq("athlete_profile_id", athleteProfileId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlayerCareer | null) ?? null;
}

export async function fetchRecentMatches(athleteProfileId: string, limit = 8) {
  // Reuse mc_match_squads → mc_matches for the player's recent appearances.
  const { data, error } = await supabase
    .from("mc_match_squads")
    .select(
      "id, batting_runs, batting_balls, wickets_taken, is_player_of_match, mc_matches!inner(id, name, match_date, status, format)",
    )
    .eq("athlete_profile_id", athleteProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type PlayerRemark = {
  id: string;
  remark: string;
  author_name: string | null;
  created_at: string;
  visible_to_parents: boolean;
};

export async function fetchAllRemarks(studentId: string): Promise<PlayerRemark[]> {
  const { data, error } = await supabase
    .from("mc_coach_remarks")
    .select("id, remark, author_name, created_at, visible_to_parents")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as PlayerRemark[];
}

export async function createRemark(input: {
  tenant_id: string;
  student_id: string;
  remark: string;
  author_name?: string | null;
  visible_to_parents?: boolean;
}) {
  const { data, error } = await supabase
    .from("mc_coach_remarks")
    .insert({ visible_to_parents: false, ...input })
    .select("id, remark, author_name, created_at, visible_to_parents")
    .single();
  if (error) throw error;
  return data as PlayerRemark;
}

export async function deleteRemark(id: string) {
  const { error } = await supabase.from("mc_coach_remarks").delete().eq("id", id);
  if (error) throw error;
}

/** Aggregate per-student attendance metrics (across all recorded history). */
export async function fetchPlayerAttendanceSummary(tenantId: string, studentId: string) {
  const visits = await fetchStudentVisits(tenantId, studentId, { limit: 500 });
  const days = groupVisitsByDay(visits);
  const totalMinutes = days.reduce((s, d) => s + d.total_minutes, 0);
  const presentDays = days.length;
  return {
    visits,
    days,
    totalMinutes,
    presentDays,
    lastVisit: visits[0] ?? null,
  };
}

export type { AttendanceVisit };
