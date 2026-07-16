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
 * SERVER-ONLY.
 */

import { tool, jsonSchema, type Tool } from "ai";
import type { AIContext } from "@/lib/ai-os";
import { invokeTool, toolsForContext } from "@/lib/ai-os";
import { bootstrapNevorAI } from "@/lib/ai-os/bootstrap.server";

export type NevorAIToolBag = Record<string, Tool>;

export function buildToolBag(ctx: AIContext): NevorAIToolBag {
  bootstrapNevorAI();
  const bag: NevorAIToolBag = {};
  for (const t of toolsForContext(ctx)) {
    bag[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.parameters as never),
      execute: async (input: unknown) => {
        const result = await invokeTool(t.name, input, ctx);
        // Return the whole envelope; the AI SDK serializes it into a
        // tool-result part the client can render.
        return result;
      },
    });
  }
  return bag;
}
