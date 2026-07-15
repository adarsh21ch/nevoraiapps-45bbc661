import type { WhatsAppAdapter } from "../types";

/**
 * BotBiz adapter — SCAFFOLDED, NOT YET WIRED.
 * All HTTP calls live inside `send()`. See TODO markers.
 */
export const botbizWhatsAppAdapter: WhatsAppAdapter = {
  key: "botbiz",
  label: "BotBiz",
  ready: false,
  async send(_input) {
    // TODO(botbiz): read BOTBIZ_API_KEY + BOTBIZ_ACCOUNT_ID from process.env
    // TODO(botbiz): POST https://api.botbiz.io/v1/messages with { to, text }
    // TODO(botbiz): map response → provider_message_id, status
    return {
      ok: false,
      adapter: "botbiz",
      status: "failed",
      error: "BotBiz adapter is scaffolded but not wired yet",
      retryable: false,
    };
  },
};
