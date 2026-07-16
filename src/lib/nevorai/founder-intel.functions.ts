/**
 * NevorAI Founder Intelligence — surfaces AI adoption metrics from
 * existing `ai_analytics` / `ai_usage_daily` / `ai_conversation_turns`
 * tables. Reuses Phase 11.2 persistence; no new analytics engine.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FounderAIIntel = {
  totalRequests: number;
  totalTokens: number;
  totalCostCredits: number;
  avgLatencyMs: number;
  activeAcademies: number;
  activeUsers: number;
  adoptionPct: number;
  toolUsage: Array<{ tool: string; calls: number }>;
  topQuestions: Array<{ text: string; count: number }>;
  topAcademies: Array<{ tenant_id: string; name: string; requests: number }>;
};

export const getFounderAIIntel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) =>
    z.object({ days: z.number().int().min(1).max(90).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<FounderAIIntel> => {
    // Verify platform admin.
    const { data: admin } = await context.supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!admin) throw new Error("Forbidden");

    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [analytics, tenants, turns] = await Promise.all([
      supabaseAdmin
        .from("ai_analytics")
        .select("tenant_id, user_id, tool_calls, latency_ms, input_tokens, output_tokens, estimated_cost_usd, created_at")
        .gte("created_at", since)
        .limit(20000),
      supabaseAdmin.from("tenants").select("id, name").eq("status", "active"),
      supabaseAdmin
        .from("ai_conversation_turns")
        .select("content")
        .eq("role", "user")
        .gte("created_at", since)
        .limit(5000),
    ]);

    const rows = analytics.data ?? [];
    const totalRequests = rows.length;
    let totalTokens = 0;
    let totalCost = 0;
    let latencySum = 0;
    const toolCounts = new Map<string, number>();
    const tenantCounts = new Map<string, number>();
    const userSet = new Set<string>();
    const tenantSet = new Set<string>();

    for (const r of rows) {
      totalTokens += Number(r.input_tokens || 0) + Number(r.output_tokens || 0);
      totalCost += Number(r.estimated_cost_usd || 0);
      latencySum += Number(r.latency_ms || 0);
      const calls = Array.isArray(r.tool_calls) ? r.tool_calls : [];
      for (const c of calls) {
        const name =
          c && typeof c === "object" && "name" in c && typeof (c as { name: unknown }).name === "string"
            ? (c as { name: string }).name
            : null;
        if (name) toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
      }
      if (r.tenant_id) {
        tenantCounts.set(r.tenant_id, (tenantCounts.get(r.tenant_id) ?? 0) + 1);
        tenantSet.add(r.tenant_id);
      }
      if (r.user_id) userSet.add(r.user_id);
    }

    // Top questions — cheap normalisation, first 8 words as bucket.
    const qMap = new Map<string, number>();
    for (const t of turns.data ?? []) {
      const raw = (t.content ?? "").trim().toLowerCase();
      if (!raw) continue;
      const key = raw.split(/\s+/).slice(0, 8).join(" ");
      qMap.set(key, (qMap.get(key) ?? 0) + 1);
    }
    const topQuestions = [...qMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ text, count }));

    const tenantNameMap = new Map((tenants.data ?? []).map((t) => [t.id, t.name]));
    const topAcademies = [...tenantCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, requests]) => ({
        tenant_id: id,
        name: tenantNameMap.get(id) ?? "—",
        requests,
      }));

    const toolUsage = [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, calls]) => ({ tool, calls }));

    const activeTenants = tenants.data?.length ?? 0;
    const adoptionPct =
      activeTenants > 0 ? Math.round((tenantSet.size / activeTenants) * 100) : 0;

    return {
      totalRequests,
      totalTokens,
      totalCostCredits: Math.round(totalCost * 100) / 100,
      avgLatencyMs: totalRequests > 0 ? Math.round(latencySum / totalRequests) : 0,
      activeAcademies: tenantSet.size,
      activeUsers: userSet.size,
      adoptionPct,
      toolUsage,
      topQuestions,
      topAcademies,
    };
  });
