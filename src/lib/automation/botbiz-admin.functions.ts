/**
 * BotBiz — Platform Admin server functions.
 *
 * All handlers require an authenticated platform admin. Secrets never cross
 * the RPC boundary; only presence flags and sanitized status data are
 * returned.
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

export const getBotBizStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { validateBotBizConfiguration, botbizHealthCheck } = await import(
      "@/lib/automation/providers/whatsapp/adapters/botbiz"
    );
    const validation = validateBotBizConfiguration();
    if (!validation.ok) {
      return {
        configured: false,
        reason: validation.reason ?? "Not configured",
        health: null as null | Awaited<ReturnType<typeof botbizHealthCheck>>,
        config: null,
      };
    }
    const health = await botbizHealthCheck();
    return {
      configured: true,
      reason: null,
      health,
      config: validation.config ?? null,
    };
  });

export const runBotBizHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { botbizHealthCheck } = await import(
      "@/lib/automation/providers/whatsapp/adapters/botbiz"
    );
    return botbizHealthCheck();
  });

export const sendBotBizTest = createServerFn({ method: "POST" })
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
    const { dispatchThroughGateway, resolveChannel } = await import(
      "@/lib/automation/gateway"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const resolution = await resolveChannel("whatsapp");

    const now = new Date().toISOString();
    const eventInsert = await supabaseAdmin
      .from("automation_events")
      .insert({
        tenant_id: null,
        event_type: "sandbox.whatsapp.test",
        payload: { to: data.to, message: data.message, initiated_by: context.userId },
        status: "processing",
      })
      .select("id")
      .maybeSingle();
    const eventId = (eventInsert.data as { id?: string } | null)?.id ?? `sandbox_${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx: any = {
      tenantId: context.userId,
      event: {
        id: eventId,
        tenant_id: context.userId,
        event_type: "sandbox.whatsapp.test",
        payload: { to: data.to, message: data.message },
        occurred_at: now,
      },
      rule: null,
      execution: { id: `sandbox_${Date.now()}`, attempt: 1, max_attempts: 1 },
      attempt: 1,
      action: {
        type: "notification.whatsapp",
        provider: undefined,
        params: { to: data.to, template: data.message, sandbox: true },
      },
    };

    const result = await dispatchThroughGateway(ctx);
    return {
      requestId: result.requestId,
      resolution: {
        providerId: resolution.providerId,
        adapterKey: resolution.adapterKey,
        accountLabel: resolution.accountLabel,
        ready: resolution.ready,
      },
      result: {
        ok: result.ok,
        provider: result.provider,
        error: result.error ?? null,
        data: (result.data as Record<string, unknown>) ?? null,
      },
    };
  });

export const sendBotBizTestAttendance = createServerFn({ method: "POST" })
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
    const { dispatchThroughGateway } = await import("@/lib/automation/gateway");
    const { buildDefaultMessage } = await import(
      "@/lib/automation/providers/whatsapp/templates"
    );
    const now = new Date();
    const message = buildDefaultMessage(data.eventType, {
      ParentName: data.parentName,
      StudentName: data.studentName,
      AcademyName: data.academyName,
      CoachName: data.coachName,
      BatchName: "Test Batch",
      Time: now.toLocaleTimeString(),
      Date: now.toLocaleDateString(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx: any = {
      tenantId: context.userId,
      event: {
        id: `sandbox_${Date.now()}`,
        tenant_id: context.userId,
        event_type: data.eventType,
        payload: { synthetic: true },
        occurred_at: now.toISOString(),
      },
      rule: null,
      execution: { id: `sandbox_${Date.now()}`, attempt: 1, max_attempts: 1 },
      attempt: 1,
      action: {
        type: "notification.whatsapp",
        provider: undefined,
        params: { to: data.to, template: message, sandbox: true },
      },
    };

    const result = await dispatchThroughGateway(ctx);
    return {
      requestId: result.requestId,
      result: {
        ok: result.ok,
        provider: result.provider,
        error: result.error ?? null,
      },
      message,
    };
  });

export const getBotBizRecentDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("automation_deliveries")
      .select(
        "id, tenant_id, channel, provider, adapter, recipient_name, recipient_number, status, attempts, duration_ms, error, provider_message_id, sent_at, delivered_at, created_at",
      )
      .eq("adapter", "botbiz")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
