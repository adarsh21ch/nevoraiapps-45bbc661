/**
 * Usage metering + limit enforcement (Phase 10.1).
 *
 * - `recordUsage`: authenticated tenant members call this after successful
 *   mutations (student created, invoice generated, media uploaded, etc.).
 *   Increments the tenant's monthly counter via the
 *   `increment_feature_usage` SECURITY DEFINER RPC. Fire-and-forget: never
 *   throws.
 * - `checkLimit`: returns `{ allowed, used, max, requiredPlan }` for a meter.
 *   Callers use this to block creation and render `<LimitReachedCard />`.
 * - `getUsageBreakdown`: monthly counts for the current tenant (Founder
 *   Intelligence widget).
 * - `getPlatformSubscriptionSnapshot`: platform-admin plan distribution + MRR.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLAN_META,
  resolveLimit,
  resolvePlanTier,
  type LimitId,
  type PlanTier,
} from "./plans";

// Meters that map to a concrete DB row count. Falls back to feature_usage
// counters for non-countable meters (media_uploads, ai_credits, api_calls…).
const COUNTABLE: Partial<Record<LimitId, { table: string; column?: string }>> = {
  students: { table: "students" },
  coaches: { table: "coach_assignments" },
  staff: { table: "staff_invitations" },
  matches: { table: "mc_matches" },
  tournaments: { table: "mc_tournaments" },
  automation_rules: { table: "automation_rules" },
  campaigns: { table: "comm_campaigns" },
  parents: { table: "profiles" },
};

async function readUsed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId: string,
  meter: LimitId,
): Promise<number> {
  const source = COUNTABLE[meter];
  if (source) {
    const { count } = await supabase
      .from(source.table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    return count ?? 0;
  }
  // Fall back to the monthly feature_usage counter for the current period.
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("feature_usage")
    .select("count")
    .eq("tenant_id", tenantId)
    .eq("feature_id", meter)
    .eq("period_start", periodStart.toISOString().slice(0, 10))
    .maybeSingle();
  return (data?.count as number | undefined) ?? 0;
}

export const recordUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; meter: string; delta?: number }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        meter: z.string().min(1).max(64),
        delta: z.number().int().min(-1000).max(1000).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("increment_feature_usage", {
      _tenant_id: data.tenantId,
      _feature_id: data.meter,
      _delta: data.delta,
    });
    if (error) {
      // Never fail the caller — metering is best-effort.
      // eslint-disable-next-line no-console
      console.warn("[usage] recordUsage failed", data.meter, error.message);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export type LimitCheck = {
  allowed: boolean;
  plan: PlanTier;
  planName: string;
  max: number | null;
  used: number;
  meter: LimitId;
};

export const checkLimit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; meter: LimitId }) =>
    z.object({ tenantId: z.string().uuid(), meter: z.string() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LimitCheck> => {
    const { data: tenant, error } = await context.supabase
      .from("tenants")
      .select("plan_tier, subscription_status, usage_limits")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const plan = resolvePlanTier({
      subscription_status: (tenant?.subscription_status as string | null) ?? null,
      plan_tier: (tenant?.plan_tier as string | null) ?? null,
    });
    const meter = data.meter as LimitId;
    const max = resolveLimit(
      plan,
      meter,
      (tenant?.usage_limits as never) ?? null,
    );
    const used = await readUsed(context.supabase, data.tenantId, meter);
    const allowed = max === null || used < max;
    return { allowed, plan, planName: PLAN_META[plan].name, max, used, meter };
  });

export type UsageBreakdown = {
  plan: PlanTier;
  planName: string;
  rows: Array<{ meter: LimitId; used: number; max: number | null }>;
};

export const getUsageBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<UsageBreakdown> => {
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("plan_tier, subscription_status, usage_limits")
      .eq("id", data.tenantId)
      .maybeSingle();
    const plan = resolvePlanTier({
      subscription_status: (tenant?.subscription_status as string | null) ?? null,
      plan_tier: (tenant?.plan_tier as string | null) ?? null,
    });
    const meters: LimitId[] = [
      "students",
      "coaches",
      "staff",
      "parents",
      "matches",
      "tournaments",
      "automation_rules",
      "campaigns",
      "website_pages",
      "media_uploads",
      "storage_mb",
      "ai_credits",
      "push_notifications",
      "api_calls",
    ];
    const rows = await Promise.all(
      meters.map(async (meter) => ({
        meter,
        used: await readUsed(context.supabase, data.tenantId, meter),
        max: resolveLimit(plan, meter, (tenant?.usage_limits as never) ?? null),
      })),
    );
    return { plan, planName: PLAN_META[plan].name, rows };
  });

export const getPlatformSubscriptionSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("subscription_platform_snapshot");
    if (error) throw new Error(error.message);
    type Row = {
      plan_tier: PlanTier;
      tenant_count: number;
      active_count: number;
      trial_count: number;
      suspended_count: number;
    };
    const rows = ((data ?? []) as Row[]).map((r) => ({
      ...r,
      plan_name: PLAN_META[r.plan_tier]?.name ?? r.plan_tier,
      monthly_price: PLAN_META[r.plan_tier]?.monthlyPrice ?? 0,
      mrr: (PLAN_META[r.plan_tier]?.monthlyPrice ?? 0) * Number(r.active_count),
    }));
    const totalMrr = rows.reduce((s, r) => s + r.mrr, 0);
    return { rows, totalMrr };
  });
