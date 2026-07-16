/**
 * NevorAI startup environment report.
 *
 * SERVER-ONLY. Called once on the first chat request to log a single
 * summary of which server-side env vars are wired up. This lets the
 * operator see the full picture at boot instead of discovering missing
 * variables one at a time as endpoints fail.
 *
 * Classification:
 *   • CRITICAL — chat generation cannot proceed without these
 *   • OPTIONAL — persistence / analytics / observability only
 */

type EnvVar = { name: string; classification: "critical" | "optional"; purpose: string };

const REQUIRED_ENV: EnvVar[] = [
  { name: "LOVABLE_API_KEY", classification: "critical", purpose: "Lovable AI Gateway (chat model provider)" },
  { name: "SUPABASE_URL", classification: "critical", purpose: "Supabase project URL" },
  { name: "SUPABASE_PUBLISHABLE_KEY", classification: "critical", purpose: "Authenticated user client (RLS-scoped reads/writes)" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", classification: "optional", purpose: "Conversation persistence, analytics rollups, action queue writes" },
];

let logged = false;

export type NevorAIEnvReport = {
  criticalMissing: string[];
  optionalMissing: string[];
  ok: boolean;
};

export function checkNevorAIEnv(): NevorAIEnvReport {
  const criticalMissing: string[] = [];
  const optionalMissing: string[] = [];
  for (const v of REQUIRED_ENV) {
    if (!process.env[v.name]) {
      if (v.classification === "critical") criticalMissing.push(v.name);
      else optionalMissing.push(v.name);
    }
  }
  return {
    criticalMissing,
    optionalMissing,
    ok: criticalMissing.length === 0,
  };
}

export function logNevorAIEnvReportOnce(): NevorAIEnvReport {
  const report = checkNevorAIEnv();
  if (logged) return report;
  logged = true;

  if (report.criticalMissing.length > 0) {
    console.error(
      `[NevorAI] Startup — CRITICAL env vars missing: ${report.criticalMissing.join(", ")}. Chat generation will fail until these are set.`,
    );
  }
  if (report.optionalMissing.length > 0) {
    console.warn(
      `[NevorAI] Startup — optional env vars missing: ${report.optionalMissing.join(", ")}. Chat generation continues; dependent features (persistence, analytics) are disabled.`,
    );
  }
  if (report.ok && report.optionalMissing.length === 0) {
    console.info("[NevorAI] Startup — all required env vars present.");
  }
  return report;
}
