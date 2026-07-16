/**
 * Multi-dimensional rate limiter contract.
 *
 * Supports limits per tenant / user / agent, on daily / monthly windows,
 * and on tokens as well as requests. Implementation is pluggable — an
 * in-memory implementation ships now; a Supabase-backed one is planned.
 */

export type RateLimitScope = "tenant" | "user" | "agent";
export type RateLimitWindow = "minute" | "day" | "month";
export type RateLimitMetric = "requests" | "tokens";

export type RateLimitKey = {
  scope: RateLimitScope;
  scopeId: string;
  metric: RateLimitMetric;
  window: RateLimitWindow;
};

export type RateLimitConfig = {
  /** e.g. `{ scope: "tenant", metric: "requests", window: "minute", limit: 30 }` */
  scope: RateLimitScope;
  metric: RateLimitMetric;
  window: RateLimitWindow;
  limit: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: string; retryAfterMs?: number };

export interface RateLimiter {
  check(key: RateLimitKey, cost: number, config: RateLimitConfig): Promise<RateLimitResult>;
}

/** Default budgets — tuned in `AI_OS_CONFIG` today, moved to subscription plans later. */
export const DEFAULT_BUDGETS: RateLimitConfig[] = [
  { scope: "tenant", metric: "requests", window: "minute", limit: 30 },
  { scope: "tenant", metric: "requests", window: "day", limit: 2_000 },
  { scope: "tenant", metric: "tokens", window: "day", limit: 500_000 },
  { scope: "tenant", metric: "tokens", window: "month", limit: 10_000_000 },
  { scope: "user", metric: "requests", window: "minute", limit: 15 },
  { scope: "agent", metric: "requests", window: "day", limit: 500 },
];
