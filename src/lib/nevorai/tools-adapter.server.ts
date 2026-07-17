/**
 * NevorAI tool adapter — server only.
 *
 * Bridges the NevorAI Core tool registry into the AI SDK's `tool()` shape.
 * Reuses `toolsForContext(ctx)` for role/feature filtering, `invokeTool` for
 * execution (which enforces confirmation, entitlements, RLS and observability),
 * and the standardized `ToolResult` envelope for output.
 *
 * Two-layer cache for read-only summaries:
 *   1. Per-request cache — dedupes duplicate parallel calls within one turn.
 *   2. Short cross-request TTL cache (default 15s) — makes repeat "how is my
 *      academy?" style questions feel instant. Scoped per tenant + role +
 *      tool + input so tenants NEVER share data. Skipped for write tools,
 *      confirmation-required tools, and tools returning errors.
 *
 * SERVER-ONLY.
 */

import { tool, jsonSchema, type Tool } from "ai";
import type { AIContext } from "@/lib/ai-os";
import { invokeTool, toolsForContext } from "@/lib/ai-os";
import { bootstrapNevorAI } from "@/lib/ai-os/bootstrap.server";
import type { ToolResult } from "@/lib/ai-os/tools/types";

export type NevorAIToolBag = Record<string, Tool>;

/** Read-only tool prefixes whose results are safe to cache. */
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
  "students_",
  "match_",
  "cricket_",
  "app_help",
];

const TTL_MS = 15_000;

/** Cross-request cache, module-scoped. Keyed by tenant+role+tool+input. */
const ttlCache = new Map<string, { at: number; value: ToolResult }>();

function isCacheable(name: string, requiresConfirmation: boolean | undefined): boolean {
  if (requiresConfirmation) return false;
  return CACHEABLE_PREFIXES.some((p) => name.startsWith(p));
}

function safeKey(input: unknown): string {
  try {
    return JSON.stringify(input ?? {});
  } catch {
    return "_";
  }
}

function isOkResult(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  const rec = r as Record<string, unknown>;
  // Standard envelope has `ok: true` or an absence of `error`.
  if (rec.ok === false) return false;
  if (rec.error) return false;
  return true;
}
function isTransientFailure(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  const rec = r as Record<string, unknown>;
  if (rec.ok !== false && !rec.error) return false;
  const err = rec.error as { code?: string; category?: string } | undefined;
  const code = (err?.code ?? "").toString().toLowerCase();
  const category = (err?.category ?? "").toString().toLowerCase();
  // Retry only on transient categories — never on permission / validation /
  // subscription / feature-disabled errors, where retrying would only produce
  // the same refusal.
  return (
    category === "network" ||
    category === "timeout" ||
    category === "provider" ||
    code.includes("timeout") ||
    code.includes("network") ||
    code.includes("unavailable") ||
    code === "internal_error"
  );
}

/** Invoke a tool, retrying once on transient failures (network/timeout). */
async function invokeWithRetry(name: string, input: unknown, ctx: AIContext): Promise<ToolResult> {
  try {
    const first = await invokeTool(name, input, ctx);
    if (isTransientFailure(first)) {
      try {
        const second = await invokeTool(name, input, ctx);
        return second;
      } catch {
        return first;
      }
    }
    return first;
  } catch (e) {
    // Thrown transient error — retry once.
    try {
      return await invokeTool(name, input, ctx);
    } catch {
      throw e;
    }
  }
}


export function buildToolBag(ctx: AIContext): NevorAIToolBag {
  bootstrapNevorAI();
  const bag: NevorAIToolBag = {};
  // Per-request dedupe cache — dropped when the response ends.
  const perRequest = new Map<string, Promise<ToolResult>>();

  const scope = `${ctx.tenantId}:${ctx.role}:${ctx.userId ?? "-"}`;

  for (const t of toolsForContext(ctx)) {
    const cacheable = isCacheable(t.name, t.requiresConfirmation);
    bag[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters as never),
      execute: async (input: unknown) => {
        // Write tools (or confirmation-required) go straight through with a
        // single retry on transient failure — never cached.
        if (!cacheable) return invokeWithRetry(t.name, input, ctx);

        const key = `${scope}:${t.name}:${safeKey(input)}`;

        // TTL layer — hit if fresh.
        const hit = ttlCache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

        // Per-request dedupe layer.
        const inflight = perRequest.get(key);
        if (inflight) return inflight;

        const p = invokeWithRetry(t.name, input, ctx);
        perRequest.set(key, p);
        try {
          const result = await p;
          if (isOkResult(result)) ttlCache.set(key, { at: Date.now(), value: result });
          return result;
        } catch (e) {
          perRequest.delete(key);
          throw e;
        }
      },
    });
  }
  return bag;
}

/** Optional external invalidation hook — call after a write mutation. */
export function invalidateNevorAICache(tenantId: string, prefix?: string) {
  for (const key of ttlCache.keys()) {
    if (!key.startsWith(`${tenantId}:`)) continue;
    if (prefix && !key.includes(`:${prefix}`)) continue;
    ttlCache.delete(key);
  }
}
