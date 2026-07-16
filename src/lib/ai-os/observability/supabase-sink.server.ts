/**
 * Supabase-backed analytics sink + daily rollup writer.
 * SERVER-ONLY.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AIAnalyticsRecord, AIAnalyticsSink } from "./types";

export class SupabaseAnalyticsSink implements AIAnalyticsSink {
  async record(entry: AIAnalyticsRecord): Promise<void> {
    await supabaseAdmin.from("ai_analytics").insert({
      run_id: entry.runId,
      conversation_id: entry.conversationId || null,
      tenant_id: entry.tenantId,
      user_id: entry.userId,
      agent_id: entry.agentId,
      provider: entry.provider,
      model: entry.model,
      latency_ms: Math.round(entry.latencyMs),
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      estimated_cost_usd: entry.estimatedCostUsd,
      tool_calls: entry.toolCalls,
      failures: entry.failures,
      retries: entry.retries,
      completion_status: entry.completionStatus,
      confirmation_required: entry.confirmationRequired,
      confirmation_approved: entry.confirmationApproved,
      started_at: entry.startedAt,
      finished_at: entry.finishedAt,
      error_message: entry.errorMessage ?? null,
    });

    // Roll up into ai_usage_daily for cost accounting.
    const day = entry.finishedAt.slice(0, 10);
    const { data: existing } = await supabaseAdmin
      .from("ai_usage_daily")
      .select("id, requests, input_tokens, output_tokens, estimated_cost_usd, failures")
      .eq("tenant_id", entry.tenantId)
      .eq("day", day)
      .eq("agent_id", entry.agentId)
      .eq("model", entry.model)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("ai_usage_daily")
        .update({
          requests: existing.requests + 1,
          input_tokens: Number(existing.input_tokens) + entry.inputTokens,
          output_tokens: Number(existing.output_tokens) + entry.outputTokens,
          estimated_cost_usd: Number(existing.estimated_cost_usd) + entry.estimatedCostUsd,
          failures: existing.failures + (entry.completionStatus === "ok" ? 0 : 1),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("ai_usage_daily").insert({
        tenant_id: entry.tenantId,
        day,
        agent_id: entry.agentId,
        model: entry.model,
        requests: 1,
        input_tokens: entry.inputTokens,
        output_tokens: entry.outputTokens,
        estimated_cost_usd: entry.estimatedCostUsd,
        failures: entry.completionStatus === "ok" ? 0 : 1,
      });
    }
  }

  async recent(tenantId: string, limit = 50): Promise<AIAnalyticsRecord[]> {
    const { data } = await supabaseAdmin
      .from("ai_analytics")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => ({
      runId: r.run_id,
      conversationId: r.conversation_id ?? "",
      tenantId: r.tenant_id,
      userId: r.user_id,
      agentId: r.agent_id,
      provider: r.provider,
      model: r.model,
      latencyMs: r.latency_ms,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      estimatedCostUsd: Number(r.estimated_cost_usd),
      toolCalls: (r.tool_calls as AIAnalyticsRecord["toolCalls"]) ?? [],
      failures: r.failures,
      retries: r.retries,
      completionStatus: r.completion_status as AIAnalyticsRecord["completionStatus"],
      confirmationRequired: r.confirmation_required,
      confirmationApproved: r.confirmation_approved,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      errorMessage: r.error_message ?? undefined,
    }));
  }
}
