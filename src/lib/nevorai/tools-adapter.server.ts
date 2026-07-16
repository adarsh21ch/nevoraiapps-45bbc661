/**
 * NevorAI tool adapter — server only.
 *
 * Bridges the NevorAI Core tool registry (from `src/lib/ai-os`) into the
 * AI SDK's `tool()` shape so `streamText` can invoke them during a chat run.
 * Reuses:
 *   - `toolsForContext(ctx)` for role/feature filtering,
 *   - `invokeTool(name, input, ctx)` for the actual call (which itself
 *     enforces confirmation, entitlements, and observability),
 *   - the standardized `ToolResult` envelope for output.
 *
 * Adds a per-request in-memory cache for READ tools so that duplicate
 * calls within a single chat turn (or parallel tool calls resolving to the
 * same summary) resolve instantly instead of round-tripping Supabase again.
 * Write tools and tools that take non-trivial parameters skip the cache.
 *
 * SERVER-ONLY.
 */

import { tool, jsonSchema, type Tool } from "ai";
import type { AIContext } from "@/lib/ai-os";
import { invokeTool, toolsForContext } from "@/lib/ai-os";
import { bootstrapNevorAI } from "@/lib/ai-os/bootstrap.server";
import type { ToolResult } from "@/lib/ai-os/tools/types";

export type NevorAIToolBag = Record<string, Tool>;

/** Read-only tool prefixes whose results are safe to cache for one request. */
const CACHEABLE_PREFIXES = [
  "dashboard_",
  "finance_",
  "attendance_",
  "admissions_",
  "communications_",
  "automation_",
  "notifications_",
  "priorities_",
  "reports_",
];

function isCacheable(name: string, requiresConfirmation: boolean | undefined): boolean {
  if (requiresConfirmation) return false;
  return CACHEABLE_PREFIXES.some((p) => name.startsWith(p));
}

export function buildToolBag(ctx: AIContext): NevorAIToolBag {
  bootstrapNevorAI();
  const bag: NevorAIToolBag = {};
  // Per-request cache — scoped to this bag, dropped when the response ends.
  const cache = new Map<string, Promise<ToolResult>>();

  for (const t of toolsForContext(ctx)) {
    const cacheable = isCacheable(t.name, t.requiresConfirmation);
    bag[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters as never),
      execute: async (input: unknown) => {
        if (cacheable) {
          const key = `${t.name}:${safeKey(input)}`;
          const existing = cache.get(key);
          if (existing) return existing;
          const p = invokeTool(t.name, input, ctx);
          cache.set(key, p);
          try {
            return await p;
          } catch (e) {
            cache.delete(key);
            throw e;
          }
        }
        return invokeTool(t.name, input, ctx);
      },
    });
  }
  return bag;
}

function safeKey(input: unknown): string {
  try {
    return JSON.stringify(input ?? {});
  } catch {
    return "_";
  }
}
