/**
 * NevorAI Daily Brief + Quick Insights.
 *
 * Composes existing helpers only — no new business logic. Runs as a
 * server function so we do not fan out five Supabase round-trips from
 * the browser every time the owner opens the AI panel.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuickInsight = {
  id: string;
  label: string;
  value: string;
  tone?: "default" | "positive" | "warning" | "danger";
  href?: string;
};

export type DailyBrief = {
  generatedAt: string;
  headline: string;
  sections: Array<{ id: string; title: string; body: string }>;
  insights: QuickInsight[];
  recommendations: string[];
};

async function buildBriefForTenant(tenantId: string): Promise<DailyBrief> {
  const [{ fetchKpis }, { fetchAttendanceToday }, { fetchDashboardInsights }, { studentDue, tenantFeeCycle, getPaidPeriodSet, periodKey }] =
    await Promise.all([
      import("@/lib/dashboard-queries"),
      import("@/lib/attendance/queries"),
      import("@/lib/dashboard-queries"),
      import("@/lib/fees"),
    ]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (!tenant) throw new Error("Tenant not found");

  const [kpis, attendance, insights, studentsRes, allPayments] = await Promise.all([
    fetchKpis(tenant as never, supabaseAdmin).catch(() => null),
    fetchAttendanceToday(tenantId, supabaseAdmin).catch(() => []),
    fetchDashboardInsights(tenantId, supabaseAdmin).catch(() => null),
    supabaseAdmin
      .from("students")
      .select("id, joined_at, custom_fee, gender, fee_plans!inner(amount, female_amount, type)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("fee_plans.type", "monthly"),
    supabaseAdmin
      .from("payments")
      .select("student_id, period, type")
      .eq("tenant_id", tenantId),
  ]);


  let present = 0;
  let absent = 0;
  let inAcademy = 0;
  for (const r of attendance) {
    if (r.current_state === "in_academy") inAcademy++;
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
  }

  const paidByStudent = getPaidPeriodSet((allPayments?.data ?? []) as any);
  let overdue = 0;
  let outstanding = 0;

  for (const s of (studentsRes?.data ?? []) as any) {
    const due = studentDue({
      cycle: tenantFeeCycle(tenant as any),
      joinedAt: s.joined_at,
      selectedMonth: new Date(),
      paidPeriods: paidByStudent.get(s.id) ?? new Set(),
    });
    if (due.state === "pending") {
      outstanding++;
      if (due.overdueDays > 0) overdue++;
    }
  }
  const collected = kpis?.collectionThisMonth ?? 0;
  const activeStudents = kpis?.activeStudents ?? 0;


  const insightsList: QuickInsight[] = [
    {
      id: "attendance",
      label: "In academy right now",
      value: `${inAcademy}`,
      tone: "positive",
      href: "/dashboard/attendance",
    },
    {
      id: "absent-today",
      label: "Absent today",
      value: `${absent}`,
      tone: absent > 0 ? "warning" : "default",
      href: "/dashboard/attendance",
    },
    {
      id: "active-students",
      label: "Active students",
      value: `${activeStudents}`,
      href: "/dashboard/students",
    },
    {
      id: "collected",
      label: "Collected this month",
      value: String(collected),
      tone: "positive",
      href: "/dashboard/billing",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: String(outstanding),
      tone: outstanding > 0 ? "warning" : "default",
      href: "/dashboard/fees",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: String(overdue),
      tone: overdue > 0 ? "danger" : "default",
      href: "/dashboard/fees",
    },
  ];

  const recommendations: string[] = [];
  if (overdue > 0) recommendations.push(`Send fee reminders — ${overdue} invoices are overdue.`);
  if (absent > 0) recommendations.push(`Follow up on ${absent} absent student${absent > 1 ? "s" : ""}.`);
  if (outstanding > 0 && overdue === 0)
    recommendations.push(`Nudge ${outstanding} outstanding invoice${outstanding > 1 ? "s" : ""} before the next cycle.`);
  if (recommendations.length === 0) recommendations.push("Everything looks healthy today. Consider planning next week's batches.");

  const sections: DailyBrief["sections"] = [
    {
      id: "attendance",
      title: "Attendance",
      body: `${present} present, ${absent} absent, ${inAcademy} currently in the academy.`,
    },
    {
      id: "revenue",
      title: "Revenue",
      body: `Collected ${collected} this month · outstanding ${outstanding} · overdue ${overdue}.`,
    },
    {
      id: "growth",
      title: "Growth",
      body: insights
        ? `Tracking ${activeStudents} active students across the roll.`
        : `${activeStudents} active students on the roll.`,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    headline: overdue > 0
      ? `Good morning — ${overdue} invoice${overdue > 1 ? "s are" : " is"} overdue.`
      : "Good morning — the academy is on track.",
    sections,
    insights: insightsList,
    recommendations,
  };
}

export const getDailyBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyBrief> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return {
        generatedAt: new Date().toISOString(),
        headline: "Set up your academy to unlock daily briefs.",
        sections: [],
        insights: [],
        recommendations: [],
      };
    }

    const [{ data: isOwner }, { data: isPlatform }] = await Promise.all([
      context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _tenant_id: profile.tenant_id,
        _role: "owner",
      }),
      context.supabase.rpc("is_platform_admin", { _uid: context.userId }),
    ]);

    if (!isOwner && !isPlatform) {
      throw new Error("Forbidden: Daily brief is restricted to owners");
    }

    return buildBriefForTenant(profile.tenant_id);
  });
