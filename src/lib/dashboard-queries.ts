import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

export async function fetchKpis(tenantId: string): Promise<Kpis> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [active, regs, pays, studentsMonthly, paidThisMonth] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", weekAgo),
    supabase.from("payments").select("amount").eq("tenant_id", tenantId).gte("created_at", startOfMonth),
    supabase.from("students").select("id, fee_plan_id, fee_plans!inner(type)").eq("tenant_id", tenantId).eq("status", "active").eq("fee_plans.type", "monthly"),
    supabase.from("payments").select("student_id").eq("tenant_id", tenantId).eq("type", "monthly").eq("period", period),
  ]);

  const collection = (pays.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidIds = new Set((paidThisMonth.data ?? []).map((p) => p.student_id));
  const pending = (studentsMonthly.data ?? []).filter((s) => !paidIds.has(s.id)).length;

  return {
    activeStudents: active.count ?? 0,
    newRegsThisWeek: regs.count ?? 0,
    collectionThisMonth: collection,
    pendingFeeCount: pending,
  };
}
