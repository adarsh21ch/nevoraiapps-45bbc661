/**
 * useFeature / useLimit — runtime plan gating hooks reading the tenant.
 * Non-tenant surfaces (platform admin) always allow.
 */
import { useMemo } from "react";
import { useTenantState } from "@/lib/tenant-context";
import {
  FEATURES,
  PLAN_META,
  planAllows,
  resolveFeature,
  resolveLimit,
  resolvePlanTier,
  type FeatureId,
  type FeatureOverrides,
  type LimitId,
  type LimitOverrides,
  type PlanTier,
} from "./plans";

type TenantLike = {
  subscription_status?: string | null;
  plan_tier?: string | null;
  feature_overrides?: FeatureOverrides | null;
  usage_limits?: LimitOverrides | null;
};

function readTenant(state: ReturnType<typeof useTenantState>): TenantLike | null {
  return (state.tenant ?? null) as TenantLike | null;
}

export function usePlan(): PlanTier {
  const state = useTenantState();
  return useMemo(() => {
    const t = readTenant(state);
    return resolvePlanTier({
      subscription_status: t?.subscription_status ?? null,
      plan_tier: t?.plan_tier ?? null,
    });
  }, [state]);
}

export function useFeature(feature: FeatureId): {
  allowed: boolean;
  plan: PlanTier;
  minPlan: PlanTier;
  minPlanName: string;
} {
  const state = useTenantState();
  return useMemo(() => {
    const t = readTenant(state);
    const plan = resolvePlanTier({
      subscription_status: t?.subscription_status ?? null,
      plan_tier: t?.plan_tier ?? null,
    });
    const allowed = resolveFeature(plan, feature, t?.feature_overrides ?? null);
    const meta = FEATURES[feature];
    return { allowed, plan, minPlan: meta.minPlan, minPlanName: PLAN_META[meta.minPlan].name };
  }, [state, feature]);
}

export function useLimit(limit: LimitId): { plan: PlanTier; max: number | null } {
  const state = useTenantState();
  return useMemo(() => {
    const t = readTenant(state);
    const plan = resolvePlanTier({
      subscription_status: t?.subscription_status ?? null,
      plan_tier: t?.plan_tier ?? null,
    });
    return { plan, max: resolveLimit(plan, limit, t?.usage_limits ?? null) };
  }, [state, limit]);
}

export { planAllows };
