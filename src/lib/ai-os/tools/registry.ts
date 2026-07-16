/**
 * Tool Registry — the AI's addressable surface area.
 *
 * Consumers ask the registry for the set of tools available to the
 * current `AIContext`. The registry filters by `allowedRoles` and
 * `canUse(ctx)`. It also wraps `execute` with:
 *   - the confirmation gate for write tools,
 *   - a permission recheck at call time (defence-in-depth),
 *   - a uniform error envelope.
 */

import type { AIContext } from "../context/types";
import type { AnyToolDef, ToolResult } from "./types";

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
};

export async function invokeTool(
  name: string,
  input: unknown,
  ctx: AIContext,
  opts: InvokeOptions = {},
): Promise<ToolResult> {
  const tool = registry.get(name);
  if (!tool) {
    return { ok: false, reason: "not_found", message: `Unknown tool "${name}"` };
  }
  if (!isAllowed(tool, ctx)) {
    return { ok: false, reason: "forbidden", message: `Tool "${name}" not allowed for role` };
  }
  if (tool.requiresConfirmation && !opts.confirmed) {
    return {
      ok: false,
      reason: "forbidden",
      message: `Tool "${name}" requires user confirmation before execution`,
    };
  }
  try {
    return await tool.execute(input, ctx);
  } catch (e) {
    return {
      ok: false,
      reason: "internal",
      message: e instanceof Error ? e.message : "tool execution failed",
    };
  }
}
