/**
 * SaaS plans + runtime feature flags. Client-safe.
 *
 * Plans are resolved from `tenants.subscription_status` for now (paid/due/overdue).
 * Add a `plan_tier` column later via migration to differentiate Starter/Pro/Enterprise;
 * until then everyone runs on `professional` when paid, `starter` otherwise.
 */

export type PlanTier = "starter" | "professional" | "enterprise";

export type FeatureId =
  | "attendance"
  | "fees"
  | "students"
  | "admissions"
  | "match_center"
  | "automation"
  | "notifications"
  | "reports"
  | "coach_module"
  | "parent_app"
  | "online_payments"
  | "ai_reports"
  | "custom_branding"
  | "founder_intelligence";

/** minimum plan required for a feature */
export const FEATURE_MIN_PLAN: Record<FeatureId, PlanTier> = {
  attendance: "starter",
  fees: "starter",
  students: "starter",
  admissions: "starter",
  notifications: "starter",
  parent_app: "starter",
  match_center: "professional",
  automation: "professional",
  reports: "professional",
  coach_module: "professional",
  online_payments: "professional",
  ai_reports: "enterprise",
  custom_branding: "enterprise",
  founder_intelligence: "enterprise",
};

const RANK: Record<PlanTier, number> = { starter: 0, professional: 1, enterprise: 2 };

export function planAllows(current: PlanTier, feature: FeatureId): boolean {
  return RANK[current] >= RANK[FEATURE_MIN_PLAN[feature]];
}

export function resolvePlanTier(input: {
  subscription_status?: string | null;
  plan_tier?: string | null;
}): PlanTier {
  const explicit = input.plan_tier;
  if (explicit === "starter" || explicit === "professional" || explicit === "enterprise") {
    return explicit;
  }
  if (input.subscription_status === "paid") return "professional";
  return "starter";
}
