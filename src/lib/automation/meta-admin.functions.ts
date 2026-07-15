/**
 * Meta WhatsApp Cloud API — Platform Admin server functions.
 *
 * Replaces the previous BotBiz admin surface. All handlers require an
 * authenticated platform admin. Secrets never cross the RPC boundary;
 * only sanitized status data is returned.
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

export const getMetaWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { validateMetaConfiguration, metaHealthCheck } = await import(
      "@/lib/automation/providers/whatsapp/adapters/meta"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const validation = validateMetaConfiguration();
    if (!validation.ok) {
      await supabaseAdmin
        .from("platform_comm_providers")
        .update({ ready: false })
        .eq("channel", "whatsapp")
        .eq("adapter_key", "meta");
      return {
        configured: false,
        reason: validation.reason ?? "Not configured",
        health: null as null | Awaited<ReturnType<typeof metaHealthCheck>>,
        config: null,
      };
    }
    const health = await metaHealthCheck();
    await supabaseAdmin
      .from("platform_comm_providers")
      .update({ ready: health.ok })
      .eq("channel", "whatsapp")
      .eq("adapter_key", "meta");
    return {
      configured: true,
      reason: null,
      health,
      config: validation.config ?? null,
    };
  });

export const runMetaHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { metaHealthCheck } = await import(
      "@/lib/automation/providers/whatsapp/adapters/meta"
    );
    return metaHealthCheck();
  });

export const sendMetaTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to: z.string().min(6),
        message: z.string().min(1).max(4096),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { WhatsAppService } = await import("@/lib/automation/whatsapp-service");
    const res = await WhatsAppService.sendText({
      to: { phone: data.to, name: "Sandbox" },
      message: data.message,
      context: { source: "platform-admin.sandbox", userId: context.userId },
    });
    return {
      requestId: res.requestId,
      result: {
        ok: res.ok,
        adapter: res.adapter,
        status: res.status,
        error: res.error ?? null,
        providerMessageId: res.provider_message_id ?? null,
      },
    };
  });

export const sendMetaTestAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        to: z.string().min(6),
        studentName: z.string().default("Test Student"),
        parentName: z.string().default("Test Parent"),
        academyName: z.string().default("Test Academy"),
        coachName: z.string().default("Coach"),
        eventType: z.enum(["student.check_in", "student.check_out"]).default("student.check_in"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { WhatsAppService } = await import("@/lib/automation/whatsapp-service");
    const args = {
      to: { phone: data.to, name: data.parentName },
      studentName: data.studentName,
      parentName: data.parentName,
      academyName: data.academyName,
      coachName: data.coachName,
    };
    const res =
      data.eventType === "student.check_in"
        ? await WhatsAppService.sendCheckIn(args)
        : await WhatsAppService.sendCheckOut(args);
    return {
      requestId: res.requestId,
      result: {
        ok: res.ok,
        adapter: res.adapter,
        status: res.status,
        error: res.error ?? null,
        providerMessageId: res.provider_message_id ?? null,
      },
    };
  });

export const getMetaRecentDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("automation_deliveries")
      .select(
        "id, tenant_id, channel, provider, adapter, recipient_name, recipient_number, status, attempts, duration_ms, error, provider_message_id, sent_at, delivered_at, created_at",
      )
      .eq("adapter", "meta")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
