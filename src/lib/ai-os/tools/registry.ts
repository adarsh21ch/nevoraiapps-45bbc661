/**
 * Tool Registry — the AI's addressable surface area.
 *
 * Consumers ask the registry for the set of tools available to the
 * current `AIContext`. The registry filters by `allowedRoles` and
 * `canUse(ctx)`. It also wraps `execute` with:
 *   - the confirmation gate for write tools,
 *   - a permission recheck at call time (defence-in-depth),
 *   - feature-flag / subscription entitlement checks,
 *   - a uniform error envelope,
 *   - observability via the AI event bus.
 */

import type { AIContext } from "../context/types";
import { emitAIEvent, makeEvent } from "../events/bus";
import type { AnyToolDef, ToolFailure, ToolResult } from "./types";

const registry = new Map<string, AnyToolDef>();

export function registerTool(tool: AnyToolDef): void {
  if (registry.has(tool.name)) {
    throw new Error(`AI tool "${tool.name}" is already registered`);
  }
  registry.set(tool.name, tool);
}

export function registerTools(tools: AnyToolDef[]): void {
  for (const t of tools) registerTool(t);
}

function isAllowed(tool: AnyToolDef, ctx: AIContext): boolean {
  if (tool.allowedRoles && !tool.allowedRoles.includes(ctx.role)) return false;
  if (tool.canUse && !tool.canUse(ctx)) return false;
  return true;
}

const PLAN_RANK: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 1,
  basic: 1,
  pro: 2,
  growth: 2,
  premium: 3,
  business: 3,
  enterprise: 4,
};

function planSatisfies(currentPlan: string | undefined, required: string): boolean {
  if (!currentPlan) return false;
  const have = PLAN_RANK[currentPlan.toLowerCase()] ?? 0;
  const need = PLAN_RANK[required.toLowerCase()] ?? 0;
  return have >= need;
}

/** Return the entitlement failure for a tool, or null when the caller passes. */
function checkEntitlement(tool: AnyToolDef, ctx: AIContext): ToolFailure | null {
  if (tool.requiredFeature) {
    const enabled = ctx.features?.[tool.requiredFeature];
    if (!enabled) {
      return {
        ok: false,
        reason: "feature_unavailable",
        code: "FEATURE_DISABLED",
        feature: tool.requiredFeature,
        message: `Feature "${tool.requiredFeature}" is not enabled for this academy.`,
      };
    }
  }
  if (tool.requiredPlan) {
    const plan = ctx.subscription?.plan;
    if (!planSatisfies(plan, tool.requiredPlan)) {
      return {
        ok: false,
        reason: "subscription_required",
        code: "PLAN_UPGRADE_REQUIRED",
        requiredPlan: tool.requiredPlan,
        message: `Tool "${tool.name}" requires the "${tool.requiredPlan}" plan or higher.`,
      };
    }
    const status = ctx.subscription?.status?.toLowerCase();
    if (status && ["suspended", "cancelled", "expired"].includes(status)) {
      return {
        ok: false,
        reason: "subscription_required",
        code: "SUBSCRIPTION_INACTIVE",
        message: `Subscription is ${status}. Renew to use this tool.`,
      };
    }
  }
  return null;
}

/** Tools the caller may see / invoke. Used to build the LLM tool list. */
export function toolsForContext(ctx: AIContext): AnyToolDef[] {
  return Array.from(registry.values()).filter((t) => isAllowed(t, ctx));
}

export function getTool(name: string): AnyToolDef | undefined {
  return registry.get(name);
}

export type InvokeOptions = {
  /** Set by the orchestrator once the user has approved a write call. */
  confirmed?: boolean;
  /** Correlation ids for observability (from the orchestrator run). */
  agentId?: string;
  conversationId?: string;
};

export async function invokeTool(
  name: string,
  input: unknown,
  ctx: AIContext,
  opts: InvokeOptions = {},
): Promise<ToolResult> {
  const started = Date.now();
  const base = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    agentId: opts.agentId ?? "tool_registry",
    conversationId: opts.conversationId ?? "adhoc",
  };
  const emit = (result: ToolResult) => {
    const durationMs = Date.now() - started;
    void emitAIEvent(
      makeEvent(result.ok ? "ai.tool_called" : "ai.tool_failed", base, {
        tool: name,
        durationMs,
        reason: result.ok ? undefined : result.reason,
        code: result.ok ? undefined : result.code,
      }),
    );
    return result;
  };

  const tool = registry.get(name);
  if (!tool) {
    return emit({
      ok: false,
      reason: "not_found",
      code: "TOOL_NOT_FOUND",
      message: `Unknown tool "${name}"`,
    });
  }
  if (!isAllowed(tool, ctx)) {
    return emit({
      ok: false,
      reason: "forbidden",
      code: "ROLE_FORBIDDEN",
      message: `Tool "${name}" not allowed for role "${ctx.role}"`,
    });
  }
  const entitlement = checkEntitlement(tool, ctx);
  if (entitlement) return emit(entitlement);

  if (tool.requiresConfirmation && !opts.confirmed) {
    return emit({
      ok: false,
      reason: "forbidden",
      code: "CONFIRMATION_REQUIRED",
      message: `Tool "${name}" requires user confirmation before execution`,
    });
  }
  try {
    const result = await tool.execute(input, ctx);
    return emit(result);
  } catch (e) {
    return emit({
      ok: false,
      reason: "internal",
      code: "TOOL_EXECUTION_ERROR",
      message: e instanceof Error ? e.message : "tool execution failed",
    });
  }
}
