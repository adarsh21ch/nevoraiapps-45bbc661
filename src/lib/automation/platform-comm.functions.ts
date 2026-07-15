/**
 * Platform Communication Infrastructure — server functions.
 * All functions require an authenticated platform admin. Providers, accounts,
 * templates, and the Active Provider mapping are managed here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden: platform admin only");
}

export const listCommProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_comm_providers")
      .select("*")
      .order("channel")
      .order("priority");
    if (error) throw error;
    return data ?? [];
  });

export const listCommAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_comm_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listCommActive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_comm_active")
      .select("*");
    if (error) throw error;
    return data ?? [];
  });

export const listCommTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_comm_templates")
      .select("*")
      .order("channel")
      .order("key");
    if (error) throw error;
    return data ?? [];
  });

export const setActiveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        channel: z.string().min(1),
        providerId: z.string().uuid().nullable(),
        accountId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_comm_active")
      .upsert(
        {
          channel: data.channel,
          provider_id: data.providerId,
          account_id: data.accountId ?? null,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const upsertCommAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        providerId: z.string().uuid(),
        label: z.string().min(1),
        status: z.string().optional(),
        credentialsRef: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      provider_id: data.providerId,
      label: data.label,
      status: data.status ?? "disconnected",
      credentials_ref: data.credentialsRef ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("platform_comm_accounts")
        .update(payload)
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("platform_comm_accounts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: (row as { id: string }).id };
  });

export const deleteCommAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_comm_accounts")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const upsertCommTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        channel: z.string(),
        key: z.string(),
        name: z.string(),
        body: z.string(),
        enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      channel: data.channel,
      key: data.key,
      name: data.name,
      body: data.body,
      enabled: data.enabled ?? true,
    };
    const { error } = await supabaseAdmin
      .from("platform_comm_templates")
      .upsert(payload, { onConflict: "channel,key" });
    if (error) throw error;
    return { ok: true };
  });

export const listRecentDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("automation_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const getGatewayHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: execs }, { data: queue }] = await Promise.all([
      supabaseAdmin
        .from("automation_executions")
        .select("status, duration_ms, created_at")
        .gte("created_at", since),
      supabaseAdmin
        .from("automation_events")
        .select("id, status")
        .in("status", ["pending", "processing"]),
    ]);
    const rows = (execs ?? []) as Array<{ status: string; duration_ms: number | null }>;
    const total = rows.length;
    const success = rows.filter((r) => r.status === "success").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const avg =
      rows
        .map((r) => r.duration_ms ?? 0)
        .filter((n) => n > 0)
        .reduce((a, b) => a + b, 0) / Math.max(1, rows.filter((r) => (r.duration_ms ?? 0) > 0).length);
    return {
      total,
      success,
      failed,
      successRate: total ? Math.round((success / total) * 100) : 0,
      avgDurationMs: Math.round(avg || 0),
      queueSize: (queue ?? []).length,
    };
  });

export const listCommChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_comm_channels")
      .select("*")
      .order("display_name");
    if (error) throw error;
    return data ?? [];
  });

export const setProviderPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        providerId: z.string().uuid(),
        priority: z.number().int().min(0).max(1000),
        role: z.enum(["primary", "secondary", "fallback"]).optional(),
        enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { priority: number; role?: string; enabled?: boolean } = {
      priority: data.priority,
    };
    if (data.role) patch.role = data.role;
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    const { error } = await supabaseAdmin
      .from("platform_comm_providers")
      .update(patch)
      .eq("id", data.providerId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Communication Monitor — aggregated stats for the health dashboard.
 * Per-channel, per-provider, per-tenant slices over the last 24h.
 */
export const getCommMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: deliveries }, { data: queue }] = await Promise.all([
      supabaseAdmin
        .from("automation_deliveries")
        .select(
          "id, tenant_id, channel, provider, status, duration_ms, attempts, error, created_at, delivered_at",
        )
        .gte("created_at", since),
      supabaseAdmin
        .from("automation_events")
        .select("id, status")
        .in("status", ["pending", "processing"]),
    ]);
    type Row = {
      id: string;
      tenant_id: string;
      channel: string;
      provider: string | null;
      status: string;
      duration_ms: number | null;
      attempts: number;
      error: string | null;
      created_at: string;
      delivered_at: string | null;
    };
    const rows = (deliveries ?? []) as Row[];
    const total = rows.length;
    const delivered = rows.filter((r) => r.status === "delivered" || r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const queued = rows.filter((r) => r.status === "queued").length;
    const retrying = rows.filter((r) => (r.attempts ?? 0) > 1 && r.status !== "delivered").length;
    const durations = rows.map((r) => r.duration_ms ?? 0).filter((n) => n > 0);
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    function group<K extends string>(key: (r: Row) => K) {
      const map = new Map<K, { total: number; delivered: number; failed: number }>();
      for (const r of rows) {
        const k = key(r);
        const cur = map.get(k) ?? { total: 0, delivered: 0, failed: 0 };
        cur.total += 1;
        if (r.status === "delivered" || r.status === "sent") cur.delivered += 1;
        else if (r.status === "failed") cur.failed += 1;
        map.set(k, cur);
      }
      return Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
    }

    const lastSuccess = rows.find((r) => r.status === "delivered" || r.status === "sent");
    const lastError = rows.find((r) => r.status === "failed" && r.error);

    return {
      total,
      delivered,
      failed,
      queued,
      retrying,
      avgDurationMs: avg,
      queueSize: (queue ?? []).length,
      byChannel: group((r) => r.channel),
      byProvider: group((r) => r.provider ?? "unknown"),
      byTenant: group((r) => r.tenant_id).slice(0, 20),
      lastSuccessAt: lastSuccess?.delivered_at ?? lastSuccess?.created_at ?? null,
      lastError: lastError
        ? { at: lastError.created_at, message: lastError.error, provider: lastError.provider }
        : null,
    };
  });

