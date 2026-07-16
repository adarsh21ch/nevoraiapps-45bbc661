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

  // Only wire Supabase-backed runtime when the service role key is present.
  // Without it the in-memory defaults in orchestrator/runtime.ts stay active
  // and chat continues to work — persistence, analytics rollups, and the
  // action queue simply live in-process for the request.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasSupabaseAdmin } = require("@/integrations/supabase/client.server") as {
    hasSupabaseAdmin: () => boolean;
  };
  if (hasSupabaseAdmin()) {
    setRuntime({
      memory: new SupabaseMemoryStore(),
      queue: new SupabaseActionQueue(),
      analytics: new SupabaseAnalyticsSink(),
      rateLimiter: new SupabaseRateLimiter(),
      usage: new SupabaseUsageTracker(),
    });
    bootstrapAutomationBridge();
  } else {
    console.warn(
      "[NevorAI] Bootstrap — running with in-memory runtime (memory/queue/analytics/rate-limit/usage). Set SUPABASE_SERVICE_ROLE_KEY to enable durable persistence.",
    );
  }
}

