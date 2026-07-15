/**
 * WhatsApp provider — resolves adapter per tenant, renders the message from
 * the automation event payload, dispatches via the adapter, and writes a
 * granular `automation_deliveries` row.
 *
 * Server-only. Loaded lazily by the automation engine so the admin client
 * never leaks into a client bundle.
 */

import type { ActionContext, ActionResult } from "../../types";
import type { ActionProvider } from "../index";
import { DEFAULT_WHATSAPP_ADAPTER, getWhatsAppAdapter } from "./registry";
import { buildDefaultMessage, renderTemplate } from "./templates";

interface StudentContact {
  student_id: string | null;
  student_name: string;
  parent_name: string;
  parent_number: string | null;
  preferred_channel: string;
  batch_id: string | null;
  batch_name: string | null;
  coach_name: string | null;
}

async function loadContext(
  tenantId: string,
  studentId: string | null,
): Promise<{ contact: StudentContact | null; academyName: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tenantP = supabaseAdmin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  let contact: StudentContact | null = null;

  if (studentId) {
    const { data: student } = await supabaseAdmin
      .from("students")
      .select(
        "id, name, guardian_name, guardian_phone, phone, batch_id, coach_name, parent_name, parent_mobile, parent_whatsapp, guardian_whatsapp, preferred_notification_channel",
      )
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (student) {
      const s = student as Record<string, string | null>;
      const parentNumber =
        s.parent_whatsapp ||
        s.parent_mobile ||
        s.guardian_whatsapp ||
        s.guardian_phone ||
        s.phone ||
        null;

      let batchName: string | null = null;
      if (s.batch_id) {
        const { data: batch } = await supabaseAdmin
          .from("batches")
          .select("name")
          .eq("id", s.batch_id)
          .maybeSingle();
        batchName = (batch as { name?: string } | null)?.name ?? null;
      }

      contact = {
        student_id: s.id,
        student_name: s.name ?? "Student",
        parent_name: s.parent_name || s.guardian_name || "Parent",
        parent_number: parentNumber,
        preferred_channel: s.preferred_notification_channel || "whatsapp",
        batch_id: s.batch_id,
        batch_name: batchName,
        coach_name: s.coach_name,
      };
    }
  }

  const { data: tenant } = await tenantP;
  const academyName = (tenant as { name?: string } | null)?.name ?? "Your Academy";

  return { contact, academyName };
}

async function resolveAdapterKey(tenantId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("automation_provider_configs")
      .select("config, enabled")
      .eq("tenant_id", tenantId)
      .eq("provider_key", "whatsapp")
      .maybeSingle();
    const row = data as { config?: Record<string, unknown>; enabled?: boolean } | null;
    if (row && row.enabled === false) return "disabled";
    const configured = row?.config?.adapter as string | undefined;
    if (configured) return configured;
  } catch {
    // fall through to default
  }
  return DEFAULT_WHATSAPP_ADAPTER;
}

