/**
 * Push Admin server functions — Platform-Admin-only aggregations, tables,
 * device management, and manual dispatch for the /platform-admin/push
 * dashboard.
 *
 * All fns run under `requireSupabaseAuth` and re-verify platform-admin via
 * the `is_platform_admin` RPC. No bypass of the automation engine — manual
 * test pushes go through the existing `pushProvider.dispatch`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------------------------------------------------------------ helpers

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

// =================================================================== OVERVIEW

export const getPushDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [totalRes, iosRes, androidRes, webRes, day, week, month, disabled, active] =
      await Promise.all([
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("platform", "ios"),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("platform", "android"),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("platform", "web"),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).gte("last_seen_at", dayAgo).eq("enabled", true),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).gte("last_seen_at", weekAgo).eq("enabled", true),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).gte("last_seen_at", monthAgo).eq("enabled", true),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("enabled", false),
        supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }).eq("enabled", true),
      ]);

    // Delivery stats last 24h + retry queue.
    const [{ data: deliveries }, sentToday, deliveredToday, failedToday, pending, retryQueue] =
      await Promise.all([
        supabaseAdmin
          .from("automation_deliveries")
          .select("status, error, created_at")
          .eq("channel", "push")
          .gte("created_at", dayAgo)
          .limit(5000),
        supabaseAdmin.from("automation_deliveries").select("id", { count: "exact", head: true }).eq("channel", "push").gte("created_at", dayAgo),
        supabaseAdmin.from("automation_deliveries").select("id", { count: "exact", head: true }).eq("channel", "push").eq("status", "delivered").gte("created_at", dayAgo),
        supabaseAdmin.from("automation_deliveries").select("id", { count: "exact", head: true }).eq("channel", "push").eq("status", "failed").gte("created_at", dayAgo),
        supabaseAdmin.from("automation_deliveries").select("id", { count: "exact", head: true }).eq("channel", "push").in("status", ["queued", "sending"]),
        supabaseAdmin.from("automation_executions").select("id", { count: "exact", head: true }).eq("action_type", "notification.push").in("status", ["retrying", "queued"]),
      ]);

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
        active: active.count ?? 0,
        disabled: disabled.count ?? 0,
        by_platform: {
          ios: iosRes.count ?? 0,
          android: androidRes.count ?? 0,
          web: webRes.count ?? 0,
        },
        active_24h: day.count ?? 0,
        active_7d: week.count ?? 0,
        active_30d: month.count ?? 0,
      },
      deliveries_24h: {
        total: rows.length,
        sent: sentToday.count ?? 0,
        delivered: deliveredToday.count ?? 0,
        failed: failedToday.count ?? 0,
        pending: pending.count ?? 0,
        retry_queue: retryQueue.count ?? 0,
        by_status: statusBuckets,
        by_error: Array.from(errorBuckets.entries())
          .map(([kind, count]) => ({ kind, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    };
  });

// ============================================================ PROVIDER HEALTH

export const getPushProvidersHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Recent per-adapter stats (24h) — success/failure/latency/last activity.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("automation_deliveries")
      .select("adapter, status, error, duration_ms, created_at, delivered_at")
      .eq("channel", "push")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(5000);

    type Row = {
      adapter: string | null;
      status: string;
      error: string | null;
      duration_ms: number | null;
      created_at: string;
      delivered_at: string | null;
    };

    const stats = new Map<
      string,
      {
        adapter: string;
        total: number;
        delivered: number;
        failed: number;
        latencies: number[];
        last_success: string | null;
        last_failure: string | null;
        last_error: string | null;
      }
    >();

    const known = ["expo", "web-push"];
    for (const k of known) {
      stats.set(k, {
        adapter: k,
        total: 0,
        delivered: 0,
        failed: 0,
        latencies: [],
        last_success: null,
        last_failure: null,
        last_error: null,
      });
    }

    for (const r of (rows ?? []) as Row[]) {
      const key = r.adapter ?? "unknown";
      let s = stats.get(key);
      if (!s) {
        s = {
          adapter: key,
          total: 0,
          delivered: 0,
          failed: 0,
          latencies: [],
          last_success: null,
          last_failure: null,
          last_error: null,
        };
        stats.set(key, s);
      }
      s.total += 1;
      if (r.duration_ms != null) s.latencies.push(r.duration_ms);
      if (r.status === "delivered") {
        s.delivered += 1;
        if (!s.last_success) s.last_success = r.delivered_at ?? r.created_at;
      } else if (r.status === "failed") {
        s.failed += 1;
        if (!s.last_failure) {
          s.last_failure = r.created_at;
          s.last_error = r.error;
        }
      }
    }

    const providerLabels: Record<string, string> = {
      expo: "Expo Push",
      "web-push": "Web Push (VAPID)",
      mock: "Mock",
    };

    // Configured provider readiness (env-based).
    const readiness: Record<string, boolean> = {
      expo: true, // public tier requires no key
      "web-push": Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    };

    // Live queue size per adapter.
    const { data: queueRows } = await supabaseAdmin
      .from("automation_deliveries")
      .select("adapter, status")
      .eq("channel", "push")
      .in("status", ["queued", "sending"])
      .limit(2000);
    const queueSizes = new Map<string, number>();
    for (const r of (queueRows ?? []) as Array<{ adapter: string | null }>) {
      const k = r.adapter ?? "unknown";
      queueSizes.set(k, (queueSizes.get(k) ?? 0) + 1);
    }

    const providers = Array.from(stats.values()).map((s) => {
      const avg =
        s.latencies.length > 0
          ? Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length)
          : null;
      const errorRate = s.total > 0 ? s.failed / s.total : 0;
      let health: "healthy" | "warning" | "offline";
      if (!readiness[s.adapter]) health = "offline";
      else if (s.total === 0) health = "healthy";
      else if (errorRate >= 0.5) health = "offline";
      else if (errorRate >= 0.15) health = "warning";
      else health = "healthy";
      return {
        key: s.adapter,
        label: providerLabels[s.adapter] ?? s.adapter,
        health,
        ready: readiness[s.adapter] ?? true,
        total_24h: s.total,
        delivered_24h: s.delivered,
        failed_24h: s.failed,
        error_rate: errorRate,
        avg_latency_ms: avg,
        last_success_at: s.last_success,
        last_failure_at: s.last_failure,
        last_error: s.last_error,
        queue_size: queueSizes.get(s.adapter) ?? 0,
      };
    });

    return { providers };
  });

// ============================================================== DELIVERY LOGS

const deliveriesFiltersSchema = z.object({
  tenantId: z.string().uuid().optional(),
  status: z.enum(["queued", "sending", "delivered", "failed"]).optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  eventType: z.string().max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  onlyFailed: z.boolean().optional(),
});

export const listPushDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deliveriesFiltersSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("automation_deliveries")
      .select(
        "id, tenant_id, event_id, student_id, adapter, recipient_name, recipient_number, message, status, error, attempts, sent_at, delivered_at, created_at",
        { count: "exact" },
      )
      .eq("channel", "push");

    if (data.tenantId) query = query.eq("tenant_id", data.tenantId);
    if (data.status) query = query.eq("status", data.status);
    if (data.onlyFailed) query = query.eq("status", "failed");
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);
    if (data.search)
      query = query.or(
        `message.ilike.%${data.search}%,error.ilike.%${data.search}%,recipient_name.ilike.%${data.search}%`,
      );

    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    // Batch resolve tenant names + event types + push_devices platform.
    const deliveries = (rows ?? []) as Array<{
      id: string;
      tenant_id: string;
      event_id: string | null;
      recipient_number: string | null;
      status: string;
      [k: string]: unknown;
    }>;
    const tenantIds = Array.from(new Set(deliveries.map((d) => d.tenant_id).filter(Boolean)));
    const eventIds = Array.from(new Set(deliveries.map((d) => d.event_id).filter((v): v is string => !!v)));
    const tokenPrefixes = Array.from(
      new Set(deliveries.map((d) => d.recipient_number).filter((v): v is string => !!v)),
    );

    const [tRes, eRes, dRes] = await Promise.all([
      tenantIds.length
        ? supabaseAdmin.from("tenants").select("id, name, slug").in("id", tenantIds)
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? supabaseAdmin.from("automation_events").select("id, event_type").in("id", eventIds)
        : Promise.resolve({ data: [] }),
      tokenPrefixes.length
        ? supabaseAdmin
            .from("push_devices")
            .select("expo_push_token, platform, user_id")
            .in("expo_push_token", tokenPrefixes.map((p) => p)) // exact prefix stored in recipient_number
        : Promise.resolve({ data: [] }),
    ]);

    const tenantMap = new Map(((tRes.data as Array<{ id: string; name: string; slug: string }>) ?? []).map((t) => [t.id, t]));
    const eventMap = new Map(((eRes.data as Array<{ id: string; event_type: string }>) ?? []).map((e) => [e.id, e.event_type]));
    // recipient_number is a 32-char prefix; we cannot join reliably. Try LIKE match by
    // pulling the platform from any device whose token starts with the prefix.
    let deviceRows: Array<{ expo_push_token: string; platform: string; user_id: string }> = [];
    if (tokenPrefixes.length > 0) {
      const orList = tokenPrefixes.map((p) => `expo_push_token.like.${p}%`).join(",");
      const { data: dbRows } = await supabaseAdmin
        .from("push_devices")
        .select("expo_push_token, platform, user_id")
        .or(orList)
        .limit(500);
      deviceRows = (dbRows ?? []) as typeof deviceRows;
    }
    const platformByPrefix = new Map<string, { platform: string; user_id: string }>();
    for (const d of deviceRows) {
      const prefix = d.expo_push_token.slice(0, 32);
      if (!platformByPrefix.has(prefix)) {
        platformByPrefix.set(prefix, { platform: d.platform, user_id: d.user_id });
      }
    }
    // Suppress unused var warning
    void dRes;

    const enriched = deliveries.map((d) => {
      const tenant = tenantMap.get(d.tenant_id);
      const eventType = d.event_id ? eventMap.get(d.event_id) ?? null : null;
      const dev = d.recipient_number ? platformByPrefix.get(d.recipient_number) : undefined;
      const eventTypeMatch = data.eventType && eventType !== data.eventType;
      const platformMatch = data.platform && dev?.platform !== data.platform;
      return {
        ...d,
        tenant_name: tenant?.name ?? null,
        tenant_slug: tenant?.slug ?? null,
        event_type: eventType,
        platform: dev?.platform ?? null,
        recipient_user_id: dev?.user_id ?? null,
        _filtered: eventTypeMatch || platformMatch,
      };
    });

    // Apply post-filters (event_type / platform) client-side of DB call.
    const filtered = enriched.filter((r) => !r._filtered).map(({ _filtered, ...rest }) => {
      void _filtered;
      return rest;
    });

    return {
      rows: filtered,
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

// ============================================================ DEVICE MANAGEMENT

const devicesFiltersSchema = z.object({
  tenantId: z.string().uuid().optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  enabled: z.boolean().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const listPushDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => devicesFiltersSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Never select expo_push_token — it stays server-side.
    let q = supabaseAdmin
      .from("push_devices")
      .select(
        "id, tenant_id, user_id, device_id, platform, app_version, locale, enabled, disabled_reason, last_seen_at, created_at, updated_at",
        { count: "exact" },
      );
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    if (data.platform) q = q.eq("platform", data.platform);
    if (typeof data.enabled === "boolean") q = q.eq("enabled", data.enabled);
    if (data.search) q = q.or(`device_id.ilike.%${data.search}%,app_version.ilike.%${data.search}%,locale.ilike.%${data.search}%`);

    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.order("last_seen_at", { ascending: false, nullsFirst: false }).range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const items = (rows ?? []) as Array<{ id: string; tenant_id: string; user_id: string; [k: string]: unknown }>;
    const tenantIds = Array.from(new Set(items.map((d) => d.tenant_id).filter(Boolean)));
    const userIds = Array.from(new Set(items.map((d) => d.user_id).filter(Boolean)));

    const [tenants, students] = await Promise.all([
      tenantIds.length
        ? supabaseAdmin.from("tenants").select("id, name, slug").in("id", tenantIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? supabaseAdmin.from("students").select("user_id, name, email").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);
    const tenantMap = new Map(
      ((tenants.data as Array<{ id: string; name: string; slug: string }>) ?? []).map((t) => [t.id, t]),
    );
    const studentMap = new Map(
      ((students.data as Array<{ user_id: string; name: string | null; email: string | null }>) ?? []).map(
        (s) => [s.user_id, s],
      ),
    );

    return {
      rows: items.map((d) => ({
        ...d,
        tenant_name: tenantMap.get(d.tenant_id)?.name ?? null,
        tenant_slug: tenantMap.get(d.tenant_id)?.slug ?? null,
        user_name: studentMap.get(d.user_id)?.name ?? null,
        user_email: studentMap.get(d.user_id)?.email ?? null,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const setPushDeviceEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_devices")
      .update({
        enabled: data.enabled,
        disabled_reason: data.enabled ? null : "Disabled by platform admin",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================== RETRY / FAIL

/**
 * Re-queues a failed delivery by re-emitting its source automation event.
 * The engine's normal tick then re-evaluates the rule → dispatches through
 * the push provider. We do NOT bypass the engine or write directly to the
 * push adapter.
 */
