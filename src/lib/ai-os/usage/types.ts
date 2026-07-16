/**
 * Usage / cost tracking contract.
 *
 * Every provider call funnels through a `UsageTracker`, which records
 * tokens, cost, latency, retries, and failures per tenant. Backing
 * store is pluggable (in-memory today; Supabase table in phase 11.1).
 */

import type { AIUsage } from "../providers/types";

export type UsageEvent = {
  tenantId: string;
  userId: string;
  provider: string;
  model: string;
  usage: AIUsage;
  retries: number;
  ok: boolean;
  errorMessage?: string;
  at: string;
};

export type TenantDailyUsage = {
  tenantId: string;
  date: string; // YYYY-MM-DD
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  failures: number;
};

export interface UsageTracker {
  record(event: UsageEvent): Promise<void>;
  dailyUsage(tenantId: string, date: string): Promise<TenantDailyUsage>;
}
