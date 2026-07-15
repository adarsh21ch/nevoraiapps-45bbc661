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
