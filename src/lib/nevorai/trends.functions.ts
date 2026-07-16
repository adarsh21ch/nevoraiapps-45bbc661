/**
 * NevorAI Smart Insights — detects trends across attendance, revenue,
 * admissions and fee collection by comparing the last 7 days against the
 * prior 7 days. Reads existing tables only.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrendDirection = "up" | "down" | "flat";

export type SmartInsight = {
  id: string;
  title: string;
  metric: string;
  direction: TrendDirection;
  delta: string;
  recommendation: { label: string; href: string };
};

function pct(curr: number, prev: number): { delta: string; dir: TrendDirection } {
  if (prev === 0 && curr === 0) return { delta: "0%", dir: "flat" };
  if (prev === 0) return { delta: "new", dir: "up" };
  const p = ((curr - prev) / prev) * 100;
  const dir: TrendDirection = Math.abs(p) < 2 ? "flat" : p > 0 ? "up" : "down";
  return { delta: `${p > 0 ? "+" : ""}${p.toFixed(0)}%`, dir };
}

export const getSmartInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmartInsight[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.tenant_id) return [];
    const tenantId = profile.tenant_id;

    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const d14 = new Date(now.getTime() - 14 * 86400_000).toISOString();

    const [payThis, payPrev, regThis, regPrev, attThis, attPrev] = await Promise.all([
      context.supabase.from("payments").select("amount").eq("tenant_id", tenantId).gte("created_at", d7),
      context.supabase.from("payments").select("amount").eq("tenant_id", tenantId).gte("created_at", d14).lt("created_at", d7),
      context.supabase.from("registrations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", d7),
      context.supabase.from("registrations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", d14).lt("created_at", d7),
      context.supabase.from("attendance_marks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "present").gte("created_at", d7),
      context.supabase.from("attendance_marks").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "present").gte("created_at", d14).lt("created_at", d7),
    ]);

    const revThis = (payThis.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const revPrev = (payPrev.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const rev = pct(revThis, revPrev);
    const reg = pct(regThis.count ?? 0, regPrev.count ?? 0);
    const att = pct(attThis.count ?? 0, attPrev.count ?? 0);

    return [
      {
        id: "revenue-trend",
        title: "Revenue (7-day)",
        metric: `${revThis.toLocaleString("en-IN")}`,
        direction: rev.dir,
        delta: rev.delta,
        recommendation: {
          label: rev.dir === "down" ? "Send Fee Reminder" : "Open Fees",
          href: "/dashboard/fees",
        },
      },
      {
        id: "admission-trend",
        title: "New admissions (7-day)",
        metric: `${regThis.count ?? 0}`,
        direction: reg.dir,
        delta: reg.delta,
        recommendation: { label: "Review Admissions", href: "/dashboard/students" },
      },
      {
        id: "attendance-trend",
        title: "Attendance (7-day)",
        metric: `${attThis.count ?? 0}`,
        direction: att.dir,
        delta: att.delta,
        recommendation: { label: "Open Attendance", href: "/dashboard/attendance" },
      },
    ];
  });
