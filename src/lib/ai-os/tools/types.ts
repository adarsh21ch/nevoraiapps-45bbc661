/**
 * Tool contract.
 *
 * A tool is the ONLY way the AI touches app data. Every tool:
 *   1. Reuses an existing RPC / server function / query helper.
 *   2. Enforces role permissions via `canUse(ctx)`.
 *   3. Returns a structured result — never throws for permission denial.
 *   4. Sets `requiresConfirmation: true` for any write operation.
 *
 * Phase 11.3: results follow a standardized envelope with title,
 * summary, structured_data, recommended_actions and citations so the
 * orchestrator can render tool output consistently across surfaces
 * (chat, briefs, side-panels) without special-casing each tool.
 */

import type { AIContext, AIRole } from "../context/types";

export type ToolFailureReason =
  | "forbidden"
  | "invalid_input"
  | "not_found"
  | "feature_unavailable"
  | "subscription_required"
  | "tool_unavailable"
  | "timeout"
  | "provider_failure"
  | "internal";

/** Standard success envelope surfaced to the orchestrator/UI. */
export type ToolSuccess<T = unknown> = {
  ok: true;
  /** Short human-readable title. */
  title?: string;
  /** One-line human summary of the result. */
  summary?: string;
  /** Machine-readable payload; never a raw DB row array. */
  data: T;
  /** Optional structured cards / sections (mirrors data for the UI). */
  structured_data?: unknown;
  /** Suggested next-actions the caller may render. */
  recommended_actions?: Array<{
    id: string;
    label: string;
    /** Optional target route the UI can navigate to. */
    href?: string;
    /** Optional tool the AI could invoke next. */
    tool?: string;
  }>;
  /** Underlying helper(s) that produced this data — for observability. */
  citations?: string[];
};

export type ToolFailure = {
  ok: false;
  reason: ToolFailureReason;
  message: string;
  /** Machine-readable error code for the UI. */
  code?: string;
  /** When `reason === "feature_unavailable"`, which feature. */
  feature?: string;
  /** When `reason === "subscription_required"`, which plan is required. */
  requiredPlan?: string;
};

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolFailure;

export type ToolDef<TInput = unknown, TOutput = unknown> = {
  /** Unique tool id — model-visible. */
  name: string;
  /** Model-visible description. Keep it short and action-focused. */
  description: string;
  /** Domain grouping for the registry (finance, attendance, …). */
  category:
    | "dashboard"
    | "finance"
    | "attendance"
    | "students"
    | "admissions"
    | "communications"
    | "reports"
    | "founder"
    | "subscription"
    | "automation"
    | "notifications";
  /** JSON schema for the input the model must produce. Keep it constraint-free. */
  parameters: Record<string, unknown>;
  /** Roles that may CALL this tool. Empty = all roles allowed. */
  allowedRoles?: AIRole[];
  /** Tenant feature flag that must be enabled. */
  requiredFeature?: string;
  /** Minimum subscription plan required (checked against ctx.subscription.plan). */
  requiredPlan?: string;
  /** True for any write / mutation — must go through the confirmation gate. */
  requiresConfirmation?: boolean;
  /** Cheap permission check. Called by the registry before `execute`. */
  canUse?: (ctx: AIContext) => boolean;
  /** Actual work. MUST call existing services, never raw supabase.from(...). */
  execute: (input: TInput, ctx: AIContext) => Promise<ToolResult<TOutput>>;
};

export type AnyToolDef = ToolDef<unknown, unknown>;
