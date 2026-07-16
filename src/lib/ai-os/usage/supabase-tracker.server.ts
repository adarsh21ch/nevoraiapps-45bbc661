/**
 * Supabase-backed UsageTracker. SERVER-ONLY.
 *
 * The primary durable record lives in `ai_analytics`; this tracker
 * writes to `ai_usage_daily` as well so the per-tenant daily totals are
 * queryable without scanning the analytics table.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TenantDailyUsage, UsageEvent, UsageTracker } from "./types";

export class SupabaseUsageTracker implements UsageTracker {
  async record(event: UsageEvent): Promise<void> {
    // The analytics sink already writes the daily rollup by (agent, model);
    // this method is retained for interface compatibility and future
    // per-tenant fast lookups. No-op here to avoid double-counting.
    void event;
  }

  async dailyUsage(tenantId: string, date: string): Promise<TenantDailyUsage> {
    const { data } = await supabaseAdmin
      .from("ai_usage_daily")
      .select("requests, input_tokens, output_tokens, estimated_cost_usd, failures")
      .eq("tenant_id", tenantId)
      .eq("day", date);
    const rows = data ?? [];
    return rows.reduce<TenantDailyUsage>(
      (acc, r) => ({
        tenantId,
        date,
        requests: acc.requests + r.requests,
        inputTokens: acc.inputTokens + Number(r.input_tokens),
        outputTokens: acc.outputTokens + Number(r.output_tokens),
        estimatedCostUsd: acc.estimatedCostUsd + Number(r.estimated_cost_usd),
        failures: acc.failures + r.failures,
      }),
      {
        tenantId,
        date,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        failures: 0,
      },
    );
  }
}
