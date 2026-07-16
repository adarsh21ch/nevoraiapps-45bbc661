/**
 * NevorAI server bootstrap — swap in-memory runtime for Supabase-backed
 * implementations and wire the Automation Engine bridge.
 *
 * Call `bootstrapNevorAI()` exactly once from server code before the first
 * `runAgent(...)` invocation (e.g. from the chat server route module scope).
 *
 * SERVER-ONLY.
 */

import { setRuntime } from "./orchestrator/runtime";
import { bootstrapTools } from "./tools/bootstrap";
import { bootstrapAgents } from "./agents/bootstrap";
import { bootstrapAutomationBridge } from "./automation-bridge.server";
import { SupabaseMemoryStore } from "./memory/supabase-store.server";
import { SupabaseActionQueue } from "./queue/supabase-queue.server";
import { SupabaseAnalyticsSink } from "./observability/supabase-sink.server";
import { SupabaseRateLimiter } from "./rate-limit/supabase-limiter.server";
import { SupabaseUsageTracker } from "./usage/supabase-tracker.server";

let done = false;

export function bootstrapNevorAI(): void {
  if (done) return;
  done = true;

  bootstrapTools();
  bootstrapAgents();

  setRuntime({
    memory: new SupabaseMemoryStore(),
    queue: new SupabaseActionQueue(),
    analytics: new SupabaseAnalyticsSink(),
    rateLimiter: new SupabaseRateLimiter(),
    usage: new SupabaseUsageTracker(),
  });

  bootstrapAutomationBridge();
}
