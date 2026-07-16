/**
 * Tool definitions — read-only summaries wired to existing services.
 *
 * PHASE 11.3 scope: every read tool is wired to an existing helper —
 * no raw DB queries, no new business logic. Write tools still go
 * through the confirmation gate (Phase 11.1 orchestrator).
 *
 * Every helper we reuse is imported dynamically so the AI bundle does
 * not pull the entire dashboard graph into non-AI code paths.
 */

import type { AIContext } from "../context/types";
import type { AnyToolDef, ToolResult } from "./types";

/** Empty-object JSON schema, used by tools that take no input. */
const emptySchema = { type: "object", properties: {}, additionalProperties: false } as const;

/** JSON schema for `{ studentId: string }`. */
const studentIdSchema = {
  type: "object",
  properties: { studentId: { type: "string", description: "Target student id" } },
  required: ["studentId"],
  additionalProperties: false,
} as const;

const invoiceIdSchema = {
  type: "object",
  properties: { invoiceId: { type: "string" } },
  required: ["invoiceId"],
  additionalProperties: false,
} as const;

const limitSchema = {
  type: "object",
  properties: {
    limit: { type: "number", description: "Max rows to return (1-50)." },
  },
  additionalProperties: false,
} as const;

/**
 * Return the Supabase client tools should read through: the per-request
 * client attached to `AIContext` (RLS-scoped to the caller) when set, or
 * the browser singleton as a legacy fallback for in-tab use.
 */
async function dbFor(ctx: AIContext) {
  if (ctx.dataClient) return ctx.dataClient;
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

/** Load the tenant row via the same query dashboard uses. */
async function loadTenant(tenantId: string, ctx: AIContext) {
  const db = await dbFor(ctx);
  const { data } = await db.from("tenants").select("*").eq("id", tenantId).maybeSingle();
  return data;
}


/** Resolve the student id a caller is allowed to inspect. */
function resolveStudentId(input: unknown, ctx: AIContext): string | null {
  const requested =
    (input && typeof input === "object" && "studentId" in input && typeof (input as { studentId: unknown }).studentId === "string"
      ? ((input as { studentId: string }).studentId)
      : undefined) ??
    ctx.selectedStudentId ??
    ctx.selectedChildId ??
    null;
  if (!requested) return null;
  // Parents may only ever see their linked child; students may only see themselves.
  if (ctx.role === "parent" && ctx.selectedChildId && requested !== ctx.selectedChildId) return null;
  if (ctx.role === "student" && requested !== ctx.userId) return null;
  return requested;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

export const dashboardSummaryTool: AnyToolDef = {
  name: "dashboard_summary",
  description: "Return the top-level KPIs for the current tenant (students, fees, attendance).",
  category: "dashboard",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    const db = await dbFor(ctx);
    const tenant = await loadTenant(ctx.tenantId, ctx);
    if (!tenant) return { ok: false, reason: "not_found", message: "Tenant not found", code: "TENANT_NOT_FOUND" };
    const { fetchKpis } = await import("@/lib/dashboard-queries");
    const kpis = await fetchKpis(tenant as never, db);
    return {
      ok: true,
      title: "Academy snapshot",
      summary: `${kpis.activeStudents ?? 0} active students`,
      data: kpis,
      structured_data: kpis,
      citations: ["src/lib/dashboard-queries.ts#fetchKpis"],
      recommended_actions: [
        { id: "open-students", label: "Open students", href: "/dashboard/students" },
        { id: "open-fees", label: "Open fees", href: "/dashboard/fees" },
      ],
    };
  },
};


/* ------------------------------------------------------------------ */
/* Finance                                                            */
/* ------------------------------------------------------------------ */

export const financeSummaryTool: AnyToolDef = {
  name: "finance_summary",
  description: "Return billing KPIs (collected, outstanding, overdue) for the tenant.",
  category: "finance",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    // Phase 2 fix: read from the same helper the dashboard home + fees screens
    // use (legacy `payments` table). `fetchBillingKpis` reads Billing V2 tables
    // which are empty in production — kept in `src/lib/billing.ts` for future
    // Billing V2 use but no longer wired here.
    const db = await dbFor(ctx);
    const tenant = await loadTenant(ctx.tenantId, ctx);
    if (!tenant) return { ok: false, reason: "not_found", message: "Tenant not found", code: "TENANT_NOT_FOUND" };
    const { fetchKpis } = await import("@/lib/dashboard-queries");
    const kpis = await fetchKpis(tenant as never, db);
    const data = {
      collectedThisMonth: kpis.collectionThisMonth,
      // Legacy `payments` has no rupee-outstanding source; the dashboard shows a
      // COUNT of students with pending fees this period. Surface that count
      // under `outstanding` so the tool preserves its field shape.
      outstanding: kpis.pendingFeeCount,
      openInvoices: kpis.pendingFeeCount,
      overdue: kpis.pendingFeeCount,
    };
    return {
      ok: true,
      title: "Billing snapshot",
      summary: `Collected ${data.collectedThisMonth ?? 0} this month · ${data.outstanding ?? 0} student(s) with pending fees`,
      data,
      structured_data: data,
      citations: ["src/lib/dashboard-queries.ts#fetchKpis"],
      recommended_actions: [
        { id: "open-fees", label: "Open fees", href: "/dashboard/fees" },
      ],
    };
  },
};

