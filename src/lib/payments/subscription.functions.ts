/**
 * Subscription management server functions.
 * - Owner-facing: getSubscriptionOverview (plan + limits + usage snapshot)
 * - Platform admin: setPlanTier, grantTrial, extendPeriod, suspendTenant,
 *   resumeTenant, setFeatureOverride, setLimitOverride.
 *
 * Never uses supabaseAdmin; RLS on `tenants` is enforced through
 * `is_platform_admin` policies + `has_role('owner', tenant)`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FEATURES,
  PLAN_LIMITS,
  PLAN_META,
  resolveFeature,
  resolveLimit,
  resolvePlanTier,
  type FeatureId,
  type LimitId,
  type PlanTier,
} from "./plans";

const TIERS = ["starter", "professional", "enterprise"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_platform_admin", { _uid: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// -------- Owner-facing overview --------

export type SubscriptionOverview = {
  plan: PlanTier;
  planName: string;
  monthlyPrice: number;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  features: Array<{ id: FeatureId; name: string; allowed: boolean; minPlan: PlanTier }>;
  limits: Array<{ id: LimitId; max: number | null; used: number }>;
};

export const getSubscriptionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SubscriptionOverview> => {
    const { data: tenant, error } = await context.supabase
      .from("tenants")
      .select(
        "plan_tier, subscription_status, trial_ends_at, current_period_end, feature_overrides, usage_limits",
      )
      .eq("id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tenant) throw new Error("Tenant not found");

    const t = tenant as {
      plan_tier: string | null;
      subscription_status: string | null;
      trial_ends_at: string | null;
      current_period_end: string | null;
      feature_overrides: Record<string, boolean> | null;
      usage_limits: Record<string, number | null> | null;
    };

    const plan = resolvePlanTier({
      subscription_status: t.subscription_status,
      plan_tier: t.plan_tier,
    });

    const anchor = t.current_period_end ?? t.trial_ends_at ?? null;
    const daysRemaining = anchor
      ? Math.max(0, Math.ceil((new Date(anchor).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    const features = (Object.values(FEATURES) as Array<typeof FEATURES[FeatureId]>).map((f) => ({
      id: f.id,
      name: f.name,
      allowed: resolveFeature(plan, f.id, t.feature_overrides as never),
      minPlan: f.minPlan,
    }));

    const limitIds = Object.keys(PLAN_LIMITS[plan]) as LimitId[];
    const [{ count: studentCount }, { count: coachCount }, { count: matchCount }] = await Promise.all([
      context.supabase.from("students").select("id", { count: "exact", head: true }).eq("tenant_id", data.tenantId),
      context.supabase.from("coach_assignments").select("id", { count: "exact", head: true }).eq("tenant_id", data.tenantId),
      context.supabase.from("mc_matches").select("id", { count: "exact", head: true }).eq("tenant_id", data.tenantId),
    ]);

    const usedMap: Partial<Record<LimitId, number>> = {
      students: studentCount ?? 0,
      coaches: coachCount ?? 0,
      matches: matchCount ?? 0,
    };

    const limits = limitIds.map((id) => ({
      id,
      max: resolveLimit(plan, id, t.usage_limits as never),
      used: usedMap[id] ?? 0,
    }));

    return {
      plan,
      planName: PLAN_META[plan].name,
      monthlyPrice: PLAN_META[plan].monthlyPrice,
      status: t.subscription_status ?? "trial",
      trialEndsAt: t.trial_ends_at,
      currentPeriodEnd: t.current_period_end,
      daysRemaining,
      features,
      limits,
    };
  });

// -------- Platform-admin actions --------

export const setPlanTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; tier: PlanTier }) =>
    z.object({ tenantId: z.string().uuid(), tier: z.enum(TIERS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { error } = await context.supabase
      .from("tenants")
      .update({ plan_tier: data.tier })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, tier: data.tier };
  });

export const grantTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; days: number; tier?: PlanTier }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        days: z.number().int().min(1).max(365),
        tier: z.enum(TIERS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const trialEndsAt = new Date(Date.now() + data.days * 86400_000).toISOString();
    const patch: { trial_ends_at: string; subscription_status: string; plan_tier?: PlanTier } = {
      trial_ends_at: trialEndsAt,
      subscription_status: "trial",
    };
    if (data.tier) patch.plan_tier = data.tier;
    const { error } = await context.supabase.from("tenants").update(patch).eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, trialEndsAt };
  });

export const extendPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; days: number }) =>
    z.object({ tenantId: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { data: row, error: readErr } = await context.supabase
      .from("tenants")
      .select("current_period_end")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const base = row?.current_period_end ? new Date(row.current_period_end) : new Date();
    const next = new Date(base.getTime() + data.days * 86400_000).toISOString();
    const { error } = await context.supabase
      .from("tenants")
      .update({ current_period_end: next })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, currentPeriodEnd: next };
  });

export const suspendTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { error } = await context.supabase
      .from("tenants")
      .update({ status: "suspended" })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resumeTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { error } = await context.supabase
      .from("tenants")
      .update({ status: "active" })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFeatureOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { tenantId: string; feature: string; enabled: boolean | null }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          feature: z.string().min(1).max(64),
          enabled: z.boolean().nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { data: row, error: readErr } = await context.supabase
      .from("tenants")
      .select("feature_overrides")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const next: Record<string, boolean> = { ...((row?.feature_overrides as Record<string, boolean>) ?? {}) };
    if (data.enabled === null) delete next[data.feature];
    else next[data.feature] = data.enabled;
    const { error } = await context.supabase
      .from("tenants")
      .update({ feature_overrides: next })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, overrides: next };
  });

export const setLimitOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { tenantId: string; limit: string; max: number | null }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          limit: z.string().min(1).max(64),
          max: z.number().int().min(0).nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { data: row, error: readErr } = await context.supabase
      .from("tenants")
      .select("usage_limits")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const next: Record<string, number | null> = { ...((row?.usage_limits as Record<string, number | null>) ?? {}) };
    next[data.limit] = data.max;
    const { error } = await context.supabase
      .from("tenants")
      .update({ usage_limits: next })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true, limits: next };
  });
