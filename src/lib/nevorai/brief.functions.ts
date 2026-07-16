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
  const [{ fetchKpis }, { fetchBillingKpis }, { fetchAttendanceToday }, { fetchDashboardInsights }] =
    await Promise.all([
      import("@/lib/dashboard-queries"),
      import("@/lib/billing"),
      import("@/lib/attendance/queries"),
      import("@/lib/dashboard-queries"),
    ]);

  // Load tenant for fetchKpis (matches its existing signature).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();

  const [kpis, billing, attendance, insights] = await Promise.all([
    tenant ? fetchKpis(tenant as never).catch(() => null) : Promise.resolve(null),
    fetchBillingKpis(tenantId).catch(() => null),
    fetchAttendanceToday(tenantId).catch(() => [] as Awaited<ReturnType<typeof fetchAttendanceToday>>),
    fetchDashboardInsights(tenantId).catch(() => null),
  ]);

  let present = 0;
  let absent = 0;
  let inAcademy = 0;
  for (const r of attendance) {
    if (r.current_state === "in_academy") inAcademy++;
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
  }

  const overdue = billing?.overdue ?? 0;
  const outstanding = billing?.outstanding ?? 0;
  const collected = billing?.collectedThisMonth ?? 0;
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
    return buildBriefForTenant(profile.tenant_id);
  });