export const retryFailedDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: delivery } = await supabaseAdmin
      .from("automation_deliveries")
      .select("id, tenant_id, event_id, status")
      .eq("id", data.id)
      .maybeSingle();
    const d = delivery as { id: string; tenant_id: string; event_id: string | null; status: string } | null;
    if (!d) throw new Error("Delivery not found");
    if (d.status !== "failed") throw new Error("Only failed deliveries can be retried");
    if (!d.event_id) throw new Error("Delivery has no source event to re-emit");

    const { data: evt } = await supabaseAdmin
      .from("automation_events")
      .select("event_type, source_module, source_id, payload")
      .eq("id", d.event_id)
      .maybeSingle();
    const e = evt as {
      event_type: string;
      source_module: string | null;
      source_id: string | null;
      payload: Record<string, unknown> | null;
    } | null;
    if (!e) throw new Error("Source event not found");

    const { data: inserted, error } = await supabaseAdmin
      .from("automation_events")
      .insert({
        tenant_id: d.tenant_id,
        event_type: e.event_type,
        source_module: e.source_module,
        source_id: e.source_id,
        payload: { ...(e.payload ?? {}), _retry_of_delivery: d.id },
        status: "pending",
      } as never)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, event_id: (inserted as { id: string } | null)?.id ?? null };
  });

