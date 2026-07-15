import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Tenant } from "./tenant";
import { candidatePeriods, periodKey, studentDue, tenantFeeCycle } from "./fees";

export type Student = Database["public"]["Tables"]["students"]["Row"];
export type Registration = Database["public"]["Tables"]["registrations"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Batch = Database["public"]["Tables"]["batches"]["Row"];
export type FeePlan = Database["public"]["Tables"]["fee_plans"]["Row"];
export type SiteContent = Database["public"]["Tables"]["site_content"]["Row"];

export const qk = {
  regs: (t: string) => ["d", "regs", t] as const,
  students: (t: string) => ["d", "students", t] as const,
  student: (id: string) => ["d", "student", id] as const,
  batches: (t: string) => ["d", "batches", t] as const,
  feePlans: (t: string) => ["d", "feeplans", t] as const,
  payments: (t: string) => ["d", "payments", t] as const,
  studentPayments: (id: string) => ["d", "payments", "student", id] as const,
  site: (t: string) => ["d", "site", t] as const,
  kpis: (t: string) => ["d", "kpis", t] as const,
  insights: (t: string) => ["d", "insights", t] as const,
  activity: (t: string) => ["d", "activity", t] as const,
  feeRegister: (t: string, month: string) => ["d", "fees", t, month] as const,
  monthCollection: (t: string) => ["d", "fees", "collected", t] as const,
  report: (t: string) => ["d", "report", t] as const,
};

export async function fetchRegistrations(tenantId: string) {
  const { data, error } = await supabase
    .from("registrations")
    .select("*, batches(name), fee_plans(name, amount)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStudents(tenantId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("*, batches(name), fee_plans(name, amount, type)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchStudent(id: string) {
  const { data, error } = await supabase
    .from("students")
    .select("*, batches(id, name, timing), fee_plans(id, name, amount, type)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchStudentPayments(studentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchBatches(tenantId: string) {
  const { data, error } = await supabase
    .from("batches")
    .select("*, students(count)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchFeePlans(tenantId: string) {
  const { data, error } = await supabase
    .from("fee_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSiteContent(tenantId: string) {
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export type Kpis = {
  activeStudents: number;
  newRegsThisWeek: number;
  collectionThisMonth: number;
  pendingFeeCount: number;
};

export async function fetchKpis(tenant: Tenant): Promise<Kpis> {
  const tenantId = tenant.id;
  const cycle = tenantFeeCycle(tenant);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const periods = cycle === "joining_date" ? candidatePeriods(now) : [periodKey(now)];

  const [active, regs, pays, studentsMonthly, paidRows] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "active"),
    supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", weekAgo),
    supabase
      .from("payments")
      .select("amount")
      .eq("tenant_id", tenantId)
      .gte("created_at", startOfMonth),
    supabase
      .from("students")
      .select("id, joined_at, fee_plan_id, fee_plans!inner(type)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("fee_plans.type", "monthly"),
    supabase
      .from("payments")
      .select("student_id, period")
      .eq("tenant_id", tenantId)
      .in("period", periods),
  ]);

  const collection = (pays.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidByStudent = new Map<string, Set<string>>();
  for (const p of paidRows.data ?? []) {
    if (!p.student_id || !p.period) continue;
    const set = paidByStudent.get(p.student_id) ?? new Set<string>();
    set.add(p.period);
    paidByStudent.set(p.student_id, set);
  }
  const pending = (studentsMonthly.data ?? []).filter((s) => {
    const due = studentDue({
      cycle,
      joinedAt: s.joined_at,
      selectedMonth: now,
      paidPeriods: paidByStudent.get(s.id) ?? new Set(),
      today: now,
    });
    return due.state === "pending";
  }).length;

  return {
    activeStudents: active.count ?? 0,
    newRegsThisWeek: regs.count ?? 0,
    collectionThisMonth: collection,
    pendingFeeCount: pending,
  };
}

/** Payments carrying any of the given period keys (fee register paid-lookup). */
export async function fetchPaymentsForPeriods(tenantId: string, periods: string[]) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, student_id, period, amount, method, type, receipt_no, created_at")
    .eq("tenant_id", tenantId)
    .in("period", periods);
  if (error) throw error;
  return data ?? [];
}

/** All payments since a date, with student names (reports + CSV export). */
export async function fetchPaymentsSince(tenantId: string, sinceISO: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, type, period, method, receipt_no, note, created_at, students(name)")
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Dashboard insights: revenue trend (last 6 months), today's attendance %,
// upcoming birthdays (next 7 days).
// -----------------------------------------------------------------------------

export type RevenuePoint = { month: string; label: string; amount: number };
export type Birthday = {
  id: string;
  name: string;
  photoUrl: string | null;
  dob: string;
  daysAway: number; // 0 = today, 1..7 = upcoming
  age: number;
};
export type DashboardInsights = {
  revenue: RevenuePoint[];
  revenueTotal: number;
  attendanceToday: {
    present: number;
    absent: number;
    total: number;
    percent: number;
    sessions: number;
  };
  birthdays: Birthday[];
};

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchDashboardInsights(tenantId: string): Promise<DashboardInsights> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const todayStr = now.toISOString().slice(0, 10);

  const [payRes, sessRes, studRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", sixMonthsAgo.toISOString()),
    supabase
      .from("attendance_sessions")
      .select("id, attendance_marks(status)")
      .eq("tenant_id", tenantId)
      .eq("session_date", todayStr),
    supabase
      .from("students")
      .select("id, name, dob, photo_url")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .not("dob", "is", null),
  ]);

  // Revenue trend (fill zero months)
  const buckets = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    buckets.set(monthKeyOf(d), 0);
  }
  for (const p of payRes.data ?? []) {
    if (!p.created_at) continue;
    const key = monthKeyOf(new Date(p.created_at));
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(p.amount || 0));
  }
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenue: RevenuePoint[] = Array.from(buckets.entries()).map(([key, amount]) => {
    const [, m] = key.split("-");
    return { month: key, label: monthLabels[Number(m) - 1] ?? key, amount };
  });
  const revenueTotal = revenue.reduce((s, r) => s + r.amount, 0);

  // Today's attendance
  let present = 0;
  let absent = 0;
  const sessions = (sessRes.data ?? []).length;
  for (const s of sessRes.data ?? []) {
    for (const m of (s as any).attendance_marks ?? []) {
      if (m.status === "present" || m.status === "late") present++;
      else if (m.status === "absent") absent++;
    }
  }
  const total = present + absent;
  const percent = total > 0 ? Math.round((present / total) * 100) : 0;

  // Birthdays in next 7 days (including today)
  const birthdays: Birthday[] = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const s of studRes.data ?? []) {
    if (!s.dob) continue;
    const dob = new Date(s.dob);
    const thisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    // if birthday already passed this year, roll to next year (won't match 7-day window unless year-end)
    if (thisYear < startOfToday) thisYear.setFullYear(now.getFullYear() + 1);
    const daysAway = Math.round((thisYear.getTime() - startOfToday.getTime()) / 86400000);
    if (daysAway <= 7) {
      const age = thisYear.getFullYear() - dob.getFullYear();
      birthdays.push({
        id: s.id,
        name: s.name,
        photoUrl: s.photo_url ?? null,
        dob: s.dob,
        daysAway,
        age,
      });
    }
  }
  birthdays.sort((a, b) => a.daysAway - b.daysAway);

  return {
    revenue,
    revenueTotal,
    attendanceToday: { present, absent, total, percent, sessions },
    birthdays: birthdays.slice(0, 8),
  };
}

// -----------------------------------------------------------------------------
// Today's Activity feed — chronological, cross-module event stream. Derived
// live from the source-of-truth tables; nothing stored. Newest first.
//   • attendance check-ins / check-outs (from attendance_marks)
//   • fee payments received (from payments)
//   • new registrations (from registrations)
// Match Center events will plug in later without a schema change.
// -----------------------------------------------------------------------------

export type ActivityEvent = {
  id: string;
  at: string; // ISO timestamp — newest first
  kind: "check_in" | "check_out" | "payment" | "registration";
  actorName: string;
  detail?: string;
  amount?: number;
  href?: string;
  params?: Record<string, string>;
};

export async function fetchDashboardActivity(
  tenantId: string,
  opts: { includeFees?: boolean; limit?: number } = {},
): Promise<ActivityEvent[]> {
  const includeFees = opts.includeFees !== false;
  const limit = opts.limit ?? 20;
  const sinceISO = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  const attendanceP = supabase
    .from("attendance_marks")
    .select("id, student_id, check_in_at, check_out_at, created_at, students!inner(name)")
    .eq("tenant_id", tenantId)
    .is("superseded_by", null)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(30);

  const regsP = supabase
    .from("registrations")
    .select("id, name, created_at, status")
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(10);

  const paysP = includeFees
    ? supabase
        .from("payments")
        .select("id, amount, created_at, student_id, students(name)")
        .eq("tenant_id", tenantId)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(10)
    : Promise.resolve({ data: [] as never[], error: null });

  const [att, regs, pays] = await Promise.all([attendanceP, regsP, paysP]);

  const events: ActivityEvent[] = [];

  for (const m of att.data ?? []) {
    const name = (m as any).students?.name ?? "Player";
    const studentHref = m.student_id ? `/dashboard/students/${m.student_id}` : "/dashboard/attendance";
    if (m.check_out_at) {
      events.push({
        id: `${m.id}-out`,
        at: m.check_out_at,
        kind: "check_out",
        actorName: name,
        detail: "Checked out",
        href: studentHref,
      });
    }
    if (m.check_in_at) {
      events.push({
        id: `${m.id}-in`,
        at: m.check_in_at,
        kind: "check_in",
        actorName: name,
        detail: "Checked in",
        href: studentHref,
      });
    }
  }

  for (const r of regs.data ?? []) {
    events.push({
      id: `reg-${r.id}`,
      at: r.created_at as string,
      kind: "registration",
      actorName: r.name,
      detail: r.status === "approved" ? "Registration approved" : "New registration",
      href: "/dashboard/registrations",
    });
  }

  for (const p of pays.data ?? []) {
    const name = (p as any).students?.name ?? "Player";
    events.push({
      id: `pay-${p.id}`,
      at: p.created_at as string,
      kind: "payment",
      actorName: name,
      amount: Number(p.amount ?? 0),
      detail: "Fee received",
      href: "/dashboard/fees",
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}