export const feeSummaryTool: AnyToolDef = {
  name: "fee_summary",
  description: "Return the fee/payment status for a specific student.",
  category: "finance",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin", "parent", "student"],
  async execute(input, ctx): Promise<ToolResult> {
    const studentId = resolveStudentId(input, ctx);
    if (!studentId) {
      return { ok: false, reason: "forbidden", code: "STUDENT_SCOPE_DENIED", message: "No accessible student for this caller." };
    }
    const db = await dbFor(ctx);
    const [{ fetchStudent, fetchStudentPayments }, tenant] = await Promise.all([
      import("@/lib/dashboard-queries"),
      loadTenant(ctx.tenantId, ctx),
    ]);
    const student = await fetchStudent(studentId, db);
    if (!student || (student as { tenant_id?: string }).tenant_id !== ctx.tenantId) {
      return { ok: false, reason: "not_found", code: "STUDENT_NOT_FOUND", message: "Student not found for this tenant." };
    }
    const payments = await fetchStudentPayments(studentId, db);
    const { studentDue, tenantFeeCycle, periodKey, candidatePeriods } = await import("@/lib/fees");
    let due: unknown = null;
    if (tenant) {
      const cycle = tenantFeeCycle(tenant as never);
      const now = new Date();
      const paidPeriods = new Set<string>();
      for (const p of (payments ?? []) as Array<{ period: string | null }>) {
        if (p.period) paidPeriods.add(p.period);
      }
      const joinedAt = (student as { joined_at?: string }).joined_at;
      if (joinedAt) {
        // For calendar_month: check current month. For joining_date: engine uses joiningCycleDue internally.
        const selectedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        due = studentDue({ cycle, joinedAt, selectedMonth, paidPeriods });
        void candidatePeriods; // silence unused import warnings
        void periodKey;
      }
    }
    const dueState = due && typeof due === "object" && "state" in due
      ? (due as { state: string }).state
      : "unknown";
    return {
      ok: true,
      title: "Fee status",
      summary: `Status: ${dueState}`,
      data: { student, payments, due },
      structured_data: { due, paymentCount: payments?.length ?? 0 },
      citations: [
        "src/lib/dashboard-queries.ts#fetchStudent",
        "src/lib/dashboard-queries.ts#fetchStudentPayments",
        "src/lib/fees.ts#studentDue",
      ],
    };
  },
};