/**
 * Marks a failed delivery as ignored so it stops showing in the failure center.
 * We flag it with a sentinel error suffix and status stays 'failed'.
 */
export const ignoreFailedDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("automation_deliveries")
      .update({ status: "ignored" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================================================================== TEST PUSH

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        deviceId: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        subtitle: z.string().max(120).optional(),
        body: z.string().min(1).max(400),
        deepLink: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve tenant from a user_role (or fall back to a device row's tenant).
    let tenantId: string | null = null;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", data.userId)
      .not("tenant_id", "is", null)
      .limit(1)
      .maybeSingle();
    tenantId = (role as { tenant_id: string | null } | null)?.tenant_id ?? null;
    if (!tenantId) {
      const { data: dev } = await supabaseAdmin
        .from("push_devices")
        .select("tenant_id")
        .eq("user_id", data.userId)
        .limit(1)
        .maybeSingle();
      tenantId = (dev as { tenant_id: string | null } | null)?.tenant_id ?? null;
    }
    if (!tenantId) throw new Error("Cannot resolve tenant for user");

    // Write a real automation_event so the delivery/history rows point at it.
    const { data: eventRow, error: evErr } = await supabaseAdmin
      .from("automation_events")
      .insert({
        tenant_id: tenantId,
        event_type: "platform_admin.test_push",
        source_module: "platform-admin",
        source_id: context.userId,
        payload: {
          triggered_by: context.userId,
          user_id: data.userId,
          device_id: data.deviceId ?? null,
        },
        status: "processed",
      } as never)
      .select("id, tenant_id, event_type, source_module, source_id, payload, status, created_at")
      .maybeSingle();
    if (evErr || !eventRow) throw new Error(evErr?.message ?? "Failed to record test event");

    // Dispatch through the real push provider — same code path as automated
    // notifications, so deliveries + notifications + adapter selection all run.
    const { pushProvider } = await import("./providers/push");
    const result = await pushProvider.dispatch({
      tenantId,
      event: eventRow as never,
      rule: null,
      attempt: 1,
      action: {
        type: "notification.push",
        params: {
          recipient_user_ids: [data.userId],
          title: data.title,
          body: data.body,
          subtitle: data.subtitle,
          deep_link: data.deepLink,
          category: "test",
          priority: "high",
          data: { test: true, admin_user: context.userId },
        },
      },
    });

    // Force a serializable DTO — the ActionResult.data field is unknown-indexed
    // which the server-fn RPC boundary rejects.
    return {
      ok: result.ok,
      provider: result.provider,
      error: result.error ?? null,
      retryable: result.retryable ?? false,
      preview: (result.data as { preview?: string } | undefined)?.preview ?? null,
      recipients:
        typeof (result.data as { recipients?: number } | undefined)?.recipients === "number"
          ? (result.data as { recipients: number }).recipients
          : 0,
      succeeded:
        typeof (result.data as { succeeded?: number } | undefined)?.succeeded === "number"
          ? (result.data as { succeeded: number }).succeeded
          : 0,
      failed:
        typeof (result.data as { failed?: number } | undefined)?.failed === "number"
          ? (result.data as { failed: number }).failed
          : 0,
    };
  });

// =============================================================== USER LOOKUP

export const searchAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Search students (they carry name + email + user_id). Platform admin can
    // reach every tenant here — RLS is bypassed via supabaseAdmin.
    const { data: rows } = await supabaseAdmin
      .from("students")
      .select("user_id, name, email, tenant_id")
      .not("user_id", "is", null)
      .or(`name.ilike.%${data.q}%,email.ilike.%${data.q}%`)
      .limit(15);
    const users = ((rows ?? []) as Array<{
      user_id: string | null;
      name: string | null;
      email: string | null;
      tenant_id: string | null;
    }>)
      .filter((r): r is { user_id: string; name: string | null; email: string | null; tenant_id: string | null } =>
        Boolean(r.user_id),
      )
      .map((r) => ({ id: r.user_id, full_name: r.name, email: r.email, tenant_id: r.tenant_id }));
    return { users };
  });

