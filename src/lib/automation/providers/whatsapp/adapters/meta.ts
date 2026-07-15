import type { WhatsAppAdapter } from "../types";

/**
 * Meta Cloud API adapter — SCAFFOLDED, NOT YET WIRED.
 *
 * All HTTP calls live in this file so switching to real Meta Cloud only
 * requires filling in the TODO markers. No business module or engine code
 * needs to change.
 *
 * To activate later:
 *   1. Set WHATSAPP_META_PHONE_NUMBER_ID + WHATSAPP_META_ACCESS_TOKEN secrets.
 *   2. Replace the throw in `send()` with the fetch call described below.
 *   3. Flip `ready` to true and select "meta" from Automation Settings.
 */
export const metaWhatsAppAdapter: WhatsAppAdapter = {
  key: "meta",
  label: "Meta Cloud API",
  ready: false,
  async send(_input) {
    // TODO(meta): read credentials
    //   const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    //   const accessToken   = process.env.WHATSAPP_META_ACCESS_TOKEN;
    //   if (!phoneNumberId || !accessToken) return { ok: false, adapter: "meta", status: "failed", error: "Meta credentials missing", retryable: false };
    //
    // TODO(meta): POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages
    //   body: { messaging_product: "whatsapp", to: _input.to, type: "text", text: { body: _input.message } }
    //   headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    //
    // TODO(meta): parse res.messages[0].id → return { ok:true, provider_message_id, status:"sending" }
    //   Meta returns "sending"; a webhook then flips the delivery row to "delivered".
    return {
      ok: false,
      adapter: "meta",
      status: "failed",
      error: "Meta Cloud API adapter is scaffolded but not wired yet",
      retryable: false,
    };
  },
};
