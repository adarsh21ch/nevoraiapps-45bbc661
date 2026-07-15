/**
 * WhatsApp automation — owner-facing server functions.
 *
 * All handlers verify the caller is an owner/admin of the target tenant. No
 * privileged provider details ever cross back to the client.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertTenantOwner(
  ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> } },
  userId: string,
  tenantId: string,
): Promise<void> {
  const { data: owner } = await ctx.supabase.rpc("is_tenant_owner", {
    _uid: userId,
    _tenant: tenantId,
  });
  if (owner) return;
  const { data: admin } = await ctx.supabase.rpc("is_platform_admin", { _uid: userId });
  if (admin) return;
  throw new Error("Forbidden: owner role required");
}

// ---------------------------------------------------------------------------
// Provider config (adapter selector)
// ---------------------------------------------------------------------------

export const saveWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        adapter: z.enum(["mock", "meta", "botbiz"]),
        enabled: z.boolean(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertTenantOwner(context, context.userId, data.tenantId);

    const { data: existing } = await context.supabase
      .from("automation_provider_configs")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("provider_key", "whatsapp")
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("automation_provider_configs")
        .update({
          config: { adapter: data.adapter } as never,
          enabled: data.enabled,
        })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("automation_provider_configs").insert({
        tenant_id: data.tenantId,
        provider_key: "whatsapp",
        config: { adapter: data.adapter } as never,
        enabled: data.enabled,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const loadWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ tenantId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertTenantOwner(context, context.userId, data.tenantId);
    const { data: row } = await context.supabase
      .from("automation_provider_configs")
      .select("config, enabled")
      .eq("tenant_id", data.tenantId)
      .eq("provider_key", "whatsapp")
      .maybeSingle();
    const r = row as { config?: { adapter?: string }; enabled?: boolean } | null;
    return {
      adapter: r?.config?.adapter ?? "mock",
      enabled: r?.enabled ?? true,
    };
  });

// ---------------------------------------------------------------------------
// Enable/disable the check-in and check-out WhatsApp rules
// ---------------------------------------------------------------------------

const CHECK_IN_NAME = "WhatsApp: Parent check-in notification";
const CHECK_OUT_NAME = "WhatsApp: Parent check-out notification";

export const toggleWhatsAppRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        checkIn: z.boolean(),
        checkOut: z.boolean(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertTenantOwner(context, context.userId, data.tenantId);

    async function upsert(
      name: string,
      eventType: string,
      enabled: boolean,
    ): Promise<void> {
      const { data: existing } = await context.supabase
        .from("automation_rules")
        .select("id")
        .eq("tenant_id", data.tenantId)
        .eq("name", name)
        .maybeSingle();
      if (existing) {
        await context.supabase
          .from("automation_rules")
          .update({ enabled })
          .eq("id", (existing as { id: string }).id);
        return;
      }
      await context.supabase.from("automation_rules").insert({
        tenant_id: data.tenantId,
        name,
        description: `Sends a WhatsApp message to the parent when ${eventType}.`,
        event_type: eventType,
        conditions: [] as never,
        actions: [
          {
            type: "notification.whatsapp",
            provider: "whatsapp",
            params: {},
            max_attempts: 3,
            dedupe_key: "wa:{{event.id}}",
          },
        ] as never,
        enabled,
        priority: 10,
      });
    }

    await upsert(CHECK_IN_NAME, "attendance.marked", data.checkIn);
    await upsert(CHECK_OUT_NAME, "student.check_out", data.checkOut);
    return { ok: true };
  });

export const loadWhatsAppRuleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ tenantId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertTenantOwner(context, context.userId, data.tenantId);
    const { data: rows } = await context.supabase
      .from("automation_rules")
      .select("name, enabled")
      .eq("tenant_id", data.tenantId)
      .in("name", [CHECK_IN_NAME, CHECK_OUT_NAME]);
    const list = (rows ?? []) as { name: string; enabled: boolean }[];
    return {
      checkIn: list.find((r) => r.name === CHECK_IN_NAME)?.enabled ?? false,
      checkOut: list.find((r) => r.name === CHECK_OUT_NAME)?.enabled ?? false,
    };
  });

// ---------------------------------------------------------------------------
// Send a test message (bypasses attendance) — dispatches provider directly
// ---------------------------------------------------------------------------

export const sendTestWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        studentId: z.string().uuid(),
        eventType: z.enum(["attendance.marked", "student.check_out"]),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertTenantOwner(context, context.userId, data.tenantId);

    // Route through the real engine path so audit/deliveries look identical
    // to production traffic. We emit a synthetic event tagged as a test and
    // process it inline instead of waiting for the tick.
    const { data: eventRow, error: eventErr } = await context.supabase
      .from("automation_events")
      .insert({
        tenant_id: data.tenantId,
        event_type: data.eventType,
        source_module: "automation-test",
        source_id: data.studentId,
        payload: { student_id: data.studentId, test: true } as never,
      })
      .select("id")
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    const eventId = (eventRow as { id?: string } | null)?.id ?? null;
    if (!eventId) throw new Error("Failed to create test event");

    // Kick the engine immediately so the demo shows Queued → Sending → Delivered.
    const { processPendingEvents } = await import("@/lib/automation/engine.server");
    const summary = await processPendingEvents(10);
    return { ok: true, eventId, summary };
  });
