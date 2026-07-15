/**
 * WhatsAppService — reusable, provider-agnostic API used by business
 * modules (attendance, fees, announcements). Callers never reference
 * Meta / BotBiz / Twilio directly.
 *
 * Two entry points:
 *   1. `WhatsAppService.sendText(...)`     — plain text, resolves the
 *      currently Active provider through the Communication Gateway.
 *   2. `WhatsAppService.sendTemplate(...)` — Meta-style template
 *      message. If the Active adapter is `meta`, this hits the Graph
 *      API directly with the correct template structure. Any other
 *      adapter falls back to a text render.
 *
 * Higher-level helpers (`sendCheckIn`, `sendCheckOut`,
 * `sendPaymentReminder`, `sendAnnouncement`) build the message body
 * from the shared templates module and delegate to `sendText`.
 *
 * Server-only. Never import from client bundles.
 */

import { buildDefaultMessage, renderTemplate } from "./providers/whatsapp/templates";
import type {
  MetaTemplateComponent,
  WhatsAppSendResult,
} from "./providers/whatsapp/adapters/meta";
import { getWhatsAppAdapter, DEFAULT_WHATSAPP_ADAPTER } from "./providers/whatsapp/registry";
import { resolveActiveProvider } from "./gateway";

export interface WhatsAppRecipient {
  phone: string; // E.164 or local; adapter normalizes
  name?: string | null;
}

export interface SendResult extends WhatsAppSendResult {
  requestId: string;
}

