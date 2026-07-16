/**
 * Tool definitions — read-only summaries wired to existing services.
 *
 * PHASE 11.0 scope: schemas + permission gates + wiring stubs. Each
 * `execute` delegates to an existing query helper. No new business
 * logic. Write tools declared here have `requiresConfirmation: true`
 * and are marked as "not-wired" until Phase 11.1 wires the confirmation
 * UI + orchestrator.
 */

import type { AnyToolDef } from "./types";

/** Empty-object JSON schema, used by tools that take no input. */
const emptySchema = { type: "object", properties: {}, additionalProperties: false } as const;

/** JSON schema for `{ studentId: string }`. */
const studentIdSchema = {
  type: "object",
  properties: { studentId: { type: "string", description: "Target student id" } },
  required: ["studentId"],
  additionalProperties: false,
} as const;

export const dashboardSummaryTool: AnyToolDef = {
  name: "dashboard_summary",
  description: "Return the top-level KPIs for the current tenant (students, fees, attendance).",
  category: "dashboard",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx) {
    // Reuse existing helper — do NOT query supabase.from(...) directly.
    const { fetchKpis } = await import("@/lib/dashboard-queries");
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", ctx.tenantId)
      .maybeSingle();
    if (!tenant) return { ok: false, reason: "not_found", message: "tenant not found" };
    const kpis = await fetchKpis(tenant as never);
    return { ok: true, data: kpis };
  },
};

export const financeSummaryTool: AnyToolDef = {
  name: "finance_summary",
  description: "Return billing KPIs (collected, outstanding, overdue) for the tenant.",
  category: "finance",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx) {
    const { fetchBillingKpis } = await import("@/lib/billing");
    const data = await fetchBillingKpis(ctx.tenantId);
    return { ok: true, data };
  },
};

export const attendanceSummaryTool: AnyToolDef = {
  name: "attendance_summary",
  description: "Return today's attendance snapshot for the tenant.",
  category: "attendance",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin", "coach"],
  async execute() {
    // TODO(phase-11.1): wire to `src/lib/attendance/queries.ts` summary helper.
    return { ok: false, reason: "internal", message: "not-wired: attendance summary pending 11.1" };
  },
};

export const playerProfileTool: AnyToolDef = {
  name: "player_profile",
  description: "Return a single player's profile — respects role scoping.",
  category: "students",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin", "coach", "parent", "student"],
  canUse(ctx) {
    // Parents/students may only read their own linked player.
    if (ctx.role === "parent") return Boolean(ctx.selectedChildId);
    if (ctx.role === "student") return Boolean(ctx.userId);
    return true;
  },
  async execute() {
    // TODO(phase-11.1): call existing student profile query with role scoping.
    return { ok: false, reason: "internal", message: "not-wired: player profile pending 11.1" };
  },
};

export const feeSummaryTool: AnyToolDef = {
  name: "fee_summary",
  description: "Return the fee status for a student — for owner/parent/student roles.",
  category: "finance",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin", "parent", "student"],
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: fee summary pending 11.1" };
  },
};

export const founderIntelligenceTool: AnyToolDef = {
  name: "founder_intelligence",
  description: "Platform-wide analytics for the platform admin (tenants, MRR, churn).",
  category: "founder",
  parameters: emptySchema,
  allowedRoles: ["platform_admin"],
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: founder intel pending 11.1" };
  },
};

export const admissionsSummaryTool: AnyToolDef = {
  name: "admissions_summary",
  description: "Return the current admissions pipeline (pending/approved/rejected counts).",
  category: "admissions",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: admissions pending 11.1" };
  },
};

export const communicationsSummaryTool: AnyToolDef = {
  name: "communications_summary",
  description: "Return recent broadcast/campaign activity.",
  category: "communications",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: comms pending 11.1" };
  },
};

export const subscriptionStatusTool: AnyToolDef = {
  name: "subscription_status",
  description: "Return the current subscription plan / trial state for the tenant.",
  category: "subscription",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute(_input, ctx) {
    return { ok: true, data: ctx.subscription ?? null };
  },
};

export const automationStatusTool: AnyToolDef = {
  name: "automation_status",
  description: "Return recent automation events (reminders, campaigns).",
  category: "automation",
  parameters: emptySchema,
  allowedRoles: ["owner", "admin"],
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: automation pending 11.1" };
  },
};

export const notificationsSummaryTool: AnyToolDef = {
  name: "notifications_summary",
  description: "Return the last N notifications for the current user.",
  category: "notifications",
  parameters: emptySchema,
  async execute() {
    return { ok: false, reason: "internal", message: "not-wired: notifications pending 11.1" };
  },
};

/* ------------------------------------------------------------------ */
/* Write tools — declared with requiresConfirmation. NOT executable    */
/* until phase 11.1 wires the confirmation gate + orchestrator.        */
/* ------------------------------------------------------------------ */

export const sendFeeReminderTool: AnyToolDef = {
  name: "send_fee_reminder",
  description: "Queue a fee reminder for a student. Requires user confirmation.",
  category: "finance",
  parameters: studentIdSchema,
  allowedRoles: ["owner", "admin"],
  requiresConfirmation: true,
  async execute() {
    // Phase 11.1: delegate to existing reminder queue server function.
    return { ok: false, reason: "internal", message: "write tools are gated until 11.1" };
  },
};

export const READ_TOOLS: AnyToolDef[] = [
  dashboardSummaryTool,
  financeSummaryTool,
  attendanceSummaryTool,
  playerProfileTool,
  feeSummaryTool,
  founderIntelligenceTool,
  admissionsSummaryTool,
  communicationsSummaryTool,
  subscriptionStatusTool,
  automationStatusTool,
  notificationsSummaryTool,
];

export const WRITE_TOOLS: AnyToolDef[] = [sendFeeReminderTool];

export const ALL_TOOLS: AnyToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];
