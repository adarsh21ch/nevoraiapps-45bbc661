import type { RateLimitConfig, RateLimitKey, RateLimitResult, RateLimiter } from "./limits";

function bucketId(key: RateLimitKey, now: Date): string {
  const w =
    key.window === "minute"
      ? `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`
      : key.window === "day"
        ? `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`
        : `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
  return `${key.scope}|${key.scopeId}|${key.metric}|${key.window}|${w}`;
}

export class InMemoryRateLimiter implements RateLimiter {
  private counters = new Map<string, number>();

  async check(key: RateLimitKey, cost: number, config: RateLimitConfig): Promise<RateLimitResult> {
    const id = bucketId(key, new Date());
    const used = this.counters.get(id) ?? 0;
    if (used + cost > config.limit) {
      return { ok: false, reason: `limit_exceeded:${key.metric}:${key.window}` };
    }
    this.counters.set(id, used + cost);
    return { ok: true, remaining: config.limit - (used + cost) };
  }
}