function newRequestId(): string {
  return `wa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolve the Active WhatsApp adapter. Falls back to the default (mock)
 * when nothing is configured — the caller decides whether that is
 * acceptable via `requireReady`.
 */
async function resolveAdapterKey(requireReady: boolean): Promise<{
  key: string;
  ready: boolean;
}> {
  try {
    const active = await resolveActiveProvider("whatsapp");
    if (active.adapterKey) {
      return { key: active.adapterKey, ready: active.ready };
    }
  } catch {
    /* fall through */
  }
  if (requireReady) {
    // No active row and caller demanded a real adapter — return the last
    // registered non-mock adapter if any.
    const adapter = getWhatsAppAdapter("meta");
    if (adapter?.ready) return { key: "meta", ready: true };
  }
  return { key: DEFAULT_WHATSAPP_ADAPTER, ready: true };
}

async function loadDelivery(
  status: "queued" | "sending" | "delivered" | "failed",
  adapterKey: string,
  recipient: WhatsAppRecipient,
  message: string,
  tenantId: string | null,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("automation_deliveries")
      .insert({
        tenant_id: tenantId,
        channel: "whatsapp",
        provider: "whatsapp",
        adapter: adapterKey,
        recipient_name: recipient.name ?? null,
        recipient_number: recipient.phone,
        message,
        status,
        attempts: 0,
      })
      .select("id")
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function patchDelivery(
  id: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!id) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("automation_deliveries").update(patch as never).eq("id", id);
  } catch {
    /* logging is best-effort */
  }
}

export interface SendTextArgs {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  message: string;
  context?: Record<string, unknown>;
}

async function sendText(args: SendTextArgs): Promise<SendResult> {
  const requestId = newRequestId();
  const { key: adapterKey } = await resolveAdapterKey(false);
  const adapter = getWhatsAppAdapter(adapterKey);

  const deliveryId = await loadDelivery(
    "sending",
    adapterKey,
    args.to,
    args.message,
    args.tenantId ?? null,
  );

  if (!adapter) {
    await patchDelivery(deliveryId, {
      status: "failed",
      error: `Unknown adapter '${adapterKey}'`,
    });
    return {
      ok: false,
      adapter: adapterKey,
      status: "failed",
      error: `Unknown WhatsApp adapter '${adapterKey}'`,
      retryable: false,
      requestId,
    };
  }
  if (!adapter.ready) {
    await patchDelivery(deliveryId, {
      status: "failed",
      error: `Adapter '${adapter.key}' not configured`,
    });
    return {
      ok: false,
      adapter: adapter.key,
      status: "failed",
      error: `WhatsApp adapter '${adapter.key}' is not configured`,
      retryable: false,
      requestId,
    };
  }

  const start = Date.now();
  const res = await adapter.send({
    tenantId: args.tenantId ?? "",
    to: args.to.phone,
    recipientName: args.to.name ?? null,
    message: args.message,
    context: { ...(args.context ?? {}), requestId },
  });
  const durationMs = Date.now() - start;

  await patchDelivery(deliveryId, {
    status: res.status,
    attempts: 1,
    duration_ms: durationMs,
    provider_message_id: res.provider_message_id ?? null,
    error: res.error ?? null,
    sent_at: res.ok ? new Date().toISOString() : null,
    delivered_at: res.status === "delivered" ? new Date().toISOString() : null,
  });

  return { ...res, requestId };
}

export interface SendTemplateArgs {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  /** Meta template name registered in the WABA Message Templates catalogue. */
  templateName: string;
  /** BCP-47 language code registered with the template, e.g. "en_US". */
  languageCode?: string;
  /** Positional body params — sent as {{1}}, {{2}}, ... to Meta. */
  bodyParams?: Array<string>;
  /** Fallback text used by non-Meta adapters and delivery logs. */
  fallbackText: string;
  context?: Record<string, unknown>;
}

async function sendTemplate(args: SendTemplateArgs): Promise<SendResult> {
  const requestId = newRequestId();
  const { key: adapterKey } = await resolveAdapterKey(true);

  // Non-Meta adapters fall back to plain text — the abstraction stays intact.
  if (adapterKey !== "meta") {
    return sendText({
      tenantId: args.tenantId,
      to: args.to,
      message: args.fallbackText,
      context: { ...(args.context ?? {}), template: args.templateName },
    });
  }

  const deliveryId = await loadDelivery(
    "sending",
    "meta",
    args.to,
    args.fallbackText,
    args.tenantId ?? null,
  );

  // Late import: keeps the Graph fetch out of client bundles.
  const { sendMetaMessage } = await import("./providers/whatsapp/adapters/meta");

  const components: MetaTemplateComponent[] | undefined =
    args.bodyParams && args.bodyParams.length
      ? [
          {
            type: "body",
            parameters: args.bodyParams.map((v) => ({ type: "text", text: v })),
          },
        ]
      : undefined;

  const start = Date.now();
  const res = await sendMetaMessage(args.to.phone, {
    kind: "template",
    name: args.templateName,
    languageCode: args.languageCode ?? "en_US",
    components,
  });
  const durationMs = Date.now() - start;

  await patchDelivery(deliveryId, {
    status: res.status,
    attempts: 1,
    duration_ms: durationMs,
    provider_message_id: res.provider_message_id ?? null,
    error: res.error ?? null,
    sent_at: res.ok ? new Date().toISOString() : null,
    delivered_at: res.status === "delivered" ? new Date().toISOString() : null,
  });

  return { ...res, requestId };
}

// ---------------------------------------------------------------------------
// High-level helpers used by attendance / fees / announcements modules.
// Each helper builds the message via the shared templates module so wording
// stays consistent across adapters.
// ---------------------------------------------------------------------------

export interface AttendanceContext {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  studentName: string;
  parentName?: string;
  academyName: string;
  batchName?: string;
  coachName?: string;
  at?: Date;
}

function attendanceVars(ctx: AttendanceContext) {
  const now = ctx.at ?? new Date();
  return {
    ParentName: ctx.parentName ?? "Parent",
    StudentName: ctx.studentName,
    AcademyName: ctx.academyName,
    BatchName: ctx.batchName ?? "Batch",
    CoachName: ctx.coachName ?? "Coach",
    Time: now.toLocaleTimeString(),
    Date: now.toLocaleDateString(),
  };
}

async function sendCheckIn(ctx: AttendanceContext): Promise<SendResult> {
  const vars = attendanceVars(ctx);
  const text = buildDefaultMessage("student.check_in", vars);
  return sendTemplate({
    tenantId: ctx.tenantId,
    to: ctx.to,
    templateName: "student_check_in",
    bodyParams: [vars.ParentName, vars.StudentName, vars.AcademyName, vars.Time],
    fallbackText: text,
    context: { kind: "attendance.check_in" },
  });
}

async function sendCheckOut(ctx: AttendanceContext): Promise<SendResult> {
  const vars = attendanceVars(ctx);
  const text = buildDefaultMessage("student.check_out", vars);
  return sendTemplate({
    tenantId: ctx.tenantId,
    to: ctx.to,
    templateName: "student_check_out",
    bodyParams: [vars.ParentName, vars.StudentName, vars.Time],
    fallbackText: text,
    context: { kind: "attendance.check_out" },
  });
}

export interface PaymentReminderContext {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  studentName: string;
  parentName?: string;
  academyName: string;
  amount: string; // formatted, e.g. "₹4,500"
  dueDate: string; // formatted, e.g. "15 Nov"
  invoiceRef?: string;
  overdue?: boolean;
}

async function sendPaymentReminder(ctx: PaymentReminderContext): Promise<SendResult> {
  const parentName = ctx.parentName ?? "Parent";
  const label = ctx.overdue ? "🔴 Fee Overdue" : "🟡 Fee Reminder";
  const body = `${label}

Hello ${parentName},

This is a reminder that the fee for ${ctx.studentName} at ${ctx.academyName} is ${ctx.overdue ? "overdue" : "due"}.

Amount: ${ctx.amount}
Due: ${ctx.dueDate}${ctx.invoiceRef ? `\nRef: ${ctx.invoiceRef}` : ""}

Please complete the payment at your earliest convenience.`;

  return sendTemplate({
    tenantId: ctx.tenantId,
    to: ctx.to,
    templateName: ctx.overdue ? "fee_overdue" : "fee_reminder",
    bodyParams: [parentName, ctx.studentName, ctx.amount, ctx.dueDate],
    fallbackText: body,
    context: { kind: ctx.overdue ? "fee.overdue" : "fee.reminder" },
  });
}

export interface PaymentConfirmationContext {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  studentName: string;
  parentName?: string;
  academyName: string;
  amount: string;
  paidOn: string;
  receiptRef?: string;
}

async function sendPaymentConfirmation(
  ctx: PaymentConfirmationContext,
): Promise<SendResult> {
  const parentName = ctx.parentName ?? "Parent";
  const body = `✅ Payment Received

Hello ${parentName},

We have received the fee payment for ${ctx.studentName} at ${ctx.academyName}.

Amount: ${ctx.amount}
Paid on: ${ctx.paidOn}${ctx.receiptRef ? `\nReceipt: ${ctx.receiptRef}` : ""}

Thank you.`;
  return sendTemplate({
    tenantId: ctx.tenantId,
    to: ctx.to,
    templateName: "payment_confirmation",
    bodyParams: [parentName, ctx.studentName, ctx.amount, ctx.paidOn],
    fallbackText: body,
    context: { kind: "fee.paid" },
  });
}

export interface AnnouncementContext {
  tenantId?: string | null;
  to: WhatsAppRecipient;
  academyName: string;
  headline: string;
  body: string;
  parentName?: string;
  /** Optional template registered with Meta (rare — plain text is fine). */
  templateName?: string;
  languageCode?: string;
}

async function sendAnnouncement(ctx: AnnouncementContext): Promise<SendResult> {
  const parentName = ctx.parentName ?? "Parent";
  const rendered = renderTemplate(
    `📣 {{Headline}}

Hello {{ParentName}},

{{Body}}

— {{AcademyName}}`,
    {
      Headline: ctx.headline,
      ParentName: parentName,
      Body: ctx.body,
      AcademyName: ctx.academyName,
    },
  );

  if (ctx.templateName) {
    return sendTemplate({
      tenantId: ctx.tenantId,
      to: ctx.to,
      templateName: ctx.templateName,
      languageCode: ctx.languageCode,
      bodyParams: [parentName, ctx.headline, ctx.body, ctx.academyName],
      fallbackText: rendered,
      context: { kind: "announcement" },
    });
  }
  return sendText({
    tenantId: ctx.tenantId,
    to: ctx.to,
    message: rendered,
    context: { kind: "announcement" },
  });
}

export const WhatsAppService = {
  sendText,
  sendTemplate,
  sendCheckIn,
  sendCheckOut,
  sendPaymentReminder,
  sendPaymentConfirmation,
  sendAnnouncement,
};

export type { WhatsAppSendResult };
