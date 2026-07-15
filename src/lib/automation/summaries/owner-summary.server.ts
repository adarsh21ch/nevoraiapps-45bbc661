/**
 * Owner Summary aggregator — server-only.
 *
 * Computes per-tenant metrics across attendance, admissions, leads, fees,
 * matches, tournaments, and system health for daily / weekly / monthly
 * cadences. Uses the admin client under RLS-bypass because it runs from the
 * `owner-summaries` cron hook.
 *
 * Read-only. Emits nothing — the caller feeds the result into the
 * Automation Engine via a `daily.summary` / `weekly.summary` / `monthly.summary`
 * event.
 */

export type SummaryCadence = "daily" | "weekly" | "monthly";

export interface OwnerSummary {
  tenantId: string;
  cadence: SummaryCadence;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  attendance: {
    present: number;
    absent: number;
    lateCheckIns: number;
    lateCheckOuts: number;
    newAdmissions: number;
    newLeads: number;
  };
  fees: {
    collected: number;
    pending: number;
    overdue: number;
    payments: number;
  };
  business: {
    totalRevenue: number;
    todaysRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
  };
  matches: {
    played: number;
    scheduled: number;
    live: number;
    upcoming: number;
  };
  tournaments: {
    upcoming: number;
    active: number;
    completed: number;
  };
  system: {
    automationErrors: number;
    failedNotifications: number;
    successfulNotifications: number;
    newParentRegistrations: number;
    newDevices: number;
  };
  /** Template vars flattened for the push template renderer. */
  templateVars: {
    Present: string;
    Absent: string;
    Collected: string;
    Pending: string;
  };
  /** Compact multi-line body suitable for the in-app notification. */
  bodyLines: string[];
  /** True when the summary is non-empty and worth delivering. */
  meaningful: boolean;
}

