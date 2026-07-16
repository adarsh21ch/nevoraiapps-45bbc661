/**
 * AI Analytics — one record per orchestrated run.
 *
 * Captures the full lifecycle for observability: tokens, latency, cost,
 * tool activity, retries, confirmations. The backing store is pluggable
 * so we can move to Supabase without changing callers.
 */

export type AIAnalyticsRecord = {
  conversationId: string;
  runId: string;
  tenantId: string;
  userId: string;
  agentId: string;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  toolCalls: { name: string; ok: boolean; ms: number }[];
  failures: number;
  retries: number;
  completionStatus: "ok" | "error" | "aborted";
  confirmationRequired: boolean;
  confirmationApproved: boolean;
  startedAt: string;
  finishedAt: string;
  errorMessage?: string;
};

export interface AIAnalyticsSink {
  record(entry: AIAnalyticsRecord): Promise<void>;
  recent(tenantId: string, limit?: number): Promise<AIAnalyticsRecord[]>;
}
