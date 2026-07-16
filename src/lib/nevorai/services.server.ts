/**
 * Phase 12.0 — NevorAI dependency isolation.
 *
 * Wraps every external runtime dependency behind a uniform probe:
 *   • isAvailable() — cheap synchronous check
 *   • health()      — live probe (may issue a small request)
 *   • reason()      — human-readable status string
 *
 * The Orchestrator, chat route, and diagnostics dashboard all consult
 * these probes instead of poking at env vars or catching exceptions.
 *
 * SERVER-ONLY.
 */

import { getSupabaseAdmin, hasSupabaseAdmin } from "@/integrations/supabase/client.server";

export type HealthLevel = "healthy" | "warning" | "offline";

export interface DependencyProbe {
  name: string;
  classification: "critical" | "optional";
  isAvailable(): boolean;
  reason(): string;
  health(): Promise<{
    level: HealthLevel;
    latencyMs: number | null;
    lastError: string | null;
  }>;
}

async function probeLatency<T>(fn: () => Promise<T>): Promise<{
  ok: boolean;
  latencyMs: number;
  error: string | null;
}> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start, error: null };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ------------- Gemini / provider -------------
export const geminiProbe: DependencyProbe = {
  name: "Gemini (Google AI)",
  classification: "critical",
  isAvailable: () => !!process.env.GOOGLE_API_KEY,
  reason: () =>
    process.env.GOOGLE_API_KEY
      ? "GOOGLE_API_KEY configured"
      : "GOOGLE_API_KEY not set — chat generation disabled",
  async health() {
    if (!this.isAvailable()) {
      return { level: "offline", latencyMs: null, lastError: this.reason() };
    }
    // Cheap HEAD-style probe against the Generative Language endpoint.
    const probe = await probeLatency(async () => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`,
        { method: "GET" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    return {
      level: probe.ok ? "healthy" : "warning",
      latencyMs: probe.latencyMs,
      lastError: probe.error,
    };
  },
};

// ------------- Supabase auth (publishable / RLS reads) -------------
export const supabaseAuthProbe: DependencyProbe = {
  name: "Supabase Auth + RLS",
  classification: "critical",
  isAvailable: () =>
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_PUBLISHABLE_KEY,
  reason() {
    if (!process.env.SUPABASE_URL) return "SUPABASE_URL missing";
    if (!process.env.SUPABASE_PUBLISHABLE_KEY) return "SUPABASE_PUBLISHABLE_KEY missing";
    return "Publishable key configured";
  },
  async health() {
    if (!this.isAvailable()) {
      return { level: "offline", latencyMs: null, lastError: this.reason() };
    }
    const probe = await probeLatency(async () => {
      const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    return {
      level: probe.ok ? "healthy" : "warning",
      latencyMs: probe.latencyMs,
      lastError: probe.error,
    };
  },
};

// ------------- Supabase admin (service role) -------------
function adminProbeFactory(
  name: string,
  table: string,
): DependencyProbe {
  return {
    name,
    classification: "optional",
    isAvailable: () => hasSupabaseAdmin(),
    reason: () =>
      hasSupabaseAdmin()
        ? "Service role key configured"
        : "SUPABASE_SERVICE_ROLE_KEY missing — feature degraded to no-op",
    async health() {
      const admin = getSupabaseAdmin();
      if (!admin) {
        return { level: "offline", latencyMs: null, lastError: this.reason() };
      }
      const probe = await probeLatency(async () => {
        const { error } = await admin.from(table as never).select("*").limit(1);
        if (error) throw new Error(error.message);
      });
      return {
        level: probe.ok ? "healthy" : "warning",
        latencyMs: probe.latencyMs,
        lastError: probe.error,
      };
    },
  };
}

export const memoryProbe = adminProbeFactory("Memory (conversations)", "ai_conversations");
export const analyticsProbe = adminProbeFactory("Analytics", "ai_analytics");
export const usageProbe = adminProbeFactory("Usage rollups", "ai_usage_daily");
export const queueProbe = adminProbeFactory("Action Queue", "ai_action_queue");
export const rateLimitProbe = adminProbeFactory("Rate Limits", "ai_rate_limits");

// ------------- Tool Registry (in-process) -------------
export const toolRegistryProbe: DependencyProbe = {
  name: "Tool Registry",
  classification: "critical",
  isAvailable: () => true,
  reason: () => "In-process registry — always available",
  async health() {
    try {
      const mod = await import("@/lib/ai-os/tools/registry");
      const registry = (mod as { toolRegistry?: { list?: () => unknown[] } }).toolRegistry;
      const count = registry?.list?.().length ?? 0;
      return {
        level: count > 0 ? "healthy" : "warning",
        latencyMs: 0,
        lastError: count > 0 ? null : "No tools registered",
      };
    } catch (e) {
      return {
        level: "warning",
        latencyMs: 0,
        lastError: e instanceof Error ? e.message : String(e),
      };
    }
  },
};

export const NEVORAI_PROBES: DependencyProbe[] = [
  geminiProbe,
  supabaseAuthProbe,
  toolRegistryProbe,
  memoryProbe,
  analyticsProbe,
  usageProbe,
  queueProbe,
  rateLimitProbe,
];

export function summarizeAvailability() {
  return NEVORAI_PROBES.map((p) => ({
    name: p.name,
    classification: p.classification,
    available: p.isAvailable(),
    reason: p.reason(),
  }));
}
