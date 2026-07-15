/**
 * WhatsApp provider — adapter contract.
 *
 * The provider itself is a single ActionProvider registered in the automation
 * engine. It delegates the actual HTTP send to a swappable adapter so we can
 * ship a mock today and plug in Meta Cloud API / BotBiz / 360dialog / Twilio
 * later without touching the engine or business modules.
 */

export interface WhatsAppSendInput {
  tenantId: string;
  to: string; // E.164 or local — adapter normalizes
  recipientName?: string | null;
  message: string;
  /** Free-form context echoed back into logs (student_id, event_id, ...). */
  context?: Record<string, unknown>;
}

export interface WhatsAppSendResult {
  ok: boolean;
  adapter: string;
  provider_message_id?: string | null;
  status: "queued" | "sending" | "delivered" | "failed";
  error?: string;
  retryable?: boolean;
  raw?: Record<string, unknown>;
}

export interface WhatsAppAdapter {
  /** Stable adapter key (mock / meta / botbiz / 360dialog / twilio). */
  key: string;
  /** Human label surfaced in the settings UI. */
  label: string;
  /** True when the adapter has credentials wired and can dispatch real messages. */
  ready: boolean;
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
}
