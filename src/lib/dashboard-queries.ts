import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Tenant } from "./tenant";
import { fetchBillingKpis } from "./billing";

export type Student = Database["public"]["Tables"]["students"]["Row"];
export type Registration = Database["public"]["Tables"]["registrations"]["Row"];
/** @deprecated Legacy `payments` row. Canonical: `billing_payments`. */
export type Payment = Database["public"]["Tables"]["billing_payments"]["Row"];
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

/**
 * Canonical: reads succeeded `billing_payments` for a student.
 * Replaces the legacy `payments` table read; every finance surface is
 * required to consume this or `fetchBillingKpis` and never the
 * deprecated `payments` table directly.
 */
export async function fetchStudentPayments(studentId: string) {
  const { data, error } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "succeeded")
    .order("collected_at", { ascending: false });
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
  /**
   * Money collected this month.
   *
   * Canonical source: `billing_payments` (via `fetchBillingKpis`) — the same
   * service NevorAI's `finance_summary` tool, the Daily Brief, Reports, and
   * the Billing page consume. Falls back to the legacy `payments` sum only
   * when the billing service is unavailable, so Home never shows a number
   * that contradicts AI.
   */
  collectionThisMonth: number;
  /**
   * Deprecated period-count. Kept for backward-compat with any legacy
   * caller; Home no longer renders this. New code MUST use `overdueInvoices`
   * (canonical, matches NevorAI). See `outstandingAmount` for the money value.
   */
  pendingFeeCount: number;
  /** Canonical: count of `billing_invoices` past their due date. */
  overdueInvoices: number;
  /** Canonical: sum of open `billing_invoices.balance` (₹). */
  outstandingAmount: number;
  /** Canonical: count of open (issued/partially_paid) invoices. */
  openInvoices: number;
};

/**
 * Canonical KPIs. Every finance number here comes from `fetchBillingKpis`
 * (`billing_invoices` + `billing_payments`). Legacy `payments` +
 * `studentDue()` reads were removed in Phase 13.3 — Dashboard, Fees,
 * Billing, Reports, NevorAI, Daily Brief and Analytics now share one
 * calculation.
 */
export async function fetchKpis(tenant: Tenant): Promise<Kpis> {
  const tenantId = tenant.id;
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

  const [active, regs, billingKpis] = await Promise.all([
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
    // Canonical billing service — same numbers as NevorAI/Reports/Brief/Billing.
    fetchBillingKpis(tenantId).catch(() => null),
  ]);

  return {
    activeStudents: active.count ?? 0,
    newRegsThisWeek: regs.count ?? 0,
    collectionThisMonth: Number(billingKpis?.collectedThisMonth ?? 0),
    // `pendingFeeCount` is deprecated. Use `overdueInvoices` — the canonical
    // count of past-due `billing_invoices` (matches NevorAI/Reports).
    pendingFeeCount: Number(billingKpis?.overdue ?? 0),
    overdueInvoices: Number(billingKpis?.overdue ?? 0),
    outstandingAmount: Number(billingKpis?.outstanding ?? 0),
    openInvoices: Number(billingKpis?.openInvoices ?? 0),
  };
}

/**
 * @deprecated Legacy fee-register paid-lookup (period-keyed `payments`).
 * Retained only for backward-compat with tests/scripts; the fee register
 * route now redirects to `/dashboard/billing`. Returns an empty list so
 * callers get a safe no-op instead of contradictory data.
 */
export async function fetchPaymentsForPeriods(_tenantId: string, _periods: string[]) {
  return [] as Array<{
    id: string;
    student_id: string | null;
    period: string | null;
    amount: number;
    method: string | null;
    type: string | null;
    receipt_no: number | null;
    created_at: string;
  }>;
}

/**
 * Canonical: succeeded `billing_payments` since a timestamp, with student
 * names for reports/CSV export. Replaces the legacy `payments` read.
 */
export async function fetchPaymentsSince(tenantId: string, sinceISO: string) {
  const { data, error } = await supabase
    .from("billing_payments")
    .select("id, amount, method, reference_number, remarks, collected_at, students(name)")
    .eq("tenant_id", tenantId)
    .eq("status", "succeeded")
    .gte("collected_at", sinceISO)
    .order("collected_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    amount: Number(r.amount ?? 0),
    type: null as string | null,
    period: null as string | null,
    method: r.method,
    receipt_no: r.reference_number,
    note: r.remarks,
    created_at: r.collected_at,
    students: r.students,
  }));
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
  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
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
    const studentHref = m.student_id
      ? `/dashboard/students/${m.student_id}`
      : "/dashboard/attendance";
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
