/**
 * Supabase-backed rate limiter.
 * SERVER-ONLY. Uses ai_rate_limits with atomic increments via RPC-like update.
 *
 * Correctness note: the check-then-increment is not atomic here — we accept a
 * small burst-window race in exchange for keeping this behind the existing
 * RateLimiter interface. Move to `pg_advisory_xact_lock` or an RPC when the
 * plan-based limits require exact enforcement.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  RateLimitConfig,
  RateLimitKey,
  RateLimitResult,
  RateLimiter,
} from "./limits";

function windowStart(win: RateLimitKey["window"], now: Date): string {
  const d = new Date(now);
  if (win === "minute") {
    d.setUTCSeconds(0, 0);
  } else if (win === "day") {
    d.setUTCHours(0, 0, 0, 0);
  } else {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

function bucketKey(key: RateLimitKey, wStart: string): string {
  return `${key.scope}|${key.scopeId}|${key.metric}|${key.window}|${wStart}`;
}

export class SupabaseRateLimiter implements RateLimiter {
  async check(
    key: RateLimitKey,
    cost: number,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const wStart = windowStart(key.window, new Date());
    const id = bucketKey(key, wStart);

    const { data: existing } = await supabaseAdmin
      .from("ai_rate_limits")
      .select("used")
      .eq("bucket_key", id)
      .maybeSingle();

    const used = Number(existing?.used ?? 0);
    if (used + cost > config.limit) {
      return { ok: false, reason: `limit_exceeded:${key.metric}:${key.window}` };
    }

    if (existing) {
      await supabaseAdmin
        .from("ai_rate_limits")
        .update({ used: used + cost })
        .eq("bucket_key", id);
    } else {
      await supabaseAdmin.from("ai_rate_limits").insert({
        bucket_key: id,
        scope: key.scope,
        scope_id: key.scopeId,
        tenant_id: key.scope === "tenant" ? key.scopeId : null,
        metric: key.metric,
        time_window: key.window,
        window_start: wStart,
        used: cost,
      });
    }

    return { ok: true, remaining: config.limit - (used + cost) };
  }
}
