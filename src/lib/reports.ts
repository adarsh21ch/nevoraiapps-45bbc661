// Reports aggregation layer.
// Pure read-only aggregation over existing tables — no new business logic,
// no materialization. Every function accepts a { tenantId, from, to } range
// and returns a serializable summary shape. Owner-only queries are gated at
// the route level (see dashboard.reports.tsx), not here.
import { supabase } from "@/integrations/supabase/client";

export type Range = { from: string; to: string }; // ISO
export type Preset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "quarter"
  | "year"
  | "custom";

export function presetRange(preset: Preset, custom?: Range): Range {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  let from: Date, to: Date;
  switch (preset) {
    case "today":     from = startOfDay(now); to = endOfDay(now); break;
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      from = startOfDay(y); to = endOfDay(y); break;
    }
    case "7d":  from = startOfDay(new Date(now.getTime() - 6 * 86400000));  to = endOfDay(now); break;
    case "30d": from = startOfDay(new Date(now.getTime() - 29 * 86400000)); to = endOfDay(now); break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1); to = endOfDay(now); break;
    }
    case "year": from = new Date(now.getFullYear(), 0, 1); to = endOfDay(now); break;
    case "custom":
      if (custom) return custom;
      from = startOfDay(new Date(now.getTime() - 29 * 86400000)); to = endOfDay(now); break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export const rqk = {
  attendance: (t: string, r: Range) => ["r", "att", t, r.from, r.to] as const,
  billing:    (t: string, r: Range) => ["r", "bill", t, r.from, r.to] as const,
  admissions: (t: string, r: Range) => ["r", "adm", t, r.from, r.to] as const,
  players:    (t: string, r: Range) => ["r", "ply", t, r.from, r.to] as const,
  matches:    (t: string, r: Range) => ["r", "mch", t, r.from, r.to] as const,
  comms:      (t: string, r: Range) => ["r", "cmm", t, r.from, r.to] as const,
  website:    (t: string, r: Range) => ["r", "web", t, r.from, r.to] as const,
};

// ---------------- Attendance ---------------------------------------------
export type AttendanceReport = {
  totalMarks: number;
  present: number;
  absent: number;
  late: number;
  percent: number;
  sessions: number;
  daily: { date: string; present: number; absent: number; percent: number }[];
  perBatch: { batch: string; present: number; total: number; percent: number }[];
  topStudents: { name: string; percent: number; present: number; total: number }[];
  lowStudents: { name: string; percent: number; present: number; total: number }[];
};

export async function fetchAttendanceReport(tenantId: string, r: Range): Promise<AttendanceReport> {
  const fromDate = r.from.slice(0, 10);
  const toDate = r.to.slice(0, 10);
  const [sess, marks] = await Promise.all([
    supabase.from("attendance_sessions")
      .select("id, session_date, batch_id, batches(name)")
      .eq("tenant_id", tenantId)
      .gte("session_date", fromDate)
      .lte("session_date", toDate),
    supabase.from("attendance_marks")
      .select("id, status, session_id, student_id, students(name)")
      .eq("tenant_id", tenantId)
      .is("superseded_by", null)
      .gte("created_at", r.from)
      .lte("created_at", r.to),
  ]);

  const sessions = sess.data ?? [];
  const sessionMap = new Map(sessions.map((s: any) => [s.id, s]));
  const mm = marks.data ?? [];

  let present = 0, absent = 0, late = 0;
  const perDay = new Map<string, { p: number; a: number }>();
  const perBatchMap = new Map<string, { p: number; t: number }>();
  const perStudent = new Map<string, { name: string; p: number; t: number }>();

  for (const m of mm as any[]) {
    const sess = sessionMap.get(m.session_id) as any;
    const day = sess?.session_date ?? "";
    const batch = sess?.batches?.name ?? "Unassigned";
    const isPresent = m.status === "present" || m.status === "late";
    if (m.status === "present") present++;
    else if (m.status === "late") { present++; late++; }
    else if (m.status === "absent") absent++;

    const d = perDay.get(day) ?? { p: 0, a: 0 };
    if (isPresent) d.p++; else if (m.status === "absent") d.a++;
    perDay.set(day, d);

    const b = perBatchMap.get(batch) ?? { p: 0, t: 0 };
    if (isPresent || m.status === "absent") { b.t++; if (isPresent) b.p++; }
    perBatchMap.set(batch, b);

    const sname = m.students?.name ?? "—";
    const st = perStudent.get(m.student_id) ?? { name: sname, p: 0, t: 0 };
    if (isPresent || m.status === "absent") { st.t++; if (isPresent) st.p++; }
    perStudent.set(m.student_id, st);
  }

  const total = present + absent;
  const percent = total ? Math.round((present / total) * 100) : 0;

  const daily = [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      present: v.p,
      absent: v.a,
      percent: v.p + v.a ? Math.round((v.p / (v.p + v.a)) * 100) : 0,
    }));

  const perBatch = [...perBatchMap.entries()]
    .map(([batch, v]) => ({ batch, present: v.p, total: v.t, percent: v.t ? Math.round((v.p / v.t) * 100) : 0 }))
    .sort((a, b) => b.percent - a.percent);

  const students = [...perStudent.values()]
    .filter((s) => s.t >= 3)
    .map((s) => ({ name: s.name, present: s.p, total: s.t, percent: Math.round((s.p / s.t) * 100) }));
  const topStudents = [...students].sort((a, b) => b.percent - a.percent).slice(0, 10);
  const lowStudents = [...students].sort((a, b) => a.percent - b.percent).slice(0, 10);

  return {
    totalMarks: mm.length,
    present, absent, late, percent,
    sessions: sessions.length,
    daily, perBatch, topStudents, lowStudents,
  };
}

