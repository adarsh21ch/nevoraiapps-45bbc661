/**
 * Phase 12.0 — NevorAI Health Diagnostics.
 *
 * Owner / platform_admin only. Runs all dependency probes and returns a
 * consolidated health report for the internal diagnostics dashboard.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HealthEntry = {
  name: string;
  classification: "critical" | "optional";
  available: boolean;
  reason: string;
  level: "healthy" | "warning" | "offline";
  latencyMs: number | null;
  lastError: string | null;
};

export type HealthReport = {
  generatedAt: string;
  entries: HealthEntry[];
  summary: {
    criticalOffline: number;
    optionalOffline: number;
    warnings: number;
  };
  env: {
    criticalMissing: string[];
    optionalMissing: string[];
  };
};

export const getNevorAIHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthReport> => {
    // Authorize: owner or platform_admin only.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    const role = profile?.role;
    if (role !== "owner" && role !== "platform_admin" && role !== "admin") {
      throw new Error("Forbidden: owner or admin access required");
    }

    const { NEVORAI_PROBES } = await import("@/lib/nevorai/services.server");
    const { checkNevorAIEnv } = await import("@/lib/nevorai/env-report.server");

    const entries: HealthEntry[] = await Promise.all(
      NEVORAI_PROBES.map(async (p) => {
        const available = p.isAvailable();
        const reason = p.reason();
        let level: HealthEntry["level"] = available ? "healthy" : "offline";
        let latencyMs: number | null = null;
        let lastError: string | null = null;
        try {
          const h = await p.health();
          level = h.level;
          latencyMs = h.latencyMs;
          lastError = h.lastError;
        } catch (e) {
          level = "warning";
          lastError = e instanceof Error ? e.message : String(e);
        }
        return {
          name: p.name,
          classification: p.classification,
          available,
          reason,
          level,
          latencyMs,
          lastError,
        };
      }),
    );

    const summary = {
      criticalOffline: entries.filter(
        (e) => e.classification === "critical" && e.level === "offline",
      ).length,
      optionalOffline: entries.filter(
        (e) => e.classification === "optional" && e.level === "offline",
      ).length,
      warnings: entries.filter((e) => e.level === "warning").length,
    };

    const env = checkNevorAIEnv();
    return {
      generatedAt: new Date().toISOString(),
      entries,
      summary,
      env: {
        criticalMissing: env.criticalMissing,
        optionalMissing: env.optionalMissing,
      },
    };
  });