// ================================================================== ANALYTICS

export const getPushAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    start.setUTCHours(0, 0, 0, 0);
    const fromIso = start.toISOString();

    const [{ data: dRows }, { data: devRows }] = await Promise.all([
      supabaseAdmin
        .from("automation_deliveries")
        .select("status, created_at, adapter")
        .eq("channel", "push")
        .gte("created_at", fromIso)
        .limit(20000),
      supabaseAdmin
        .from("push_devices")
        .select("created_at, platform, enabled")
        .gte("created_at", fromIso)
        .limit(20000),
    ]);

    const days: Record<string, {
      date: string;
      total: number;
      delivered: number;
      failed: number;
    }> = {};
    const day = (iso: string) => iso.slice(0, 10);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
      days[d] = { date: d, total: 0, delivered: 0, failed: 0 };
    }
    for (const r of ((dRows as Array<{ status: string; created_at: string }>) ?? [])) {
      const key = day(r.created_at);
      const bucket = days[key];
      if (!bucket) continue;
      bucket.total += 1;
      if (r.status === "delivered") bucket.delivered += 1;
      if (r.status === "failed") bucket.failed += 1;
    }

    const platformSplit = { ios: 0, android: 0, web: 0 };
    const growth: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
      growth[d] = 0;
    }
    for (const r of ((devRows as Array<{ created_at: string; platform: string; enabled: boolean }>) ?? [])) {
      if (r.platform in platformSplit) platformSplit[r.platform as keyof typeof platformSplit] += 1;
      const k = day(r.created_at);
      if (k in growth) growth[k] += 1;
    }

    return {
      daily: Object.values(days),
      platform: platformSplit,
      device_growth: Object.entries(growth).map(([date, count]) => ({ date, count })),
    };
  });

