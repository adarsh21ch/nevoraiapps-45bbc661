/**
 * AcademyOS V2 — Student App data layer (Phase 02.8).
 *
 * Thin composition over the frozen Attendance, Player Profile, and
 * Match Center modules. No new business logic — just typed helpers
 * scoped to the signed-in student.
 *
 * Identity resolution: uses the `get_my_student_context()` SECURITY DEFINER
 * RPC which matches by `students.user_id = auth.uid()` OR
 * `lower(students.email) = lower(auth.email())`. All downstream reads are
 * additionally guarded by "student self read" RLS policies.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentVisits, groupVisitsByDay, type AttendanceVisit } from "@/lib/attendance/queries";
import {
  fetchAthleteByStudent,
  fetchPlayerCareer,
  fetchRecentMatches,
  fetchAllRemarks,
  type PlayerCareer,
  type PlayerMatchAppearance,
  type PlayerRemark,
} from "@/lib/player-profile";

export type StudentContext = {
  student_id: string;
  tenant_id: string;
  athlete_profile_id: string | null;
  name: string;
  player_id: string | null;
  email: string | null;
  photo_url: string | null;
};

export const studentKeys = {
  me: ["student", "me"] as const,
  home: (sid: string) => ["student", "home", sid] as const,
  progress: (sid: string) => ["student", "progress", sid] as const,
  matches: (sid: string) => ["student", "matches", sid] as const,
  profile: (sid: string) => ["student", "profile", sid] as const,
  timeline: (sid: string) => ["student", "timeline", sid] as const,
};

export async function fetchMyStudentContext(): Promise<StudentContext | null> {
  const { data, error } = await supabase.rpc("get_my_student_context");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as StudentContext | undefined) ?? null;
}

// -------------------- Home --------------------

export type StudentHome = {
  visitsThisMonth: AttendanceVisit[];
  hoursThisMonth: number;
  streakDays: number;
  todayVisit: AttendanceVisit | null;
  latestRemark: PlayerRemark | null;
  upcomingMatch: PlayerMatchAppearance | null;
  recentAchievement: { title: string; occurred_on: string | null } | null;
};

function computeStreak(visits: AttendanceVisit[]): number {
  const days = new Set(
    visits.filter((v) => v.status === "present").map((v) => v.session_date),
  );
  if (days.size === 0) return 0;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Look back up to 60 days
  for (let i = 0; i < 60; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (days.has(iso)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      // allow missing today
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function fetchStudentHome(ctx: StudentContext): Promise<StudentHome> {
  const since = new Date();
  since.setDate(1);
  const sinceIso = since.toISOString().slice(0, 10);

  const visits = await fetchStudentVisits(ctx.tenant_id, ctx.student_id, { limit: 200 });
  const monthVisits = visits.filter((v) => v.session_date >= sinceIso);
  const hoursThisMonth =
    monthVisits.reduce((s, v) => s + (v.duration_minutes ?? 0), 0) / 60;
  const today = new Date().toISOString().slice(0, 10);
  const todayVisit = visits.find((v) => v.session_date === today) ?? null;
  const streakDays = computeStreak(visits);

  const remarks = ctx.student_id ? await fetchAllRemarks(ctx.student_id) : [];
  const latestRemark = remarks[0] ?? null;

  let upcomingMatch: PlayerMatchAppearance | null = null;
  let recentAchievement: StudentHome["recentAchievement"] = null;

  if (ctx.athlete_profile_id) {
    const matches = await fetchRecentMatches(ctx.athlete_profile_id, 20);
    const now = new Date();
    upcomingMatch =
      matches.find(
        (m) =>
          m.match &&
          m.match.scheduled_date &&
          new Date(m.match.scheduled_date) >= now &&
          m.match.status !== "completed",
      ) ?? null;

    const { data: ach } = await supabase
      .from("mc_athlete_achievements")
      .select("title, occurred_on")
      .eq("athlete_profile_id", ctx.athlete_profile_id)
      .order("occurred_on", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    recentAchievement = (ach as StudentHome["recentAchievement"]) ?? null;
  }

  return {
    visitsThisMonth: monthVisits,
    hoursThisMonth,
    streakDays,
    todayVisit,
    latestRemark,
    upcomingMatch,
    recentAchievement,
  };
}

// -------------------- Progress --------------------

export type StudentProgress = {
  attendancePct: number;
  practiceHours: number;
  matchesPlayed: number;
  career: PlayerCareer | null;
  weekly: { week: string; hours: number; sessions: number }[];
  monthly: { month: string; hours: number; sessions: number }[];
  recentForm: PlayerMatchAppearance[];
};

export async function fetchStudentProgress(ctx: StudentContext): Promise<StudentProgress> {
  const visits = await fetchStudentVisits(ctx.tenant_id, ctx.student_id, { limit: 500 });
  const days = groupVisitsByDay(visits);
  const presentDays = days.length;

  // attendance pct: presentDays / distinct session_dates in marks (planned + absent)
  const allSessionDates = new Set(visits.map((v) => v.session_date));
  const attendancePct =
    allSessionDates.size > 0 ? Math.round((presentDays / allSessionDates.size) * 100) : 0;
  const practiceHours = days.reduce((s, d) => s + d.total_minutes, 0) / 60;

  const career = ctx.athlete_profile_id ? await fetchPlayerCareer(ctx.athlete_profile_id) : null;
  const recentForm = ctx.athlete_profile_id
    ? await fetchRecentMatches(ctx.athlete_profile_id, 10)
    : [];
  const matchesPlayed = career?.matches ?? recentForm.length;

  // Weekly (last 8 weeks)
  const weeklyMap = new Map<string, { hours: number; sessions: number }>();
  const monthlyMap = new Map<string, { hours: number; sessions: number }>();
  for (const d of days) {
    const dt = new Date(d.session_date);
    // ISO week key
    const year = dt.getUTCFullYear();
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const week = Math.floor(((dt.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay()) / 7);
    const wkey = `${year}-W${String(week).padStart(2, "0")}`;
    const wcur = weeklyMap.get(wkey) ?? { hours: 0, sessions: 0 };
    wcur.hours += d.total_minutes / 60;
    wcur.sessions += 1;
    weeklyMap.set(wkey, wcur);

    const mkey = `${year}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const mcur = monthlyMap.get(mkey) ?? { hours: 0, sessions: 0 };
    mcur.hours += d.total_minutes / 60;
    mcur.sessions += 1;
    monthlyMap.set(mkey, mcur);
  }
  const weekly = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([week, v]) => ({ week, ...v }));
  const monthly = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, v]) => ({ month, ...v }));

  return {
    attendancePct,
    practiceHours,
    matchesPlayed,
    career,
    weekly,
    monthly,
    recentForm,
  };
}

// -------------------- Matches --------------------

export async function fetchStudentMatches(ctx: StudentContext): Promise<{
  upcoming: PlayerMatchAppearance[];
  recent: PlayerMatchAppearance[];
  career: PlayerCareer | null;
  awards: { id: string; title: string; awarded_on: string | null }[];
}> {
  if (!ctx.athlete_profile_id) {
    return { upcoming: [], recent: [], career: null, awards: [] };
  }
  const all = await fetchRecentMatches(ctx.athlete_profile_id, 40);
  const now = new Date();
  const upcoming = all.filter(
    (m) =>
      m.match &&
      m.match.scheduled_date &&
      new Date(m.match.scheduled_date) >= now &&
      m.match.status !== "completed",
  );
  const recent = all.filter(
    (m) =>
      !m.match ||
      !m.match.scheduled_date ||
      new Date(m.match.scheduled_date) < now ||
      m.match.status === "completed",
  );
  const career = await fetchPlayerCareer(ctx.athlete_profile_id);

  const { data: awardRows } = await supabase
    .from("mc_athlete_awards")
    .select("id, title, awarded_on")
    .eq("athlete_profile_id", ctx.athlete_profile_id)
    .order("awarded_on", { ascending: false, nullsFirst: false })
    .limit(20);
  const awards = ((awardRows ?? []) as {
    id: string;
    title: string;
    awarded_on: string | null;
  }[]);

  return { upcoming, recent, career, awards };
}

// -------------------- Profile --------------------

export type StudentProfileFull = {
  student: Record<string, unknown> & { id: string };
  athlete: (Record<string, unknown> & { id: string }) | null;
  achievements: { id: string; title: string; occurred_on: string | null }[];
  awards: { id: string; title: string; awarded_on: string | null }[];
};

export async function fetchStudentProfile(ctx: StudentContext): Promise<StudentProfileFull> {
  const { data: student, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", ctx.student_id)
    .maybeSingle();
  if (error) throw error;

  const athlete = ctx.athlete_profile_id
    ? await fetchAthleteByStudent(ctx.tenant_id, ctx.student_id)
    : null;

  let achievements: StudentProfileFull["achievements"] = [];
  let awards: StudentProfileFull["awards"] = [];
  if (ctx.athlete_profile_id) {
    const [{ data: a }, { data: w }] = await Promise.all([
      supabase
        .from("mc_athlete_achievements")
        .select("id, title, occurred_on")
        .eq("athlete_profile_id", ctx.athlete_profile_id)
        .order("occurred_on", { ascending: false, nullsFirst: false }),
      supabase
        .from("mc_athlete_awards")
        .select("id, title, awarded_on")
        .eq("athlete_profile_id", ctx.athlete_profile_id)
        .order("awarded_on", { ascending: false, nullsFirst: false }),
    ]);
    achievements = (a ?? []) as StudentProfileFull["achievements"];
    awards = (w ?? []) as StudentProfileFull["awards"];
  }

  return {
    student: (student ?? { id: ctx.student_id }) as StudentProfileFull["student"],
    athlete: (athlete as StudentProfileFull["athlete"]) ?? null,
    achievements,
    awards,
  };
}