export const invoiceDetailsTool: AnyToolDef = {
  name: "invoice_details",
  description: "Fetch a single invoice with its lines and payments.",
  category: "finance",
  parameters: invoiceIdSchema,
  allowedRoles: ["owner", "admin"],
  async execute(input, ctx): Promise<ToolResult> {
    const invoiceId =
      (input && typeof input === "object" && "invoiceId" in input && typeof (input as { invoiceId: unknown }).invoiceId === "string"
        ? ((input as { invoiceId: string }).invoiceId)
        : undefined) ?? ctx.selectedInvoiceId;
    if (!invoiceId) {
      return { ok: false, reason: "invalid_input", code: "MISSING_INVOICE_ID", message: "invoiceId is required." };
    }
    const db = await dbFor(ctx);
    const { fetchInvoice, fetchInvoiceLines, fetchPaymentsForInvoice } = await import("@/lib/billing");
    const [invoice, lines, payments] = await Promise.all([
      fetchInvoice(invoiceId, db),
      fetchInvoiceLines(invoiceId, db),
      fetchPaymentsForInvoice(invoiceId, db),
    ]);
    if (!invoice || (invoice as { tenant_id?: string }).tenant_id !== ctx.tenantId) {
      return { ok: false, reason: "not_found", code: "INVOICE_NOT_FOUND", message: "Invoice not found." };
    }
    return {
      ok: true,
      title: "Invoice details",
      summary: `Invoice status: ${(invoice as { status?: string }).status ?? "unknown"}`,
      data: { invoice, lines, payments },
      citations: ["src/lib/billing.ts#fetchInvoice"],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */

export const attendanceSummaryTool: AnyToolDef = {
  name: "attendance_summary",
  description: "Return today's attendance snapshot (present / absent / in-academy counts).",
  category: "attendance",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin", "coach"],
  async execute(_input, ctx): Promise<ToolResult> {
    const db = await dbFor(ctx);
    const { fetchAttendanceToday } = await import("@/lib/attendance/queries");
    const rows = await fetchAttendanceToday(ctx.tenantId, db);
    let present = 0;
    let absent = 0;
    let inAcademy = 0;
    let checkedOut = 0;
    for (const r of rows) {
      if (r.current_state === "in_academy") inAcademy++;
      else if (r.current_state === "checked_out") checkedOut++;
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
    }
    const summary = { present, absent, inAcademy, checkedOut, total: rows.length };
    return {
      ok: true,
      title: "Attendance today",
      summary: `${present} present · ${absent} absent · ${inAcademy} in academy`,
      data: summary,
      structured_data: summary,
      citations: ["src/lib/attendance/queries.ts#fetchAttendanceToday"],
      recommended_actions: [
        { id: "open-attendance", label: "Open attendance", href: "/dashboard/attendance" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Students                                                           */
/* ------------------------------------------------------------------ */

export const playerProfileTool: AnyToolDef = {
  name: "player_profile",
  description: "Return a single player's profile — respects role scoping.",
  category: "students",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin", "coach", "parent", "student"],
  canUse(ctx) {
    if (ctx.role === "parent") return Boolean(ctx.selectedChildId);
    if (ctx.role === "student") return Boolean(ctx.userId);
    return true;
  },
  async execute(input, ctx): Promise<ToolResult> {
    const studentId = resolveStudentId(input, ctx);
    if (!studentId) {
      return { ok: false, reason: "forbidden", code: "STUDENT_SCOPE_DENIED", message: "No accessible student for this caller." };
    }
    const db = await dbFor(ctx);
    const { fetchStudent } = await import("@/lib/dashboard-queries");
    const student = await fetchStudent(studentId, db);
    if (!student || (student as { tenant_id?: string }).tenant_id !== ctx.tenantId) {
      return { ok: false, reason: "not_found", code: "STUDENT_NOT_FOUND", message: "Student not found." };
    }
    return {
      ok: true,
      title: (student as { full_name?: string }).full_name ?? "Player",
      summary: `Status: ${(student as { status?: string }).status ?? "unknown"}`,
      data: student,
      citations: ["src/lib/dashboard-queries.ts#fetchStudent"],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Admissions                                                         */
/* ------------------------------------------------------------------ */

export const admissionsSummaryTool: AnyToolDef = {
  name: "admissions_summary",
  description: "Return the current admissions pipeline (counts per stage).",
  category: "admissions",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    const { leadsPipelineQuery } = await import("@/lib/admissions");
    const q = leadsPipelineQuery(ctx.tenantId);
    const leads = await q.queryFn();
    const byStage: Record<string, number> = {};
    for (const l of leads) {
      const stage = (l as { stage?: string }).stage ?? "unknown";
      byStage[stage] = (byStage[stage] ?? 0) + 1;
    }
    return {
      ok: true,
      title: "Admissions pipeline",
      summary: `${leads.length} leads across ${Object.keys(byStage).length} stages`,
      data: { total: leads.length, byStage },
      structured_data: byStage,
      citations: ["src/lib/admissions.ts#leadsPipelineQuery"],
      recommended_actions: [
        { id: "open-admissions", label: "Open admissions", href: "/dashboard/admissions" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Communications                                                     */
/* ------------------------------------------------------------------ */

export const communicationsSummaryTool: AnyToolDef = {
  name: "communications_summary",
  description: "Return recent broadcast / campaign activity.",
  category: "communications",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    const { campaignsQueryOptions } = await import("@/lib/communications");
    const opts = campaignsQueryOptions(ctx.tenantId);
    const runFn = opts.queryFn as unknown as () => Promise<Array<{ status?: string; created_at?: string }>>;
    const campaigns = (await runFn()) as Array<{ status?: string; created_at?: string }>;
    const byStatus: Record<string, number> = {};
    for (const c of campaigns) {
      const s = c.status ?? "unknown";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return {
      ok: true,
      title: "Communications activity",
      summary: `${campaigns.length} campaigns · ${byStatus.sent ?? 0} sent`,
      data: { total: campaigns.length, byStatus, recent: campaigns.slice(0, 10) },
      structured_data: byStatus,
      citations: ["src/lib/communications.ts#campaignsQueryOptions"],
      recommended_actions: [
        { id: "open-comms", label: "Open communications", href: "/dashboard/communications" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Automation                                                         */
/* ------------------------------------------------------------------ */

export const automationStatusTool: AnyToolDef = {
  name: "automation_status",
  description: "Return recent automation executions (successes / failures / pending).",
  category: "automation",
  parameters: limitSchema,
  allowedRoles: ["owner", "admin"],
  async execute(input, ctx): Promise<ToolResult> {
    const limit = Math.min(
      50,
      Math.max(1, Number((input as { limit?: number } | undefined)?.limit) || 20),
    );
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase
      .from("automation_executions")
      .select("id, status, created_at, rule_id")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { ok: false, reason: "internal", code: "AUTOMATION_READ_FAILED", message: error.message };
    }
    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      const s = (r as { status?: string }).status ?? "unknown";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    return {
      ok: true,
      title: "Automation activity",
      summary: `${rows.length} recent executions`,
      data: { recent: rows, byStatus },
      structured_data: byStatus,
      citations: ["automation_executions (existing table)"],
      recommended_actions: [
        { id: "open-automation", label: "Open automation", href: "/dashboard/automation" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

export const notificationsSummaryTool: AnyToolDef = {
  name: "notifications_summary",
  description: "Return the caller's most recent notifications.",
  category: "notifications",
  parameters: limitSchema,
  async execute(input, ctx): Promise<ToolResult> {
    const limit = Math.min(
      50,
      Math.max(1, Number((input as { limit?: number } | undefined)?.limit) || 15),
    );
    const { supabase } = await import("@/integrations/supabase/client");
    // RLS on `notifications` already scopes to the caller — no manual filter needed
    // beyond ordering + limit.
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, created_at, read_at, kind")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { ok: false, reason: "internal", code: "NOTIFICATIONS_READ_FAILED", message: error.message };
    }
    const rows = data ?? [];
    const unread = rows.filter((n) => !(n as { read_at?: string | null }).read_at).length;
    return {
      ok: true,
      title: "Recent notifications",
      summary: `${rows.length} recent · ${unread} unread`,
      data: rows,
      structured_data: { total: rows.length, unread },
      citations: ["notifications (RLS-scoped)"],
      recommended_actions: [
        { id: "open-notifications", label: "Open notifications", href: "/notifications" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Reports                                                            */
/* ------------------------------------------------------------------ */

export const reportsSummaryTool: AnyToolDef = {
  name: "reports_summary",
  description: "Return recent revenue + insight signals for the tenant.",
  category: "reports",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    const { fetchDashboardInsights } = await import("@/lib/dashboard-queries");
    const insights = await fetchDashboardInsights(ctx.tenantId);
    return {
      ok: true,
      title: "Reports snapshot",
      summary: "Latest revenue trend + engagement signals",
      data: insights,
      structured_data: insights,
      citations: ["src/lib/dashboard-queries.ts#fetchDashboardInsights"],
      recommended_actions: [
        { id: "open-reports", label: "Open reports", href: "/dashboard/reports" },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Subscription                                                       */
/* ------------------------------------------------------------------ */

export const subscriptionStatusTool: AnyToolDef = {
  name: "subscription_status",
  description: "Return the current subscription plan / trial state for the tenant.",
  category: "subscription",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx): Promise<ToolResult> {
    const tenant = await loadTenant(ctx.tenantId, ctx);
    const data = {
      plan: ctx.subscription?.plan ?? (tenant as { subscription_status?: string } | null)?.subscription_status ?? null,
      status: ctx.subscription?.status ?? (tenant as { status?: string } | null)?.status ?? null,
      lastPaidDate: (tenant as { last_paid_date?: string } | null)?.last_paid_date ?? null,
      billingDay: (tenant as { billing_day?: number } | null)?.billing_day ?? null,
    };
    return {
      ok: true,
      title: "Subscription",
      summary: `Plan ${data.plan ?? "unknown"} · ${data.status ?? "unknown"}`,
      data,
      citations: ["tenants (subscription columns)"],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Founder Intelligence (platform admin)                              */
/* ------------------------------------------------------------------ */

export const founderIntelligenceTool: AnyToolDef = {
  name: "founder_intelligence",
  description: "Platform-wide executive KPIs (MRR, ARR, active/paid academies, growth).",
  category: "founder",
  parameters: emptySchema,
  allowedRoles: ["platform_admin"],
  async execute(): Promise<ToolResult> {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: tenants, error } = await supabase.from("tenants").select("*");
    if (error) {
      return { ok: false, reason: "internal", code: "TENANTS_READ_FAILED", message: error.message };
    }
    const { fetchIntelligenceSnapshot, computeExecutiveKpis, computePlatformAnalytics } = await import(
      "@/lib/founder-intelligence"
    );
    const snapshot = await fetchIntelligenceSnapshot((tenants ?? []) as never);
    const kpis = computeExecutiveKpis(snapshot);
    const analytics = computePlatformAnalytics(snapshot);
    return {
      ok: true,
      title: "Platform intelligence",
      summary: `${kpis.active_academies} active academies · MRR ${kpis.mrr}`,
      data: { kpis, analytics },
      structured_data: { kpis, analytics },
      citations: [
        "src/lib/founder-intelligence.ts#fetchIntelligenceSnapshot",
        "src/lib/founder-intelligence.ts#computeExecutiveKpis",
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Write tools — declared with requiresConfirmation.                   */
/* ------------------------------------------------------------------ */

export const sendFeeReminderTool: AnyToolDef = {
  name: "send_fee_reminder",
  description: "Queue a fee reminder for a student. Requires user confirmation.",
  category: "finance",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin"],
  requiresConfirmation: true,
  async execute(input, ctx): Promise<ToolResult> {
    const studentId = resolveStudentId(input, ctx);
    if (!studentId) {
      return { ok: false, reason: "invalid_input", code: "MISSING_STUDENT_ID", message: "studentId is required." };
    }
    // Reuse the same reminder_logs surface that the dashboard "tap to send" uses.
    // The AI never sends the message itself — it only queues the row, which the
    // owner then dispatches.
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("reminder_logs").insert({
      tenant_id: ctx.tenantId,
      student_id: studentId,
      channel: "in_app",
      status: "queued",
      created_by: ctx.userId,
      source: "ai",
    } as never);
    if (error) {
      return { ok: false, reason: "internal", code: "REMINDER_QUEUE_FAILED", message: error.message };
    }
    return {
      ok: true,
      title: "Fee reminder queued",
      summary: "Reminder queued for owner dispatch.",
      data: { studentId },
      citations: ["reminder_logs (existing table used by fee-reminders hook)"],
    };
  },
};

export const READ_TOOLS: AnyToolDef[] = [
  dashboardSummaryTool,
  financeSummaryTool,
  feeSummaryTool,
  invoiceDetailsTool,
  attendanceSummaryTool,
  playerProfileTool,
  admissionsSummaryTool,
  communicationsSummaryTool,
  automationStatusTool,
  notificationsSummaryTool,
  reportsSummaryTool,
  subscriptionStatusTool,
  founderIntelligenceTool,
];

export const WRITE_TOOLS: AnyToolDef[] = [sendFeeReminderTool];

export const ALL_TOOLS: AnyToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];