// =========================================================== CLEANUP / MAINT

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

export const retryAllFailedPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: failed } = await supabaseAdmin
      .from("automation_deliveries")
      .select("id, tenant_id, event_id")
      .eq("channel", "push")
      .eq("status", "failed")
      .gte("created_at", oneHourAgo)
      .limit(200);

    const eventIds = Array.from(
      new Set(((failed as Array<{ event_id: string | null }>) ?? []).map((r) => r.event_id).filter((x): x is string => !!x)),
    );
    if (eventIds.length === 0) return { requeued: 0 };

    const { data: events } = await supabaseAdmin
      .from("automation_events")
      .select("id, tenant_id, event_type, source_module, source_id, payload")
      .in("id", eventIds);

    const toInsert = ((events as Array<{
      tenant_id: string;
      event_type: string;
      source_module: string | null;
      source_id: string | null;
      payload: Record<string, unknown> | null;
    }>) ?? []).map((e) => ({
      tenant_id: e.tenant_id,
      event_type: e.event_type,
      source_module: e.source_module,
      source_id: e.source_id,
      payload: { ...(e.payload ?? {}), _bulk_retry: true },
      status: "pending",
    }));
    if (toInsert.length === 0) return { requeued: 0 };
    const { data: ins } = await supabaseAdmin
      .from("automation_events")
      .insert(toInsert as never)
      .select("id");
    return { requeued: (ins ?? []).length };
  });

// Kept for API stability with the earlier Expo-only variant.
export const pushProviderHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const start = Date.now();
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", { method: "OPTIONS" });
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
