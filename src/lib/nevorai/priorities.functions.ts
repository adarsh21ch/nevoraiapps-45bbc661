/**
 * NevorAI Today's Priorities — a ranked task list derived entirely from
 * existing tables. No new business logic; no side effects.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Priority = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  action: { label: string; href: string };
  score: number;
};

export const getPriorities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Priority[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const tenantId = profile?.tenant_id ?? null;
    if (!tenantId) return [];

    const now = new Date();
    const todayISO = now.toISOString();
    const in7 = new Date(now.getTime() + 7 * 86400_000).toISOString();

    const { countAbsentToday } = await import("@/lib/attendance/queries");
    const [overdueInv, pendingReg, autoFail, subsExp, absentToday] = await Promise.all([
      context.supabase
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["overdue", "past_due"]),
      context.supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pending"),
      context.supabase
        .from("automation_executions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "failed")
        .gte("created_at", new Date(now.getTime() - 24 * 3600_000).toISOString()),
      context.supabase
        .from("billing_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .lte("next_billing_at", in7)
        .gte("next_billing_at", todayISO),
      // Canonical absent-today count — same helper as owner summary/trends.
      countAbsentToday(context.supabase, tenantId, now),
    ]);


    const priorities: Priority[] = [];

    const overdue = overdueInv.count ?? 0;
    if (overdue > 0) {
      priorities.push({
        id: "overdue-invoices",
        severity: "critical",
        title: `${overdue} overdue invoice${overdue > 1 ? "s" : ""}`,
        detail: "Send reminders or record payments to keep collection healthy.",
        action: { label: "Open Fees", href: "/dashboard/fees" },
        score: 100 + overdue,
      });
    }

    const pending = pendingReg.count ?? 0;
    if (pending > 0) {
      priorities.push({
        id: "pending-admissions",
        severity: pending > 5 ? "warning" : "info",
        title: `${pending} admission${pending > 1 ? "s" : ""} awaiting approval`,
        detail: "Review new registrations and assign batches.",
        action: { label: "Review Admissions", href: "/dashboard/students" },
        score: 70 + pending,
      });
    }

    const failed = autoFail.count ?? 0;
    if (failed > 0) {
      priorities.push({
        id: "automation-failures",
        severity: "warning",
        title: `${failed} automation${failed > 1 ? "s" : ""} failed`,
        detail: "Check delivery health and retry failed runs.",
        action: { label: "Open Automation", href: "/dashboard/automation" },
        score: 60 + failed,
      });
    }

    const expiring = subsExp.count ?? 0;
    if (expiring > 0) {
      priorities.push({
        id: "subscriptions-expiring",
        severity: "info",
        title: `${expiring} subscription${expiring > 1 ? "s" : ""} renewing soon`,
        detail: "Notify parents ahead of the next billing cycle.",
        action: { label: "Open Billing", href: "/dashboard/billing" },
        score: 40 + expiring,
      });
    }

    const absent = absentToday.count ?? 0;
    if (absent >= 5) {
      priorities.push({
        id: "attendance-anomaly",
        severity: "warning",
        title: `${absent} absentees today`,
        detail: "Higher than usual — follow up with parents.",
        action: { label: "Open Attendance", href: "/dashboard/attendance" },
        score: 50 + absent,
      });
    }

    priorities.sort((a, b) => b.score - a.score);
    return priorities.slice(0, 8);
  });
