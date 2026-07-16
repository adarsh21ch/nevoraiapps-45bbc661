/**
 * Orchestrator runtime — the pluggable services the orchestrator uses.
 *
 * Kept as a small container so tests can substitute in-memory stores and
 * production can swap in Supabase-backed implementations without changing
 * orchestrator code.
 */

import type { MemoryStore } from "../memory/types";
import type { UsageTracker } from "../usage/types";
import type { ActionQueue } from "../queue/types";
import type { AIAnalyticsSink } from "../observability/types";
import type { RateLimiter } from "../rate-limit/limits";

import { InMemoryMemoryStore } from "../memory/in-memory-store";
import { InMemoryUsageTracker } from "../usage/in-memory-tracker";
import { InMemoryActionQueue } from "../queue/in-memory-queue";
import { InMemoryAnalyticsSink } from "../observability/in-memory-sink";
import { InMemoryRateLimiter } from "../rate-limit/in-memory-limiter";

export type AIRuntime = {
  memory: MemoryStore;
  usage: UsageTracker;
  queue: ActionQueue;
  analytics: AIAnalyticsSink;
  rateLimiter: RateLimiter;
};

let current: AIRuntime = {
  memory: new InMemoryMemoryStore(),
  usage: new InMemoryUsageTracker(),
  queue: new InMemoryActionQueue(),
  analytics: new InMemoryAnalyticsSink(),
  rateLimiter: new InMemoryRateLimiter(),
};

export function getRuntime(): AIRuntime {
  return current;
}

export function setRuntime(patch: Partial<AIRuntime>): void {
  current = { ...current, ...patch };
}
