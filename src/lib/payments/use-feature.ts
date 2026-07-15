/**
 * useFeature — runtime plan gating hook. Consumers can hide, disable, or
 * show an upgrade CTA without duplicating routing.
 *
 * Reads the current tenant via TenantContext and resolves plan tier through
 * `resolvePlanTier`. Non-tenant surfaces (platform admin) always allow.
 */
import { useMemo } from "react";
import { useTenant } from "@/lib/tenant-context";
import { planAllows, resolvePlanTier, type FeatureId, type PlanTier } from "./plans";

export function useFeature(feature: FeatureId): {
  allowed: boolean;
  plan: PlanTier;
  minPlan: PlanTier;
} {
  const { tenant } = useTenant();
  return useMemo(() => {
    const plan = resolvePlanTier({
      subscription_status: (tenant as { subscription_status?: string | null } | null)
        ?.subscription_status ?? null,
      plan_tier: (tenant as { plan_tier?: string | null } | null)?.plan_tier ?? null,
    });
    const allowed = planAllows(plan, feature);
    // Import lazily to avoid circular
    const { FEATURE_MIN_PLAN } = require("./plans") as typeof import("./plans");
    return { allowed, plan, minPlan: FEATURE_MIN_PLAN[feature] };
  }, [tenant, feature]);
}