// ---------------- Billing (owner) ----------------------------------------
export type BillingReport = {
  revenue: number;
  paymentsCount: number;
  avgPayment: number;
  byMonth: { label: string; amount: number }[];
  byMethod: { label: string; amount: number }[];
  byType: { label: string; amount: number }[];
  pendingStudents: number;
  pendingApprox: number; // best-effort using student fee_plan.amount for pending months
  collectionRate: number; // paid / (paid + pending)
};

export async function fetchBillingReport(tenantId: string, r: Range): Promise<BillingReport> {
  const [pays, pendings] = await Promise.all([
    supabase.from("payments")
      .select("amount, type, method, created_at, period")
      .eq("tenant_id", tenantId)
      .gte("created_at", r.from)
      .lte("created_at", r.to),
    supabase.from("students")
      .select("id, fee_plans(amount)")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
  ]);
  const rows = pays.data ?? [];
  const revenue = rows.reduce((s, p: any) => s + Number(p.amount || 0), 0);
  const paymentsCount = rows.length;
  const avgPayment = paymentsCount ? Math.round(revenue / paymentsCount) : 0;

  const byMonth = groupByMonth(rows.map((p: any) => ({ at: p.created_at, amount: Number(p.amount || 0) })));
  const byMethod = groupSum(rows, (p: any) => (p.method || "other").toUpperCase());
  const byType = groupSum(rows, (p: any) => prettyType(p.type));

  // Rough pending: for each active student on a monthly plan without a payment
  // covering the current month period key. Best-effort quick estimate; the
  // authoritative source is the fee-register view.
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const paidStudentIds = new Set(
    (
      await supabase
        .from("payments")
        .select("student_id")
        .eq("tenant_id", tenantId)
        .eq("period", period)
    ).data?.map((p: any) => p.student_id) ?? [],
  );
  const pendingStudents = (pendings.data ?? []).filter((s: any) => !paidStudentIds.has(s.id)).length;
  const pendingApprox = (pendings.data ?? [])
    .filter((s: any) => !paidStudentIds.has(s.id))
    .reduce((sum: number, s: any) => sum + Number(s.fee_plans?.amount || 0), 0);
  const collectionRate = revenue + pendingApprox > 0
    ? Math.round((revenue / (revenue + pendingApprox)) * 100)
    : 100;

  return { revenue, paymentsCount, avgPayment, byMonth, byMethod, byType, pendingStudents, pendingApprox, collectionRate };
}

// ---------------- Admissions --------------------------------------------
export type AdmissionsReport = {
  totalLeads: number;
  byStage: { stage: string; count: number }[];
  bySource: { label: string; count: number }[];
  conversion: number; // converted / totalLeads
  avgConversionDays: number | null;
  trials: number;
  converted: number;
  rejected: number;
};

