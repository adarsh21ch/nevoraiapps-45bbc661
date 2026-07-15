/**
 * Push provider — adapter contract.
 *
 * The push provider is a single ActionProvider registered in the automation
 * engine. It delegates the physical send to a swappable adapter (Expo today,
 * FCM / APNS-direct / OneSignal tomorrow) so the engine and business modules
 * never depend on a specific push service.
 *
 * Server-only. Never import from client bundles.
 */

export type PushPriority = "default" | "normal" | "high";

/** Rich payload for a single push notification. Kept provider-agnostic. */
export interface PushMessage {
  title: string;
  body: string;
  /** Optional short subtitle (iOS) / big-text subline (Android). */
  subtitle?: string | null;
  /** Deep-link URL/path opened when the notification is tapped. */
  deepLink?: string | null;
  /** Free-form data payload delivered to the client. */
  data?: Record<string, unknown>;
  /** Category — attendance | fees | matches | tournament | announcement | summary. */
  category?: string | null;
  priority?: PushPriority;
  /** iOS badge count; when omitted, the client computes its own unread count. */
  badge?: number | null;
  /** Notification sound file / "default". */
  sound?: string | null;
  /** iOS threadId / Android tag — used for OS-side grouping. */
  threadId?: string | null;
  /** Collapse ID — later notifications with the same key replace earlier ones. */
  collapseId?: string | null;
  /** Time-to-live in seconds. */
  ttl?: number;
}

/** Recipient device the adapter should target. */
export interface PushRecipient {
  token: string;
  platform: "ios" | "android" | "web";
  deviceId: string;
  userId: string;
}

export interface PushSendItemResult {
  token: string;
  ok: boolean;
  status: "queued" | "sending" | "delivered" | "failed";
  providerMessageId?: string | null;
  error?: string | null;
  /** Signal to auto-disable the token permanently (invalid / unregistered). */
  disableToken?: boolean;
  retryable?: boolean;
}

export interface PushSendResult {
  ok: boolean;
  adapter: string;
  items: PushSendItemResult[];
  /** Optional raw response chunk for debugging (kept small). */
  raw?: Record<string, unknown>;
}

export interface PushAdapter {
  key: string;
  label: string;
  /** True when credentials are wired / no credentials required (Expo public tier). */
  ready: boolean;
  send(recipients: PushRecipient[], message: PushMessage): Promise<PushSendResult>;
}
