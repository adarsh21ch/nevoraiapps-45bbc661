/**
 * useFeature — runtime plan gating hook. Consumers can hide, disable, or
 * show an upgrade CTA without duplicating routing.
 *
 * Reads the current tenant via TenantContext and resolves plan tier through
 * `resolvePlanTier`. Non-tenant surfaces (platform admin) always allow.
 */
import { useMemo } from "react";
import { useTenantState } from "@/lib/tenant-context";
import { FEATURE_MIN_PLAN, planAllows, resolvePlanTier, type FeatureId, type PlanTier } from "./plans";

export function useFeature(feature: FeatureId): {
  allowed: boolean;
  plan: PlanTier;
  minPlan: PlanTier;
} {
  const state = useTenantState();
  return useMemo(() => {
    const t = (state.tenant ?? null) as
      | { subscription_status?: string | null; plan_tier?: string | null }
      | null;
    const plan = resolvePlanTier({
      subscription_status: t?.subscription_status ?? null,
      plan_tier: t?.plan_tier ?? null,
    });
    const allowed = planAllows(plan, feature);
    return { allowed, plan, minPlan: FEATURE_MIN_PLAN[feature] };
  }, [state, feature]);
}