export async function fetchAdmissionsReport(tenantId: string, r: Range): Promise<AdmissionsReport> {
  const { data } = await supabase
    .from("leads" as never)
    .select("id, source, pipeline_stage, created_at, converted_student_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", r.from)
    .lte("created_at", r.to);
  const leads = (data ?? []) as any[];

  const totalLeads = leads.length;
  const stageMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  let trials = 0, converted = 0, rejected = 0;

  for (const l of leads) {
    const st = l.pipeline_stage ?? "new";
    stageMap.set(st, (stageMap.get(st) ?? 0) + 1);
    const src = l.source || "manual";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    if (st === "trial" || st === "decision" || st === "approved" || st === "converted") trials++;
    if (st === "converted") converted++;
    if (st === "rejected") rejected++;
  }

  // Average conversion time from admission_timeline (created -> converted)
  let avgConversionDays: number | null = null;
  const convertedIds = leads.filter((l) => l.pipeline_stage === "converted").map((l) => l.id);
  if (convertedIds.length) {
    const { data: tl } = await supabase
      .from("admission_timeline" as never)
      .select("lead_id, created_at, to_stage")
      .in("lead_id", convertedIds)
      .eq("to_stage", "converted");
    const byLead = new Map<string, string>();
    for (const t of (tl ?? []) as any[]) byLead.set(t.lead_id, t.created_at);
    let sum = 0, n = 0;
    for (const l of leads) {
      if (l.pipeline_stage !== "converted") continue;
      const doneAt = byLead.get(l.id);
      if (!doneAt) continue;
      const days = (new Date(doneAt).getTime() - new Date(l.created_at).getTime()) / 86400000;
      if (Number.isFinite(days) && days >= 0) { sum += days; n++; }
    }
    if (n) avgConversionDays = Math.round((sum / n) * 10) / 10;
  }

  return {
    totalLeads,
    byStage: [...stageMap.entries()].map(([stage, count]) => ({ stage, count })),
    bySource: [...sourceMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    conversion: totalLeads ? Math.round((converted / totalLeads) * 100) : 0,
    avgConversionDays,
    trials, converted, rejected,
  };
}

// ---------------- Players -----------------------------------------------
export type PlayersReport = {
  active: number;
  inactive: number;
  graduated: number;
  newInRange: number;
  byBatch: { label: string; count: number }[];
  byAgeGroup: { label: string; count: number }[];
  byRole: { label: string; count: number }[];
  retention: number; // active / (active + inactive + graduated)
};

export async function fetchPlayersReport(tenantId: string, r: Range): Promise<PlayersReport> {
  const { data } = await supabase
    .from("students")
    .select("id, status, dob, playing_role, joined_at, created_at, batches(name)")
    .eq("tenant_id", tenantId);
  const rows = (data ?? []) as any[];

  let active = 0, inactive = 0, graduated = 0, newInRange = 0;
  const batchMap = new Map<string, number>();
  const roleMap = new Map<string, number>();
  const ageMap = new Map<string, number>();
  const now = new Date();

  for (const s of rows) {
    if (s.status === "active") active++;
    else if (s.status === "inactive") inactive++;
    else if (s.status === "graduated") graduated++;

    if (s.created_at && s.created_at >= r.from && s.created_at <= r.to) newInRange++;

    const batch = s.batches?.name ?? "Unassigned";
    batchMap.set(batch, (batchMap.get(batch) ?? 0) + 1);

    const role = (s.playing_role ?? "unspecified").toString();
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);

    if (s.dob) {
      const age = Math.floor((now.getTime() - new Date(s.dob).getTime()) / (365.25 * 86400000));
      const bucket = age < 8 ? "Under 8" : age < 12 ? "8–11" : age < 15 ? "12–14" : age < 18 ? "15–17" : "18+";
      ageMap.set(bucket, (ageMap.get(bucket) ?? 0) + 1);
    }
  }

  const total = active + inactive + graduated;
  return {
    active, inactive, graduated, newInRange,
    byBatch:    [...batchMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    byAgeGroup: [...ageMap.entries()].map(([label, count]) => ({ label, count })),
    byRole:     [...roleMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    retention: total ? Math.round((active / total) * 100) : 0,
  };
}

// ---------------- Matches -----------------------------------------------
export type MatchesReport = {
  total: number;
  completed: number;
  upcoming: number;
  live: number;
  byResult: { label: string; count: number }[];
  topScorers: { name: string; runs: number }[]; // best-effort empty if not accessible
};

export async function fetchMatchesReport(tenantId: string, r: Range): Promise<MatchesReport> {
  const { data } = await supabase
    .from("mc_matches")
    .select("id, status, result, winner_team, scheduled_date, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", r.from)
    .lte("created_at", r.to);
  const rows = (data ?? []) as any[];

  let completed = 0, upcoming = 0, live = 0;
  const resultMap = new Map<string, number>();
  for (const m of rows) {
    if (m.status === "completed") completed++;
    else if (m.status === "live" || m.status === "in_progress") live++;
    else upcoming++;
    const key = m.result ?? m.status ?? "unknown";
    resultMap.set(key, (resultMap.get(key) ?? 0) + 1);
  }
  return {
    total: rows.length,
    completed, upcoming, live,
    byResult: [...resultMap.entries()].map(([label, count]) => ({ label, count })),
    topScorers: [],
  };
}

// ---------------- Communications ----------------------------------------
export type CommsReport = {
  campaigns: number;
  sent: number;
  delivered: number;
  failed: number;
  byCategory: { label: string; count: number }[];
  byStatus: { label: string; count: number }[];
};

export async function fetchCommsReport(tenantId: string, r: Range): Promise<CommsReport> {
  const { data } = await supabase
    .from("comm_campaigns")
    .select("id, category, status, sent_count, delivered_count, failed_count, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", r.from)
    .lte("created_at", r.to);
  const rows = (data ?? []) as any[];
  let sent = 0, delivered = 0, failed = 0;
  const cat = new Map<string, number>();
  const st = new Map<string, number>();
  for (const c of rows) {
    sent      += Number(c.sent_count      || 0);
    delivered += Number(c.delivered_count || 0);
    failed    += Number(c.failed_count    || 0);
    cat.set(c.category ?? "general", (cat.get(c.category ?? "general") ?? 0) + 1);
    st.set(c.status ?? "draft", (st.get(c.status ?? "draft") ?? 0) + 1);
  }
  return {
    campaigns: rows.length,
    sent, delivered, failed,
    byCategory: [...cat.entries()].map(([label, count]) => ({ label, count })),
    byStatus:   [...st.entries()].map(([label, count]) => ({ label, count })),
  };
}

// ---------------- Website ----------------------------------------------
export type WebsiteReport = {
  webRegistrations: number;
  webLeads: number;
  bySource: { label: string; count: number }[];
};

export async function fetchWebsiteReport(tenantId: string, r: Range): Promise<WebsiteReport> {
  const [regsR, leadsR] = await Promise.all([
    supabase.from("registrations")
      .select("id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", r.from)
      .lte("created_at", r.to),
    supabase.from("leads" as never)
      .select("id, source")
      .eq("tenant_id", tenantId)
      .gte("created_at", r.from)
      .lte("created_at", r.to),
  ]);
  const leads = (leadsR.data ?? []) as any[];
  const src = new Map<string, number>();
  for (const l of leads) src.set(l.source || "website", (src.get(l.source || "website") ?? 0) + 1);
  return {
    webRegistrations: (regsR.data ?? []).length,
    webLeads: leads.length,
    bySource: [...src.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

// ---------------- helpers ----------------------------------------------
function groupByMonth(rows: { at: string; amount: number }[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.at) continue;
    const d = new Date(r.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    m.set(key, (m.get(key) ?? 0) + r.amount);
  }
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ label: monthLabels[Number(key.split("-")[1]) - 1] ?? key, amount }));
}

function groupSum<T>(rows: T[], keyFn: (t: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) ?? 0) + Number((r as any).amount || 0));
  }
  return [...m.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function prettyType(t: string): string {
  if (t === "monthly") return "Monthly fees";
  if (t === "registration") return "Registration";
  if (t === "personal_coaching") return "Personal coaching";
  return "Other";
}

// ---------------- CSV export ------------------------------------------
export function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
