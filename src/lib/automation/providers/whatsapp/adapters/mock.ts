import type { WhatsAppAdapter } from "../types";

/**
 * Mock WhatsApp adapter — simulates a real delivery flow so the rest of the
 * engine (execution log, delivery log, realtime UI) can be validated without
 * any external credentials.
 *
 * Behaviour:
 *   • Always "queued" first, then "sending", then "delivered".
 *   • Simulates a random provider_message_id.
 *   • Never fails unless the target number is obviously empty.
 */
export const mockWhatsAppAdapter: WhatsAppAdapter = {
  key: "mock",
  label: "Mock (simulated delivery)",
  ready: true,
  async send(input) {
    if (!input.to || input.to.trim().length < 6) {
      return {
        ok: false,
        adapter: "mock",
        status: "failed",
        error: "Missing or invalid recipient number",
        retryable: false,
      };
    }
    // Simulate two short awaits so realtime subscribers can see the sending → delivered transition.
    await new Promise((r) => setTimeout(r, 150));
    const providerMessageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      ok: true,
      adapter: "mock",
      provider_message_id: providerMessageId,
      status: "delivered",
      raw: {
        note: "mock delivery — no external side effect",
        preview: input.message.slice(0, 120),
        to: input.to,
      },
    };
  },
};
