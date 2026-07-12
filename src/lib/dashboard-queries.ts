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
