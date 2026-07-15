/**
 * Web Push adapter — RFC 8291 (aes128gcm) via the `web-push` library.
 *
 * Recipient tokens are the JSON-serialised `PushSubscription` returned by
 * `pushManager.subscribe()`. This adapter is registered alongside the Expo
 * adapter and selected per-recipient by platform (see providers/push/index.ts).
 *
 * Server-only.
 */

import type {
  PushAdapter,
  PushMessage,
  PushRecipient,
  PushSendItemResult,
  PushSendResult,
} from "../types";

interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function parseSubscription(token: string): StoredSubscription | null {
  try {
    const raw = JSON.parse(token) as Partial<StoredSubscription>;
    if (!raw?.endpoint || !raw?.keys?.p256dh || !raw?.keys?.auth) return null;
    return { endpoint: raw.endpoint, keys: raw.keys };
  } catch {
    return null;
  }
}

async function sendOne(
  recipient: PushRecipient,
  payload: string,
): Promise<PushSendItemResult> {
  const sub = parseSubscription(recipient.token);
  if (!sub) {
    return {
      token: recipient.token,
      ok: false,
      status: "failed",
      error: "Invalid subscription JSON",
      disableToken: true,
      retryable: false,
    };
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@example.com";
  if (!publicKey || !privateKey) {
    return {
      token: recipient.token,
      ok: false,
      status: "failed",
      error: "VAPID keys not configured",
      retryable: false,
    };
  }

  // Dynamic import — `web-push` uses Node crypto; keep it out of the
  // client bundle graph and only load when actually dispatching.
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    const res = await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24 });
    return {
      token: recipient.token,
      ok: true,
      status: "delivered",
      providerMessageId: res.headers?.["location"] ?? null,
    };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err.statusCode ?? 0;
    // 404 Not Found or 410 Gone → subscription is dead; disable the token.
    const dead = status === 404 || status === 410;
    // 429 / 5xx → transient, retryable.
    const retryable = status === 429 || (status >= 500 && status < 600);
    return {
      token: recipient.token,
      ok: false,
      status: "failed",
      error: err.body ?? err.message ?? `Web push failed (${status})`,
      disableToken: dead,
      retryable,
    };
  }
}

export const webPushAdapter: PushAdapter = {
  key: "web-push",
  label: "Web Push (VAPID)",
  ready: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),

  async send(recipients: PushRecipient[], message: PushMessage): Promise<PushSendResult> {
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      subtitle: message.subtitle ?? null,
      deep_link: message.deepLink ?? null,
      category: message.category ?? null,
      tag: message.collapseId ?? message.threadId ?? null,
      badge: message.badge ?? null,
      data: message.data ?? {},
    });

    const items = await Promise.all(recipients.map((r) => sendOne(r, payload)));
    return {
      ok: items.every((i) => i.ok),
      adapter: "web-push",
      items,
    };
  },
};