/**
 * Template preview — renders {{Placeholders}} with sample values on the
 * server so Platform Admin can validate wording without hitting a provider.
 */
export const previewCommTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        templateId: z.string().uuid(),
        variables: z.record(z.string(), z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin
      .from("platform_comm_templates")
      .select("id, channel, key, name, body, variables, category")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw error;
    if (!t) throw new Error("Template not found");
    const tpl = t as {
      body: string;
      variables: string[] | null;
      name: string;
      channel: string;
      key: string;
      category: string;
    };
    const defaults: Record<string, string> = {
      ParentName: "Priya Sharma",
      StudentName: "Arjun Sharma",
      Academy: "Sample Academy",
      Time: new Date().toLocaleTimeString(),
      Amount: "₹4,500",
      DueDate: new Date().toLocaleDateString(),
      Date: new Date().toLocaleDateString(),
      TeamA: "Tigers",
      TeamB: "Sharks",
      ScoreA: "120/4",
      ScoreB: "118/8",
      Winner: "Tigers",
      Venue: "Ground A",
      TournamentName: "Summer Cup",
      Link: "https://example.com",
      Attendance: "42",
      Absent: "3",
      Month: new Date().toLocaleString(undefined, { month: "long" }),
      Name: "New Lead",
      Phone: "+91 90000 00000",
      Program: "Cricket",
    };
    const merged = { ...defaults, ...(data.variables ?? {}) };
    const rendered = tpl.body.replace(/\{\{(\w+)\}\}/g, (_, k) => merged[k] ?? `{{${k}}}`);
    return { name: tpl.name, channel: tpl.channel, key: tpl.key, rendered, category: tpl.category };
  });

/**
 * Provider Sandbox — Platform Admin sends a test through the exact gateway
 * path used in production. No BotBiz/Meta HTTP is triggered yet; the mock
 * adapter still runs the full lifecycle.
 */
export const sendSandboxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        channel: z.enum(["whatsapp", "email", "sms", "push", "webhook"]),
        recipient: z.string().min(3),
        templateId: z.string().uuid().optional(),
        message: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { dispatchThroughGateway, resolveChannel } = await import("@/lib/automation/gateway");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let body = data.message ?? "Sandbox test message";
    if (data.templateId) {
      const { data: t } = await supabaseAdmin
        .from("platform_comm_templates")
        .select("body")
        .eq("id", data.templateId)
        .maybeSingle();
      if (t) body = (t as { body: string }).body;
    }

    const resolution = await resolveChannel(data.channel);
    // Fabricate a minimal automation-engine ActionContext for sandbox use.
    const ctx = {
      tenantId: context.userId, // for observability grouping only
      event: {
        id: `sandbox_${Date.now()}`,
        tenant_id: context.userId,
        type: `sandbox.${data.channel}`,
        payload: { recipient: data.recipient, message: body },
        occurred_at: new Date().toISOString(),
      },
      rule: null,
      execution: {
        id: `sandbox_exec_${Date.now()}`,
        tenant_id: context.userId,
        attempt: 1,
        max_attempts: 1,
      },
      action: {
        type:
          data.channel === "whatsapp"
            ? ("notification.whatsapp" as const)
            : ("notification.create" as const),
        provider: undefined,
        params: { recipient: data.recipient, message: body, sandbox: true },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await dispatchThroughGateway(ctx);
    return {
      requestId: result.requestId,
      resolution: {
        channel: resolution.channel,
        providerId: resolution.providerId,
        adapterKey: resolution.adapterKey,
        accountLabel: resolution.accountLabel,
        ready: resolution.ready,
        secondaryCount: resolution.secondaries.length,
      },
      result: { ok: result.ok, provider: result.provider, error: result.error ?? null },
    };
  });
