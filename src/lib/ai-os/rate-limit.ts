/**
 * Soft rate limiter — in-memory token bucket per tenant.
 *
 * Phase 11.0: local process only. Phase 11.1 upgrades this to a
 * Supabase-backed counter with `tokensPerDay` and per-user isolation.
 */

import { AI_OS_CONFIG } from "./config";

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(tenantId: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const capacity = AI_OS_CONFIG.rateLimit.requestsPerMinute;
  const refillPerMs = capacity / 60_000;

  const bucket = buckets.get(tenantId) ?? { tokens: capacity, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  const refilled = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
  if (refilled < 1) {
    const retryAfterMs = Math.ceil((1 - refilled) / refillPerMs);
    buckets.set(tenantId, { tokens: refilled, updatedAt: now });
    return { ok: false, retryAfterMs };
  }
  buckets.set(tenantId, { tokens: refilled - 1, updatedAt: now });
  return { ok: true };
}
