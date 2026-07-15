/**
 * NevorAI Founder Intelligence — internal derivation layer.
 *
 * Everything here is DERIVED from existing tables. No new tables, no
 * writes. Aggregations run client-side against raw row exports; this is
 * an internal Platform Admin tool used at NevorAI-scale (< a few hundred
 * tenants), so on-the-fly aggregation is cheaper than shipping bespoke
 * views/RPCs. If tenant count grows, promote the aggregations here into
 * a materialized view without changing the public API.
 *
 * Reuses:
 *   tenants, students, attendance_marks, billing_invoices, billing_payments,
 *   automation_executions, notification_deliveries, notifications,
 *   profiles, push_devices, mc_website_config, fee_plans, coach_assignments,
 *   batches, admission_timeline, student_import_batches, comm_campaigns,
 *   staff_invitations.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TenantRow } from "./platform-queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000;
const now = () => Date.now();
const iso = (msAgo: number) => new Date(now() - msAgo).toISOString();

async function selectAll<T>(
  table: string,
  columns: string,
  filters?: (q: any) => any,
): Promise<T[]> {
  let q: any = (supabase as any).from(table).select(columns);
  if (filters) q = filters(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------------------
// Raw snapshots — one wide fetch per source, joined in memory.
// ---------------------------------------------------------------------------
export interface IntelligenceSnapshot {
  fetched_at: string;
  tenants: TenantRow[];
  students: Array<{ tenant_id: string; status: string; created_at: string }>;
  attendance30d: Array<{ tenant_id: string; created_at: string }>;
  invoices90d: Array<{
    tenant_id: string;
    status: string;
    total: number | null;
    amount_paid: number | null;
    created_at: string;
  }>;
  payments30d: Array<{ tenant_id: string; amount: number | null; created_at: string; status: string }>;
  automation30d: Array<{ tenant_id: string; status: string; created_at: string }>;
  notifDeliveries7d: Array<{ status: string; delivered_at: string | null; created_at: string; notification_id: string }>;
  notifications30d: Array<{ tenant_id: string; created_at: string; id: string }>;
  profiles: Array<{ tenant_id: string | null; role: string; user_id: string; created_at: string }>;
  pushDevices: Array<{ tenant_id: string; user_id: string }>;
  website: Array<{ tenant_id: string }>;
  feePlans: Array<{ tenant_id: string }>;
  batches: Array<{ tenant_id: string }>;
  coachAssignments: Array<{ tenant_id: string; created_at: string }>;
  imports: Array<{ tenant_id: string; status: string; created_at: string }>;
  campaigns: Array<{ tenant_id: string; created_at: string }>;
  admissionTimeline30d: Array<{ tenant_id: string; created_at: string }>;
}

export async function fetchIntelligenceSnapshot(
  tenants: TenantRow[],
): Promise<IntelligenceSnapshot> {
  const [
    students,
    attendance30d,
    invoices90d,
    payments30d,
    automation30d,
    notifs30d,
    profiles,
    pushDevices,
    website,
    feePlans,
    batches,
    coachAssignments,
    imports,
    campaigns,
    admissionTimeline30d,
  ] = await Promise.all([
    selectAll<any>("students", "tenant_id, status, created_at", (q) =>
      q.is("archived_at", null),
    ),
    selectAll<any>("attendance_marks", "tenant_id, created_at", (q) =>
      q.gte("created_at", iso(30 * DAY_MS)),
    ),
    selectAll<any>(
      "billing_invoices",
      "tenant_id, status, total, amount_paid, created_at",
      (q) => q.gte("created_at", iso(90 * DAY_MS)),
    ),
    selectAll<any>("billing_payments", "tenant_id, amount, created_at, status", (q) =>
      q.gte("created_at", iso(30 * DAY_MS)),
    ),
    selectAll<any>("automation_executions", "tenant_id, status, created_at", (q) =>
      q.gte("created_at", iso(30 * DAY_MS)),
    ),
    selectAll<any>("notifications", "tenant_id, created_at, id", (q) =>
      q.gte("created_at", iso(30 * DAY_MS)),
    ),
    selectAll<any>("profiles", "tenant_id, role, user_id, created_at"),
    selectAll<any>("push_devices", "tenant_id, user_id"),
    selectAll<any>("mc_website_config", "tenant_id"),
    selectAll<any>("fee_plans", "tenant_id"),
    selectAll<any>("batches", "tenant_id"),
    selectAll<any>("coach_assignments", "tenant_id, created_at"),
    selectAll<any>("student_import_batches", "tenant_id, status, created_at"),
    selectAll<any>("comm_campaigns", "tenant_id, created_at"),
    selectAll<any>("admission_timeline", "tenant_id, created_at", (q) =>
      q.gte("created_at", iso(30 * DAY_MS)),
    ),
  ]);

  // notification_deliveries has no tenant_id — join via notification_id.
  const notifIds = notifs30d.map((n) => n.id).slice(0, 5000);
  let notifDeliveries7d: Array<any> = [];
  if (notifIds.length > 0) {
    const { data } = await (supabase as any)
      .from("notification_deliveries")
      .select("status, delivered_at, created_at, notification_id")
      .gte("created_at", iso(7 * DAY_MS))
      .in("notification_id", notifIds);
    notifDeliveries7d = data ?? [];
  }

  return {
    fetched_at: new Date().toISOString(),
    tenants,
    students,
    attendance30d,
    invoices90d,
    payments30d,
    automation30d,
    notifDeliveries7d,
    notifications30d: notifs30d,
    profiles,
    pushDevices,
    website,
    feePlans,
    batches,
    coachAssignments,
    imports,
    campaigns,
    admissionTimeline30d,
  };
}

// ---------------------------------------------------------------------------
// Executive KPIs — MRR, ARR, revenue, growth.
// ---------------------------------------------------------------------------
export interface ExecutiveKpis {
  mrr: number;
  arr: number;
  total_revenue_90d: number;
  received_this_month: number;
  active_academies: number;
  trial_academies: number;
  paid_academies: number;
  suspended_academies: number;
  new_academies_30d: number;
  new_academies_7d: number;
  cancelled_academies_30d: number;
  renewals_due_7d: number;
  revenue_growth_pct: number; // last-30d payments vs prior 30d
}

export function computeExecutiveKpis(s: IntelligenceSnapshot): ExecutiveKpis {
  const active = s.tenants.filter((t) => t.status === "active");
  const trial = s.tenants.filter((t) => t.subscription_status === "trial");
  const paid = s.tenants.filter((t) => t.subscription_status === "paid");
  const suspended = s.tenants.filter((t) => t.status === "suspended");
  const cancelled = s.tenants.filter((t) => t.status === "cancelled");

  const mrr = active.reduce((sum, t) => sum + (t.monthly_price ?? 0), 0);
  const arr = mrr * 12;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const receivedThisMonth = s.payments30d
    .filter((p) => p.status === "succeeded" && new Date(p.created_at).getTime() >= monthStartMs)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const totalRevenue90d = s.invoices90d
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);

  const d30 = now() - 30 * DAY_MS;
  const d7 = now() - 7 * DAY_MS;
  const new30 = s.tenants.filter((t) => new Date(t.created_at).getTime() >= d30).length;
  const new7 = s.tenants.filter((t) => new Date(t.created_at).getTime() >= d7).length;

  // Renewals due — active tenants whose last_paid_date + 30d falls in next 7d.
  let renewalsDue = 0;
  const in7 = now() + 7 * DAY_MS;
  for (const t of active) {
    if (!t.last_paid_date) continue;
    const nextDue = new Date(t.last_paid_date).getTime() + 30 * DAY_MS;
    if (nextDue >= now() && nextDue <= in7) renewalsDue++;
  }

  // Revenue growth — last 30d vs prior 30d (based on payments in 30d window
  // plus prior 60d invoices for prior period).
  const last30Payments = s.payments30d
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const prior30Invoices = s.invoices90d
    .filter((i) => {
      const t = new Date(i.created_at).getTime();
      return i.status === "paid" && t < d30 && t >= now() - 60 * DAY_MS;
    })
    .reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);
  const growthPct =
    prior30Invoices > 0
      ? Math.round(((last30Payments - prior30Invoices) / prior30Invoices) * 100)
      : last30Payments > 0
        ? 100
        : 0;

  return {
    mrr,
    arr,
    total_revenue_90d: totalRevenue90d,
    received_this_month: receivedThisMonth,
    active_academies: active.length,
    trial_academies: trial.length,
    paid_academies: paid.length,
    suspended_academies: suspended.length,
    new_academies_30d: new30,
    new_academies_7d: new7,
    cancelled_academies_30d: cancelled.filter(
      (t) => new Date(t.created_at).getTime() >= d30,
    ).length,
    renewals_due_7d: renewalsDue,
    revenue_growth_pct: growthPct,
  };
}

// ---------------------------------------------------------------------------
// Per-tenant health score.
// ---------------------------------------------------------------------------
export type HealthBand = "excellent" | "good" | "needs_attention" | "critical";

export interface TenantHealth {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  score: number; // 0..100
  band: HealthBand;
  factors: {
    student_activity: number;
    attendance_usage: number;
    parent_activation: number;
    coach_activity: number;
    fee_collection: number;
    automation_usage: number;
    notification_delivery: number;
    days_inactive: number;
    feature_adoption: number;
  };
  churn_risk: "low" | "medium" | "high";
  churn_reasons: string[];
}

function bandFor(score: number): HealthBand {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 35) return "needs_attention";
  return "critical";
}

export function computeTenantHealth(s: IntelligenceSnapshot): TenantHealth[] {
  // Pre-index for O(1) lookups.
  const studentsByT = new Map<string, number>();
  const activeStudentsByT = new Map<string, number>();
  for (const st of s.students) {
    studentsByT.set(st.tenant_id, (studentsByT.get(st.tenant_id) ?? 0) + 1);
    if (st.status === "active") {
      activeStudentsByT.set(st.tenant_id, (activeStudentsByT.get(st.tenant_id) ?? 0) + 1);
    }
  }
  const attByT = new Map<string, number>();
  const lastAttByT = new Map<string, number>();
  for (const a of s.attendance30d) {
    attByT.set(a.tenant_id, (attByT.get(a.tenant_id) ?? 0) + 1);
    const t = new Date(a.created_at).getTime();
    lastAttByT.set(a.tenant_id, Math.max(lastAttByT.get(a.tenant_id) ?? 0, t));
  }
  const invByT = new Map<string, { total: number; paid: number }>();
  for (const inv of s.invoices90d) {
    const cur = invByT.get(inv.tenant_id) ?? { total: 0, paid: 0 };
    cur.total += inv.total ?? 0;
    if (inv.status === "paid") cur.paid += inv.amount_paid ?? 0;
    invByT.set(inv.tenant_id, cur);
  }
  const autByT = new Map<string, { ok: number; fail: number }>();
  for (const a of s.automation30d) {
    const cur = autByT.get(a.tenant_id) ?? { ok: 0, fail: 0 };
    if (a.status === "failed") cur.fail++;
    else cur.ok++;
    autByT.set(a.tenant_id, cur);
  }
  const notifByT = new Map<string, string[]>(); // notification ids
  for (const n of s.notifications30d) {
    const arr = notifByT.get(n.tenant_id) ?? [];
    arr.push(n.id);
    notifByT.set(n.tenant_id, arr);
  }
  const deliveryByNotif = new Map<string, { ok: number; total: number }>();
  for (const d of s.notifDeliveries7d) {
    const cur = deliveryByNotif.get(d.notification_id) ?? { ok: 0, total: 0 };
    cur.total++;
    if (d.status === "delivered" || d.status === "sent") cur.ok++;
    deliveryByNotif.set(d.notification_id, cur);
  }
  const parentsByT = new Map<string, number>();
  const coachesByT = new Map<string, number>();
  const pushUsersByT = new Map<string, Set<string>>();
  for (const p of s.profiles) {
    if (!p.tenant_id) continue;
    if (p.role === "parent") parentsByT.set(p.tenant_id, (parentsByT.get(p.tenant_id) ?? 0) + 1);
    if (p.role === "coach") coachesByT.set(p.tenant_id, (coachesByT.get(p.tenant_id) ?? 0) + 1);
  }
  for (const d of s.pushDevices) {
    const set = pushUsersByT.get(d.tenant_id) ?? new Set();
    set.add(d.user_id);
    pushUsersByT.set(d.tenant_id, set);
  }
  const websiteT = new Set(s.website.map((w) => w.tenant_id));
  const feePlansByT = new Map<string, number>();
  for (const f of s.feePlans) feePlansByT.set(f.tenant_id, (feePlansByT.get(f.tenant_id) ?? 0) + 1);
  const batchesByT = new Map<string, number>();
  for (const b of s.batches) batchesByT.set(b.tenant_id, (batchesByT.get(b.tenant_id) ?? 0) + 1);

  return s.tenants.map((t) => {
    const totalStudents = activeStudentsByT.get(t.id) ?? 0;
    const attCount = attByT.get(t.id) ?? 0;
    // student activity: attendance events / (students * 20 sessions/mo)
    const studentActivity =
      totalStudents > 0 ? Math.min(100, Math.round((attCount / (totalStudents * 20)) * 100)) : 0;
    // attendance usage: any attendance in last 30d = up to 100
    const attendanceUsage = Math.min(100, attCount > 0 ? 40 + Math.min(60, attCount / 5) : 0);

    const parents = parentsByT.get(t.id) ?? 0;
    const parentPct =
      totalStudents > 0 ? Math.min(100, Math.round((parents / totalStudents) * 100)) : 0;

    const coaches = coachesByT.get(t.id) ?? 0;
    const coachActivity = coaches > 0 ? Math.min(100, 50 + coaches * 15) : 0;

    const inv = invByT.get(t.id) ?? { total: 0, paid: 0 };
    const feeCollection = inv.total > 0 ? Math.round((inv.paid / inv.total) * 100) : 0;

    const aut = autByT.get(t.id) ?? { ok: 0, fail: 0 };
    const totalAut = aut.ok + aut.fail;
    const automationUsage =
      totalAut > 0 ? Math.min(100, 40 + Math.round((aut.ok / totalAut) * 60)) : 0;

    const notifIds = notifByT.get(t.id) ?? [];
    let dOk = 0;
    let dTotal = 0;
    for (const nid of notifIds) {
      const d = deliveryByNotif.get(nid);
      if (d) {
        dOk += d.ok;
        dTotal += d.total;
      }
    }
    const notifDelivery = dTotal > 0 ? Math.round((dOk / dTotal) * 100) : notifIds.length ? 60 : 0;

    const lastAtt = lastAttByT.get(t.id);
    const daysInactive = lastAtt
      ? Math.floor((now() - lastAtt) / DAY_MS)
      : Math.floor((now() - new Date(t.created_at).getTime()) / DAY_MS);

    // Feature adoption count (0..10 major features).
    let adoptionHits = 0;
    if (totalStudents > 0) adoptionHits++;
    if (attCount > 0) adoptionHits++;
    if ((feePlansByT.get(t.id) ?? 0) > 0) adoptionHits++;
    if ((batchesByT.get(t.id) ?? 0) > 0) adoptionHits++;
    if (parents > 0) adoptionHits++;
    if (coaches > 0) adoptionHits++;
    if (totalAut > 0) adoptionHits++;
    if (notifIds.length > 0) adoptionHits++;
    if (websiteT.has(t.id)) adoptionHits++;
    if ((pushUsersByT.get(t.id)?.size ?? 0) > 0) adoptionHits++;
    const featureAdoption = Math.round((adoptionHits / 10) * 100);

    const inactivityPenalty = daysInactive >= 14 ? 100 : daysInactive >= 7 ? 60 : daysInactive >= 3 ? 25 : 0;

    // Weighted score.
    const score = Math.max(
      0,
      Math.round(
        studentActivity * 0.15 +
          attendanceUsage * 0.18 +
          parentPct * 0.1 +
          coachActivity * 0.07 +
          feeCollection * 0.15 +
          automationUsage * 0.08 +
          notifDelivery * 0.07 +
          featureAdoption * 0.2 -
          inactivityPenalty * 0.4,
      ),
    );

    // Churn risk.
    const reasons: string[] = [];
    if (daysInactive >= 14) reasons.push(`Inactive ${daysInactive}d`);
    if (attCount === 0) reasons.push("No attendance in 30d");
    if (inv.total > 0 && feeCollection < 40) reasons.push(`Fee collection ${feeCollection}%`);
    if (totalAut === 0) reasons.push("Automation unused");
    if (notifIds.length === 0) reasons.push("No notifications");
    if (adoptionHits <= 2) reasons.push("Low feature adoption");
    const churn_risk = reasons.length >= 3 ? "high" : reasons.length === 2 ? "medium" : "low";

    return {
      tenant_id: t.id,
      tenant_name: t.name,
      slug: t.slug,
      score,
      band: bandFor(score),
      factors: {
        student_activity: studentActivity,
        attendance_usage: attendanceUsage,
        parent_activation: parentPct,
        coach_activity: coachActivity,
        fee_collection: feeCollection,
        automation_usage: automationUsage,
        notification_delivery: notifDelivery,
        days_inactive: daysInactive,
        feature_adoption: featureAdoption,
      },
      churn_risk,
      churn_reasons: reasons,
    };
  });
}

// ---------------------------------------------------------------------------
// Feature adoption matrix.
// ---------------------------------------------------------------------------
export type AdoptionLevel = "never" | "testing" | "partial" | "full";
export const ADOPTION_FEATURES = [
  "attendance",
  "fees",
  "admissions",
  "crm",
  "match_center",
  "automation",
  "notifications",
  "website",
  "parent_portal",
  "coach_dashboard",
  "activation",
  "reports",
] as const;
export type AdoptionFeature = (typeof ADOPTION_FEATURES)[number];

export interface FeatureAdoption {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  levels: Record<AdoptionFeature, AdoptionLevel>;
  score: number; // 0..100
}

function levelFrom(count: number, testingThresh: number, fullThresh: number): AdoptionLevel {
  if (count === 0) return "never";
  if (count < testingThresh) return "testing";
  if (count < fullThresh) return "partial";
  return "full";
}

export function computeFeatureAdoption(s: IntelligenceSnapshot): FeatureAdoption[] {
  const attByT = new Map<string, number>();
  for (const a of s.attendance30d) attByT.set(a.tenant_id, (attByT.get(a.tenant_id) ?? 0) + 1);
  const invByT = new Map<string, number>();
  for (const inv of s.invoices90d) invByT.set(inv.tenant_id, (invByT.get(inv.tenant_id) ?? 0) + 1);
  const admByT = new Map<string, number>();
  for (const a of s.admissionTimeline30d)
    admByT.set(a.tenant_id, (admByT.get(a.tenant_id) ?? 0) + 1);
  const campByT = new Map<string, number>();
  for (const c of s.campaigns) campByT.set(c.tenant_id, (campByT.get(c.tenant_id) ?? 0) + 1);
  const autByT = new Map<string, number>();
  for (const a of s.automation30d) autByT.set(a.tenant_id, (autByT.get(a.tenant_id) ?? 0) + 1);
  const notifByT = new Map<string, number>();
  for (const n of s.notifications30d)
    notifByT.set(n.tenant_id, (notifByT.get(n.tenant_id) ?? 0) + 1);
  const parentsByT = new Map<string, number>();
  const coachesByT = new Map<string, number>();
  for (const p of s.profiles) {
    if (!p.tenant_id) continue;
    if (p.role === "parent") parentsByT.set(p.tenant_id, (parentsByT.get(p.tenant_id) ?? 0) + 1);
    if (p.role === "coach") coachesByT.set(p.tenant_id, (coachesByT.get(p.tenant_id) ?? 0) + 1);
  }
  const websiteT = new Set(s.website.map((w) => w.tenant_id));
  const pushByT = new Map<string, Set<string>>();
  for (const d of s.pushDevices) {
    const set = pushByT.get(d.tenant_id) ?? new Set();
    set.add(d.user_id);
    pushByT.set(d.tenant_id, set);
  }

  return s.tenants.map((t) => {
    const levels: Record<AdoptionFeature, AdoptionLevel> = {
      attendance: levelFrom(attByT.get(t.id) ?? 0, 10, 100),
      fees: levelFrom(invByT.get(t.id) ?? 0, 3, 20),
      admissions: levelFrom(admByT.get(t.id) ?? 0, 2, 15),
      crm: levelFrom(campByT.get(t.id) ?? 0, 1, 5),
      match_center: "never", // reserved — mc_matches tenant scoping is via academy_id
      automation: levelFrom(autByT.get(t.id) ?? 0, 3, 30),
      notifications: levelFrom(notifByT.get(t.id) ?? 0, 5, 50),
      website: websiteT.has(t.id) ? "full" : "never",
      parent_portal: levelFrom(parentsByT.get(t.id) ?? 0, 2, 10),
      coach_dashboard: levelFrom(coachesByT.get(t.id) ?? 0, 1, 3),
      activation: levelFrom(pushByT.get(t.id)?.size ?? 0, 2, 10),
      reports: levelFrom(invByT.get(t.id) ?? 0, 1, 5),
    };
    const score = Math.round(
      (Object.values(levels).reduce((sum, lv) => {
        return sum + (lv === "full" ? 100 : lv === "partial" ? 60 : lv === "testing" ? 30 : 0);
      }, 0) /
        ADOPTION_FEATURES.length) *
        1,
    );
    return { tenant_id: t.id, tenant_name: t.name, slug: t.slug, levels, score };
  });
}

// ---------------------------------------------------------------------------
// Onboarding tracker.
// ---------------------------------------------------------------------------
export interface OnboardingProgress {
  tenant_id: string;
  tenant_name: string;
  slug: string;
  import_completed: boolean;
  student_activation_pct: number;
  parent_activation_pct: number;
  coach_setup: boolean;
  fee_plans: boolean;
  attendance_started: boolean;
  first_payment: boolean;
  website_published: boolean;
  completion_pct: number;
}

export function computeOnboarding(s: IntelligenceSnapshot): OnboardingProgress[] {
  const studentsByT = new Map<string, number>();
  const activeStudentsByT = new Map<string, number>();
  for (const st of s.students) {
    studentsByT.set(st.tenant_id, (studentsByT.get(st.tenant_id) ?? 0) + 1);
    if (st.status === "active") {
      activeStudentsByT.set(st.tenant_id, (activeStudentsByT.get(st.tenant_id) ?? 0) + 1);
    }
  }
  const importsOk = new Set(
    s.imports.filter((i) => i.status === "completed" || i.status === "success").map((i) => i.tenant_id),
  );
  const feePlansT = new Set(s.feePlans.map((f) => f.tenant_id));
  const attT = new Set(s.attendance30d.map((a) => a.tenant_id));
  const paymentsT = new Set(s.payments30d.filter((p) => p.status === "succeeded").map((p) => p.tenant_id));
  const invPaidT = new Set(
    s.invoices90d.filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0).map((i) => i.tenant_id),
  );
  const websiteT = new Set(s.website.map((w) => w.tenant_id));
  const coachT = new Set(
    [...s.coachAssignments.map((c) => c.tenant_id), ...s.profiles.filter((p) => p.role === "coach" && p.tenant_id).map((p) => p.tenant_id!)],
  );
  const parentsByT = new Map<string, number>();
  for (const p of s.profiles) {
    if (!p.tenant_id) continue;
    if (p.role === "parent") parentsByT.set(p.tenant_id, (parentsByT.get(p.tenant_id) ?? 0) + 1);
  }
  const pushByT = new Map<string, Set<string>>();
  for (const d of s.pushDevices) {
    const set = pushByT.get(d.tenant_id) ?? new Set();
    set.add(d.user_id);
    pushByT.set(d.tenant_id, set);
  }

  return s.tenants.map((t) => {
    const total = studentsByT.get(t.id) ?? 0;
    const active = activeStudentsByT.get(t.id) ?? 0;
    const activatedPush = pushByT.get(t.id)?.size ?? 0;
    const parents = parentsByT.get(t.id) ?? 0;
    const studentActivationPct = total > 0 ? Math.round((active / total) * 100) : 0;
    const parentActivationPct = total > 0 ? Math.round((parents / total) * 100) : 0;
    const import_completed = importsOk.has(t.id) || total >= 5;
    const coach_setup = coachT.has(t.id);
    const fee_plans = feePlansT.has(t.id);
    const attendance_started = attT.has(t.id);
    const first_payment = paymentsT.has(t.id) || invPaidT.has(t.id);
    const website_published = websiteT.has(t.id);

    const steps = [
      import_completed,
      studentActivationPct >= 40,
      parentActivationPct >= 30 || activatedPush >= 3,
      coach_setup,
      fee_plans,
      attendance_started,
      first_payment,
      website_published,
    ];
    const completion_pct = Math.round((steps.filter(Boolean).length / steps.length) * 100);

    return {
      tenant_id: t.id,
      tenant_name: t.name,
      slug: t.slug,
      import_completed,
      student_activation_pct: studentActivationPct,
      parent_activation_pct: parentActivationPct,
      coach_setup,
      fee_plans,
      attendance_started,
      first_payment,
      website_published,
      completion_pct,
    };
  });
}

// ---------------------------------------------------------------------------
// Platform analytics — DAA / WAA / MAA, DAU, growth, delivery volumes.
// ---------------------------------------------------------------------------
export interface PlatformAnalytics {
  daa: number; // daily active academies (attendance today)
  waa: number; // weekly
  maa: number; // monthly
  student_growth_30d: number;
  student_growth_7d: number;
  automation_executions_30d: number;
  automation_failures_30d: number;
  notification_volume_30d: number;
  notification_delivered_7d: number;
  notification_failed_7d: number;
  push_success_pct: number;
  campaigns_30d: number;
}

export function computePlatformAnalytics(s: IntelligenceSnapshot): PlatformAnalytics {
  const dayMs = now() - DAY_MS;
  const weekMs = now() - 7 * DAY_MS;
  const daa = new Set(s.attendance30d.filter((a) => new Date(a.created_at).getTime() >= dayMs).map((a) => a.tenant_id)).size;
  const waa = new Set(s.attendance30d.filter((a) => new Date(a.created_at).getTime() >= weekMs).map((a) => a.tenant_id)).size;
  const maa = new Set(s.attendance30d.map((a) => a.tenant_id)).size;
  const d30 = now() - 30 * DAY_MS;
  const d7 = now() - 7 * DAY_MS;
  const growth30 = s.students.filter((st) => new Date(st.created_at).getTime() >= d30).length;
  const growth7 = s.students.filter((st) => new Date(st.created_at).getTime() >= d7).length;
  const autFailures = s.automation30d.filter((a) => a.status === "failed").length;
  const delivered = s.notifDeliveries7d.filter((d) => d.status === "delivered" || d.status === "sent").length;
  const failed = s.notifDeliveries7d.filter((d) => d.status === "failed" || d.status === "error").length;
  const total = delivered + failed;
  return {
    daa,
    waa,
    maa,
    student_growth_30d: growth30,
    student_growth_7d: growth7,
    automation_executions_30d: s.automation30d.length,
    automation_failures_30d: autFailures,
    notification_volume_30d: s.notifications30d.length,
    notification_delivered_7d: delivered,
    notification_failed_7d: failed,
    push_success_pct: total > 0 ? Math.round((delivered / total) * 100) : 0,
    campaigns_30d: s.campaigns.filter((c) => new Date(c.created_at).getTime() >= d30).length,
  };
}

// ---------------------------------------------------------------------------
// Daily Founder Brief — plain-language bullets derived from all of the above.
// ---------------------------------------------------------------------------
export interface FounderBriefItem {
  kind: "positive" | "neutral" | "warning" | "critical";
  message: string;
}

export function computeDailyBrief(
  kpis: ExecutiveKpis,
  health: TenantHealth[],
  analytics: PlatformAnalytics,
): FounderBriefItem[] {
  const brief: FounderBriefItem[] = [];
  if (kpis.new_academies_7d > 0)
    brief.push({ kind: "positive", message: `${kpis.new_academies_7d} new academies this week` });
  if (analytics.student_growth_7d > 0)
    brief.push({ kind: "positive", message: `${analytics.student_growth_7d} new students onboarded (7d)` });
  const failedInvoices = kpis.total_revenue_90d === 0 ? 0 : 0; // deliberate — payment failures are surfaced below
  void failedInvoices;
  const critical = health.filter((h) => h.band === "critical").length;
  if (critical > 0)
    brief.push({ kind: "critical", message: `${critical} ${critical === 1 ? "academy is" : "academies are"} in critical health` });
  const inactive10 = health.filter((h) => h.factors.days_inactive >= 10).length;
  if (inactive10 > 0)
    brief.push({ kind: "warning", message: `${inactive10} ${inactive10 === 1 ? "academy" : "academies"} inactive 10+ days` });
  if (kpis.renewals_due_7d > 0)
    brief.push({ kind: "neutral", message: `${kpis.renewals_due_7d} renewals due in the next 7 days` });
  if (analytics.push_success_pct > 0)
    brief.push({
      kind: analytics.push_success_pct >= 90 ? "positive" : "warning",
      message: `${analytics.push_success_pct}% push delivery (7d)`,
    });
  if (analytics.automation_failures_30d > 0)
    brief.push({
      kind: "warning",
      message: `${analytics.automation_failures_30d} automation failures (30d)`,
    });
  const highChurn = health.filter((h) => h.churn_risk === "high").length;
  if (highChurn > 0)
    brief.push({ kind: "warning", message: `${highChurn} tenants at HIGH churn risk` });
  if (kpis.received_this_month > 0)
    brief.push({
      kind: "positive",
      message: `₹${kpis.received_this_month.toLocaleString("en-IN")} collected this month`,
    });
  return brief;
}

// ---------------------------------------------------------------------------
// Per-tenant lifecycle timeline (derived from tenant + first-events).
// ---------------------------------------------------------------------------
export interface TenantTimelineEvent {
  kind:
    | "created"
    | "trial_started"
    | "first_student"
    | "first_attendance"
    | "first_payment"
    | "parent_activated"
    | "coach_added"
    | "website_published"
    | "subscription_renewed";
  label: string;
  at: string | null;
}

export function computeTenantTimeline(
  s: IntelligenceSnapshot,
  tenantId: string,
): TenantTimelineEvent[] {
  const tenant = s.tenants.find((t) => t.id === tenantId);
  if (!tenant) return [];
  const min = <T extends { created_at: string }>(rows: T[]): string | null => {
    let best: string | null = null;
    for (const r of rows) {
      if (!best || r.created_at < best) best = r.created_at;
    }
    return best;
  };
  const students = s.students.filter((x) => x.tenant_id === tenantId);
  const atts = s.attendance30d.filter((x) => x.tenant_id === tenantId);
  const pays = s.payments30d.filter((x) => x.tenant_id === tenantId && x.status === "succeeded");
  const parents = s.profiles.filter((p) => p.tenant_id === tenantId && p.role === "parent");
  const coaches = s.profiles.filter((p) => p.tenant_id === tenantId && p.role === "coach");
  const website = s.website.some((w) => w.tenant_id === tenantId) ? tenant.created_at : null;
  return [
    { kind: "created", label: "Academy created", at: tenant.created_at },
    {
      kind: "trial_started",
      label: "Trial started",
      at: tenant.subscription_status === "trial" ? tenant.created_at : null,
    },
    { kind: "first_student", label: "First student added", at: min(students) },
    { kind: "first_attendance", label: "First attendance recorded", at: min(atts) },
    { kind: "first_payment", label: "First payment received", at: min(pays) },
    { kind: "parent_activated", label: "First parent joined", at: min(parents) },
    { kind: "coach_added", label: "First coach added", at: min(coaches) },
    { kind: "website_published", label: "Website published", at: website },
    {
      kind: "subscription_renewed",
      label: "Last renewal",
      at: tenant.last_paid_date ?? null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Founder alerts — derived from health + analytics.
// ---------------------------------------------------------------------------
export interface FounderAlert {
  severity: "info" | "warning" | "critical";
  tenant_id?: string;
  tenant_name?: string;
  category:
    | "inactive"
    | "subscription_expiring"
    | "attendance_stopped"
    | "payment_failures"
    | "automation_failures"
    | "push_failures"
    | "parent_activation_low"
    | "health_critical";
  message: string;
}

export function computeFounderAlerts(
  s: IntelligenceSnapshot,
  health: TenantHealth[],
): FounderAlert[] {
  const alerts: FounderAlert[] = [];
  for (const h of health) {
    if (h.factors.days_inactive >= 14) {
      alerts.push({
        severity: "warning",
        tenant_id: h.tenant_id,
        tenant_name: h.tenant_name,
        category: "inactive",
        message: `${h.tenant_name} inactive ${h.factors.days_inactive} days`,
      });
    }
    if (h.factors.attendance_usage === 0) {
      alerts.push({
        severity: "warning",
        tenant_id: h.tenant_id,
        tenant_name: h.tenant_name,
        category: "attendance_stopped",
        message: `${h.tenant_name} has no attendance in 30d`,
      });
    }
    if (h.factors.parent_activation < 20) {
      alerts.push({
        severity: "info",
        tenant_id: h.tenant_id,
        tenant_name: h.tenant_name,
        category: "parent_activation_low",
        message: `${h.tenant_name} parent activation ${h.factors.parent_activation}%`,
      });
    }
    if (h.band === "critical") {
      alerts.push({
        severity: "critical",
        tenant_id: h.tenant_id,
        tenant_name: h.tenant_name,
        category: "health_critical",
        message: `${h.tenant_name} health critical (${h.score}/100)`,
      });
    }
  }
  const failedPayments = s.payments30d.filter((p) => p.status === "failed").length;
  if (failedPayments > 0)
    alerts.push({
      severity: "warning",
      category: "payment_failures",
      message: `${failedPayments} payment failures in the last 30 days`,
    });
  const failedAut = s.automation30d.filter((a) => a.status === "failed").length;
  if (failedAut > 0)
    alerts.push({
      severity: "info",
      category: "automation_failures",
      message: `${failedAut} automation failures in the last 30 days`,
    });
  const failedDelivery = s.notifDeliveries7d.filter(
    (d) => d.status === "failed" || d.status === "error",
  ).length;
  if (failedDelivery > 5)
    alerts.push({
      severity: "warning",
      category: "push_failures",
      message: `${failedDelivery} notification delivery failures (7d)`,
    });
  // Subscription expiring — active tenants whose next due date is within 7d.
  const in7 = now() + 7 * DAY_MS;
  for (const t of s.tenants.filter((tt) => tt.status === "active" && tt.last_paid_date)) {
    const nextDue = new Date(t.last_paid_date!).getTime() + 30 * DAY_MS;
    if (nextDue >= now() && nextDue <= in7) {
      alerts.push({
        severity: "info",
        tenant_id: t.id,
        tenant_name: t.name,
        category: "subscription_expiring",
        message: `${t.name} subscription renews in ${Math.ceil((nextDue - now()) / DAY_MS)} days`,
      });
    }
  }
  return alerts;
}

// ---------------------------------------------------------------------------
// Public query hook helpers — bind everything to one snapshot per session.
// ---------------------------------------------------------------------------
export const founderKeys = {
  snapshot: ["founder", "snapshot"] as const,
};
