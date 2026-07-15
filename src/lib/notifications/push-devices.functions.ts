/**
 * Push device registration — server functions callable from client code.
 *
 * The parent (or owner / coach / staff) app calls `registerPushDevice`
 * exactly once after obtaining an Expo push token (native) or a Web-Push
 * subscription JSON (browser PWA). Repeated calls refresh `last_seen_at`
 * and re-enable the row if it was previously disabled.
 *
 * All fns run under `requireSupabaseAuth` so the caller's tenant is
 * derived from their own user_roles row (no client-supplied tenant_id).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registerSchema = z.object({
  deviceId: z.string().min(4).max(200),
  token: z.string().min(4).max(4000),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(64).optional(),
  locale: z.string().max(32).optional(),
});

async function resolveTenantForUser(
  supabase: NonNullable<Parameters<typeof getTenantForUser>[0]>,
  userId: string,
): Promise<string | null> {
  return getTenantForUser(supabase, userId);
}

async function getTenantForUser(
  supabase: unknown,
  userId: string,
): Promise<string | null> {
  const s = supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: unknown }>;
            };
          };
        };
      };
    };
  };
  // Prefer user_roles.tenant_id (owner/admin), fall back to student profile.
  const { data: role } = await s
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tenantFromRole = (role as { tenant_id?: string | null } | null)?.tenant_id;
  if (tenantFromRole) return tenantFromRole;

  const { data: student } = await s
    .from("students")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (student as { tenant_id?: string | null } | null)?.tenant_id ?? null;
}

export const registerPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tenantId = await resolveTenantForUser(context.supabase, context.userId);
    if (!tenantId) {
      throw new Error("Cannot register push device: no tenant found for user");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("push_devices")
      .select("id, user_id")
      .eq("device_id", data.deviceId)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; user_id: string };
      if (row.user_id !== context.userId) {
        // Device was previously owned by another user (shared phone). Take over.
        await supabaseAdmin
          .from("push_devices")
          .update({
            user_id: context.userId,
            tenant_id: tenantId,
            expo_push_token: data.token,
            platform: data.platform,
            app_version: data.appVersion ?? null,
            locale: data.locale ?? null,
            enabled: true,
            disabled_reason: null,
            last_seen_at: nowIso,
          } as never)
          .eq("id", row.id);
        return { ok: true, id: row.id, action: "takeover" as const };
      }
      await supabaseAdmin
        .from("push_devices")
        .update({
          tenant_id: tenantId,
          expo_push_token: data.token,
          platform: data.platform,
          app_version: data.appVersion ?? null,
          locale: data.locale ?? null,
          enabled: true,
          disabled_reason: null,
          last_seen_at: nowIso,
        } as never)
        .eq("id", row.id);
      return { ok: true, id: row.id, action: "refresh" as const };
    }

    // Handle token-collision on other devices (e.g. reinstall reassigned same token).
    await supabaseAdmin
      .from("push_devices")
      .update({ enabled: false, disabled_reason: "Token reassigned" } as never)
      .eq("expo_push_token", data.token)
      .neq("device_id", data.deviceId);

    const inserted = await supabaseAdmin
      .from("push_devices")
      .insert({
        tenant_id: tenantId,
        user_id: context.userId,
        device_id: data.deviceId,
        expo_push_token: data.token,
        platform: data.platform,
        app_version: data.appVersion ?? null,
        locale: data.locale ?? null,
        enabled: true,
        last_seen_at: nowIso,
      } as never)
      .select("id")
      .maybeSingle();

    return {
      ok: true,
      id: (inserted.data as { id?: string } | null)?.id ?? null,
      action: "created" as const,
    };
  });

const unregisterSchema = z.object({ deviceId: z.string().min(4).max(200) });

export const unregisterPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unregisterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_devices")
      .update({ enabled: false, disabled_reason: "User signed out" } as never)
      .eq("device_id", data.deviceId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const pingPushDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unregisterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_devices")
      .update({ last_seen_at: new Date().toISOString() } as never)
      .eq("device_id", data.deviceId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export interface MyPushDevice {
  id: string;
  device_id: string;
  platform: "ios" | "android" | "web";
  app_version: string | null;
  locale: string | null;
  enabled: boolean;
  last_seen_at: string;
  created_at: string;
  disabled_reason: string | null;
}

export const listMyPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ devices: MyPushDevice[] }> => {
    const { data } = await context.supabase
      .from("push_devices")
      .select("id, device_id, platform, app_version, locale, enabled, last_seen_at, created_at, disabled_reason")
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false });
    return { devices: (data ?? []) as unknown as MyPushDevice[] };
  });