export const whatsappProvider: ActionProvider = {
  key: "whatsapp",
  handles: ["notification.whatsapp"],
  async dispatch(ctx: ActionContext): Promise<ActionResult> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const params = (ctx.action.params ?? {}) as Record<string, unknown>;
    const studentId =
      (params.student_id as string | undefined) ??
      (ctx.event.payload?.student_id as string | undefined) ??
      null;

    const { contact, academyName } = await loadContext(ctx.tenantId, studentId);
    const adapterKey = await resolveAdapterKey(ctx.tenantId);

    // Build message: explicit `template` param wins, otherwise pick a default
    // for the event type.
    const explicit = typeof params.template === "string" ? (params.template as string) : null;
    const now = new Date();
    const vars = {
      ParentName: contact?.parent_name ?? "Parent",
      StudentName: contact?.student_name ?? "Your child",
      AcademyName: academyName,
      BatchName: contact?.batch_name ?? "Batch",
      CoachName: contact?.coach_name ?? "Coach",
      Time: now.toLocaleTimeString(),
      Date: now.toLocaleDateString(),
    };
    const message = explicit
      ? renderTemplate(explicit, vars)
      : buildDefaultMessage(ctx.event.event_type, vars);

    const recipientNumber =
      (params.to as string | undefined) ??
      contact?.parent_number ??
      null;

    // Insert an initial "queued" delivery row so the UI shows the state
    // immediately, then flip through sending → delivered/failed. Failures
    // early on (no adapter / disabled / missing number) short-circuit here.
    const deliveryInsert = await supabaseAdmin
      .from("automation_deliveries")
      .insert({
        tenant_id: ctx.tenantId,
        rule_id: ctx.rule?.id ?? null,
        event_id: ctx.event.id,
        student_id: studentId,
        channel: "whatsapp",
        provider: "whatsapp",
        adapter: adapterKey,
        recipient_name: contact?.parent_name ?? null,
        recipient_number: recipientNumber,
        message,
        status: "queued",
        attempts: 0,
      })
      .select("id")
      .maybeSingle();

    const deliveryId = (deliveryInsert.data as { id?: string } | null)?.id ?? null;

    async function updateDelivery(patch: Record<string, unknown>): Promise<void> {
      if (!deliveryId) return;
      await supabaseAdmin
        .from("automation_deliveries")
        .update(patch as never)
        .eq("id", deliveryId);
    }

    if (adapterKey === "disabled") {
      await updateDelivery({ status: "failed", error: "WhatsApp provider disabled for tenant" });
      return {
        ok: false,
        provider: "whatsapp",
        error: "WhatsApp provider disabled for tenant",
        retryable: false,
      };
    }
    if (!recipientNumber) {
      await updateDelivery({ status: "failed", error: "No parent contact number on file" });
      return {
        ok: false,
        provider: "whatsapp",
        error: "No parent contact number on file",
        retryable: false,
      };
    }

    const adapter = getWhatsAppAdapter(adapterKey);
    if (!adapter) {
      await updateDelivery({ status: "failed", error: `Unknown WhatsApp adapter: ${adapterKey}` });
      return {
        ok: false,
        provider: "whatsapp",
        error: `Unknown WhatsApp adapter: ${adapterKey}`,
        retryable: false,
      };
    }
    if (!adapter.ready) {
      await updateDelivery({ status: "failed", error: `Adapter '${adapter.key}' is not wired yet` });
      return {
        ok: false,
        provider: "whatsapp",
        error: `Adapter '${adapter.key}' is not wired yet`,
        retryable: false,
      };
    }

    await updateDelivery({ status: "sending", attempts: ctx.attempt });
    const start = Date.now();

    const res = await adapter.send({
      tenantId: ctx.tenantId,
      to: recipientNumber,
      recipientName: contact?.parent_name ?? null,
      message,
      context: {
        student_id: studentId,
        event_id: ctx.event.id,
        rule_id: ctx.rule?.id ?? null,
      },
    });

    const durationMs = Date.now() - start;

    await updateDelivery({
      status: res.status,
      attempts: ctx.attempt,
      duration_ms: durationMs,
      provider_message_id: res.provider_message_id ?? null,
      error: res.error ?? null,
      sent_at: res.ok ? new Date().toISOString() : null,
      delivered_at: res.status === "delivered" ? new Date().toISOString() : null,
    });

    return {
      ok: res.ok,
      provider: `whatsapp.${adapter.key}`,
      data: {
        adapter: adapter.key,
        recipient: recipientNumber,
        recipient_name: contact?.parent_name ?? null,
        student_id: studentId,
        provider_message_id: res.provider_message_id ?? null,
        status: res.status,
        preview: message.slice(0, 160),
        delivery_id: deliveryId,
      },
      error: res.error,
      retryable: res.retryable ?? !res.ok,
    };
  },
};
