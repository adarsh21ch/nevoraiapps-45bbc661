/**
 * Mock push adapter — logs to console and reports success for every token.
 * Used in local/dev when the Expo access token is not configured, or when a
 * tenant chooses to disable real push delivery.
 */

import type {
  PushAdapter,
  PushMessage,
  PushRecipient,
  PushSendResult,
} from "../types";

export const mockPushAdapter: PushAdapter = {
  key: "mock",
  label: "Mock Push (dev only)",
  ready: true,
  async send(recipients: PushRecipient[], message: PushMessage): Promise<PushSendResult> {
    // eslint-disable-next-line no-console
    console.info(
      "[push:mock]",
      message.title,
      "→",
      recipients.map((r) => `${r.platform}:${r.token.slice(0, 12)}…`).join(", "),
    );
    return {
      ok: true,
      adapter: "mock",
      items: recipients.map((r) => ({
        token: r.token,
        ok: true,
        status: "delivered",
        providerMessageId: `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      })),
    };
  },
};
