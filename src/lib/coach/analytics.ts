/**
 * Coach analytics queries — RLS-scoped (coaches only see their assigned batches).
 * No new tables; aggregates existing attendance / students / mc_coach_remarks.
 */
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export const coachAnalyticsKeys = {
  root: (tenantId: string, days: number) =>
    ["coach", "analytics", tenantId, days] as const,
};

export type CoachAnalytics = {
  window_days: number;
  batches: number;
  students_active: number;
  new_admissions: number;
  sessions_held: number;
  attendance_pct: number;
  present_count: number;
  total_marks: number;
  remarks_added: number;
  trend: { date: string; present: number; total: number; pct: number }[];
  per_batch: {
    batch_id: string;
    batch_name: string;
    students: number;
    sessions: number;
    attendance_pct: number;
  }[];
};

export async function fetchCoachAnalytics(
  tenantId: string,
  batchIds: string[],
  days = 30,
): Promise<CoachAnalytics> {
  const since = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const empty: CoachAnalytics = {
    window_days: days,
    batches: batchIds.length,
    students_active: 0,
    new_admissions: 0,
    sessions_held: 0,
    attendance_pct: 0,
    present_count: 0,
    total_marks: 0,
    remarks_added: 0,
    trend: [],
    per_batch: [],
  };
  if (batchIds.length === 0) return empty;

  // Students in coach's batches
  const { data: students } = await supabase
    .from("students")
    .select("id, batch_id, status, joined_at, created_at")
    .eq("tenant_id", tenantId)
    .in("batch_id", batchIds);

  const activeStudents = (students ?? []).filter((s) => s.status === "active");
  const newAdmissions = (students ?? []).filter(
    (s) => (s.joined_at ?? s.created_at ?? "") >= since,
  ).length;

  // Sessions in window
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, batch_id, session_date")
    .eq("tenant_id", tenantId)
    .gte("session_date", since)
    .in("batch_id", batchIds);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const sessionBatch = new Map<string, string>();
  const sessionDate = new Map<string, string>();
  for (const s of sessions ?? []) {
    sessionBatch.set(s.id, s.batch_id);
    sessionDate.set(s.id, s.session_date);
  }

  // Marks
  let marks: { session_id: string; status: string }[] = [];
  if (sessionIds.length > 0) {
    const { data } = await supabase
      .from("attendance_marks")
      .select("session_id, status")
      .in("session_id", sessionIds);
    marks = (data ?? []) as typeof marks;
  }

  const isPresent = (s: string) => s === "present" || s === "late";
  const present = marks.filter((m) => isPresent(m.status)).length;
  const total = marks.length;
  const pct = total ? Math.round((present / total) * 100) : 0;

  // Trend by date
  const trendMap = new Map<string, { present: number; total: number }>();
  for (const m of marks) {
    const d = sessionDate.get(m.session_id);
    if (!d) continue;
    const t = trendMap.get(d) ?? { present: 0, total: 0 };
    t.total += 1;
    if (isPresent(m.status)) t.present += 1;
    trendMap.set(d, t);
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      present: v.present,
      total: v.total,
      pct: v.total ? Math.round((v.present / v.total) * 100) : 0,
    }));

  // Per-batch
  const perBatch = new Map<string, { students: number; sessions: number; present: number; total: number }>();
  for (const b of batchIds) perBatch.set(b, { students: 0, sessions: 0, present: 0, total: 0 });
  for (const s of activeStudents) {
    const rec = perBatch.get(s.batch_id ?? ""); if (rec) rec.students += 1;
  }
  for (const s of sessions ?? []) {
    const rec = perBatch.get(s.batch_id); if (rec) rec.sessions += 1;
  }
  for (const m of marks) {
    const bid = sessionBatch.get(m.session_id); if (!bid) continue;
    const rec = perBatch.get(bid); if (!rec) continue;
    rec.total += 1;
    if (isPresent(m.status)) rec.present += 1;
  }
  const { data: batchRows } = await supabase
    .from("batches")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", batchIds);
  const nameOf = new Map<string, string>((batchRows ?? []).map((b) => [b.id, b.name]));
  const per_batch = Array.from(perBatch.entries()).map(([batch_id, v]) => ({
    batch_id,
    batch_name: nameOf.get(batch_id) ?? "Batch",
    students: v.students,
    sessions: v.sessions,
    attendance_pct: v.total ? Math.round((v.present / v.total) * 100) : 0,
  }));

  // Remarks added by me in window
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  let remarksAdded = 0;
  if (uid) {
    const { count } = await supabase
      .from("mc_coach_remarks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("author_user_id", uid)
      .gte("created_at", since);
    remarksAdded = count ?? 0;
  }

  return {
    window_days: days,
    batches: batchIds.length,
    students_active: activeStudents.length,
    new_admissions: newAdmissions,
    sessions_held: sessions?.length ?? 0,
    attendance_pct: pct,
    present_count: present,
    total_marks: total,
    remarks_added: remarksAdded,
    trend,
    per_batch,
  };
}
