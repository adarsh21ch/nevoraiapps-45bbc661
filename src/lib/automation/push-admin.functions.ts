/**
 * Push Admin server functions — Platform-Admin-only aggregations for the
 * new "Push" tab in the Communication Center.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(
  supabase: unknown,
  userId: string,
): Promise<void> {
  const rpc = (supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc;
  const { data, error } = await rpc("is_platform_admin", { _user_id: userId });
  if (error) throw new Error("Authorization check failed");
  if (!data) throw new Error("Forbidden: platform admin only");
}

export const getPushDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Device counts by platform + activity window.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [totalRes, iosRes, androidRes, webRes, day, week, month, disabled] =
      await Promise.all([
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .eq("platform", "ios")
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .eq("platform", "android")
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .eq("platform", "web")
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .gte("last_seen_at", dayAgo)
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .gte("last_seen_at", weekAgo)
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .gte("last_seen_at", monthAgo)
          .eq("enabled", true),
        supabaseAdmin
          .from("push_devices")
          .select("id", { count: "exact", head: true })
          .eq("enabled", false),
      ]);

    // Delivery stats last 24h scoped to push channel.
    const { data: deliveries } = await supabaseAdmin
      .from("automation_deliveries")
      .select("status, error, created_at")
      .eq("channel", "push")
      .gte("created_at", dayAgo)
      .limit(5000);

    const rows = (deliveries ?? []) as Array<{ status: string; error: string | null }>;
    const statusBuckets = { queued: 0, sending: 0, delivered: 0, failed: 0, other: 0 };
    const errorBuckets = new Map<string, number>();
    for (const r of rows) {
      const key = (r.status as keyof typeof statusBuckets) ?? "other";
      if (key in statusBuckets) statusBuckets[key] += 1;
      else statusBuckets.other += 1;
      if (r.status === "failed" && r.error) {
        const kind = r.error.split(/[:(]/)[0]?.trim() || "Other";
        errorBuckets.set(kind, (errorBuckets.get(kind) ?? 0) + 1);
      }
    }

    return {
      devices: {
        total: totalRes.count ?? 0,
        by_platform: {
          ios: iosRes.count ?? 0,
          android: androidRes.count ?? 0,
          web: webRes.count ?? 0,
        },
        active_24h: day.count ?? 0,
        active_7d: week.count ?? 0,
        active_30d: month.count ?? 0,
        disabled: disabled.count ?? 0,
      },
      deliveries_24h: {
        total: rows.length,
        by_status: statusBuckets,
        by_error: Array.from(errorBuckets.entries())
          .map(([kind, count]) => ({ kind, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    };
  });

export const cleanupStalePushDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("push_devices")
      .update({ enabled: false, disabled_reason: "Inactive > 90 days" } as never)
      .lt("last_seen_at", cutoff)
      .eq("enabled", true)
      .select("id");
    return { disabled: (data ?? []).length };
  });

export const purgeDisabledPushDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabaseAdmin
      .from("push_devices")
      .delete()
      .eq("enabled", false)
      .lt("updated_at", cutoff)
      .select("id");
    return { purged: (data ?? []).length };
  });

export const pushProviderHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const start = Date.now();
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "OPTIONS",
      });
      return {
        ok: res.ok || res.status === 204 || res.status === 405,
        status: res.status,
        latency_ms: Date.now() - start,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        latency_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