function fmtInr(n: number): string {
  try {
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function cadenceWindow(cadence: SummaryCadence, now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  const start = new Date(now);
  if (cadence === "daily") {
    start.setDate(start.getDate() - 1);
  } else if (cadence === "weekly") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

async function sumColumn(
  admin: AdminClient,
  table: string,
  column: string,
  build: (q: unknown) => unknown,
): Promise<number> {
  try {
    const q = admin.from(table).select(column);
    const rows = (await (build(q) as unknown as Promise<{ data: unknown; error: unknown }>)) as {
      data: unknown;
      error: unknown;
    };
    if (rows.error) return 0;
    const arr = (rows.data as Array<Record<string, unknown>> | null) ?? [];
    let total = 0;
    for (const r of arr) {
      const v = r?.[column];
      if (typeof v === "number") total += v;
      else if (typeof v === "string") total += Number(v) || 0;
    }
    return total;
  } catch {
    return 0;
  }
}



export async function computeOwnerSummary(
  tenantId: string,
  cadence: SummaryCadence,
  now: Date = new Date(),
): Promise<OwnerSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { start, end } = cadenceWindow(cadence, now);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);

  // ---------- Attendance ----------
  const [present, absent, lateIn, lateOut, newAdmissions, newLeads] = await Promise.all([
    countRows(supabaseAdmin, "attendance_marks", (q) =>
      (q as never as {
        eq: (c: string, v: unknown) => unknown;
      })
        .eq("tenant_id", tenantId) as never as {
          eq: (c: string, v: unknown) => unknown;
        },
    ).then(async () => {
      const { count } = await supabaseAdmin
        .from("attendance_marks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "present")
        .gte("check_in_at", startIso)
        .lte("check_in_at", endIso);
      return count ?? 0;
    }),
    (async () => {
      const { count } = await supabaseAdmin
        .from("attendance_marks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "absent")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("attendance_marks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "late")
        .gte("check_in_at", startIso)
        .lte("check_in_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      // No dedicated late-checkout status; count check_outs after 20:00 as a proxy.
      const { data } = await supabaseAdmin
        .from("attendance_marks")
        .select("check_out_at")
        .eq("tenant_id", tenantId)
        .gte("check_out_at", startIso)
        .lte("check_out_at", endIso)
        .not("check_out_at", "is", null);
      return (data ?? []).filter((r) => {
        const t = r.check_out_at ? new Date(r.check_out_at) : null;
        return t ? t.getHours() >= 20 : false;
      }).length;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
  ]);

  // ---------- Fees ----------
  const [collected, paymentsCount, pending, overdue, totalRevenue, todaysRevenue, weekRevenue, monthRevenue] =
    await Promise.all([
      sumColumn(supabaseAdmin, "billing_payments", "amount", (q) =>
        (
          q as never as {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => {
                gte: (c: string, v: unknown) => { lte: (c: string, v: unknown) => unknown };
              };
            };
          }
        )
          .eq("tenant_id", tenantId)
          .eq("status", "succeeded")
          .gte("collected_at", startIso)
          .lte("collected_at", endIso),
      ),
      (async () => {
        const { count } = await supabaseAdmin
          .from("billing_payments")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("status", "succeeded")
          .gte("collected_at", startIso)
          .lte("collected_at", endIso);
        return count ?? 0;
      })(),
      sumColumn(supabaseAdmin, "billing_invoices", "balance", (q) =>
        (
          q as never as {
            eq: (c: string, v: unknown) => {
              in: (c: string, v: unknown[]) => unknown;
            };
          }
        )
          .eq("tenant_id", tenantId)
          .in("status", ["open", "partial", "overdue"]),
      ),
      sumColumn(supabaseAdmin, "billing_invoices", "balance", (q) =>
        (
          q as never as {
            eq: (c: string, v: unknown) => {
              eq: (c: string, v: unknown) => unknown;
            };
          }
        )
          .eq("tenant_id", tenantId)
          .eq("status", "overdue"),
      ),
      sumColumn(supabaseAdmin, "billing_payments", "amount", (q) =>
        (
          q as never as {
            eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => unknown };
          }
        )
          .eq("tenant_id", tenantId)
          .eq("status", "succeeded"),
      ),
      (async () => {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        return sumColumn(supabaseAdmin, "billing_payments", "amount", (q) =>
          (
            q as never as {
              eq: (c: string, v: unknown) => {
                eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => unknown };
              };
            }
          )
            .eq("tenant_id", tenantId)
            .eq("status", "succeeded")
            .gte("collected_at", dayStart.toISOString()),
        );
      })(),
      (async () => {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        return sumColumn(supabaseAdmin, "billing_payments", "amount", (q) =>
          (
            q as never as {
              eq: (c: string, v: unknown) => {
                eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => unknown };
              };
            }
          )
            .eq("tenant_id", tenantId)
            .eq("status", "succeeded")
            .gte("collected_at", weekStart.toISOString()),
        );
      })(),
      (async () => {
        const monthStart = new Date(now);
        monthStart.setDate(monthStart.getDate() - 30);
        return sumColumn(supabaseAdmin, "billing_payments", "amount", (q) =>
          (
            q as never as {
              eq: (c: string, v: unknown) => {
                eq: (c: string, v: unknown) => { gte: (c: string, v: unknown) => unknown };
              };
            }
          )
            .eq("tenant_id", tenantId)
            .eq("status", "succeeded")
            .gte("collected_at", monthStart.toISOString()),
        );
      })(),
    ]);

  // ---------- Matches ----------
  const [matchesPlayed, matchesScheduled, matchesLive, matchesUpcoming] = await Promise.all([
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_matches")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_matches")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "scheduled");
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_matches")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "live");
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_matches")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "scheduled")
        .gte("scheduled_date", endDate);
      return count ?? 0;
    })(),
  ]);

  // ---------- Tournaments ----------
  const [tourUpcoming, tourActive, tourCompleted] = await Promise.all([
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_tournaments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "upcoming");
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_tournaments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_progress", "live"]);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("mc_tournaments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("end_date", startDate)
        .lte("end_date", endDate);
      return count ?? 0;
    })(),
  ]);

  // ---------- System ----------
  const [automationErrors, failedNotifs, successfulNotifs, newDevices] = await Promise.all([
    (async () => {
      const { count } = await supabaseAdmin
        .from("automation_executions")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "failed")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("automation_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("channel", "push")
        .eq("status", "failed")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("automation_deliveries")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("channel", "push")
        .in("status", ["sent", "delivered"])
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
    (async () => {
      const { count } = await supabaseAdmin
        .from("push_devices")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      return count ?? 0;
    })(),
  ]);

  // Parent registrations = distinct user_ids from push_devices with role parent — proxy: newDevices
  const newParentRegistrations = newDevices;

  const summary: OwnerSummary = {
    tenantId,
    cadence,
    windowStart: startIso,
    windowEnd: endIso,
    attendance: {
      present,
      absent,
      lateCheckIns: lateIn,
      lateCheckOuts: lateOut,
      newAdmissions,
      newLeads,
    },
    fees: { collected, pending, overdue, payments: paymentsCount },
    business: {
      totalRevenue,
      todaysRevenue,
      weekRevenue,
      monthRevenue,
    },
    matches: {
      played: matchesPlayed,
      scheduled: matchesScheduled,
      live: matchesLive,
      upcoming: matchesUpcoming,
    },
    tournaments: {
      upcoming: tourUpcoming,
      active: tourActive,
      completed: tourCompleted,
    },
    system: {
      automationErrors,
      failedNotifications: failedNotifs,
      successfulNotifications: successfulNotifs,
      newParentRegistrations,
      newDevices,
    },
    templateVars: {
      Present: String(present),
      Absent: String(absent),
      Collected: fmtInr(collected).replace(/^₹/, ""),
      Pending: fmtInr(pending),
    },
    bodyLines: [],
    meaningful: false,
  };

  // Build compact body (skip empty sections)
  const lines: string[] = [];
  if (present || absent) lines.push(`Present: ${present} · Absent: ${absent}`);
  if (lateIn) lines.push(`Late check-ins: ${lateIn}`);
  if (collected) lines.push(`Collected: ${fmtInr(collected)}`);
  if (pending) lines.push(`Pending: ${fmtInr(pending)}`);
  if (overdue) lines.push(`Overdue: ${fmtInr(overdue)}`);
  if (matchesPlayed || matchesLive) lines.push(`Matches: ${matchesPlayed} played · ${matchesLive} live`);
  if (newAdmissions) lines.push(`New students: ${newAdmissions}`);
  if (newLeads) lines.push(`New leads: ${newLeads}`);
  if (automationErrors) lines.push(`⚠︎ Automation errors: ${automationErrors}`);
  summary.bodyLines = lines;
  summary.meaningful =
    lines.length > 0 ||
    present > 0 ||
    collected > 0 ||
    matchesPlayed > 0 ||
    newAdmissions > 0 ||
    newLeads > 0;
  return summary;
}
