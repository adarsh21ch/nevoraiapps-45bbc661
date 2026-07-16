/**
 * Tool contract.
 *
 * A tool is the ONLY way the AI touches app data. Every tool:
 *   1. Reuses an existing RPC / server function / query helper.
 *   2. Enforces role permissions via `canUse(ctx)`.
 *   3. Returns a structured result — never throws for permission denial.
 *   4. Sets `requiresConfirmation: true` for any write operation.
 */

import type { AIContext, AIRole } from "../context/types";

export type ToolResult<T = unknown> =
  | { ok: true; data: T; summary?: string }
  | { ok: false; reason: "forbidden" | "invalid_input" | "not_found" | "internal"; message: string };

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
  /** True for any write / mutation — must go through the confirmation gate. */
  requiresConfirmation?: boolean;
  /** Cheap permission check. Called by the registry before `execute`. */
  canUse?: (ctx: AIContext) => boolean;
  /** Actual work. MUST call existing services, never raw supabase.from(...). */
  execute: (input: TInput, ctx: AIContext) => Promise<ToolResult<TOutput>>;
};

export type AnyToolDef = ToolDef<unknown, unknown>;
