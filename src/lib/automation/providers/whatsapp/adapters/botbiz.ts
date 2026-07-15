/**
 * BotBiz WhatsApp Adapter — production integration.
 *
 * BotBiz does not issue Bearer tokens. Instead, an operator publishes a bot
 * flow in the BotBiz dashboard and exposes it as an **incoming webhook /
 * trigger URL**. This adapter POSTs the outbound message payload to that
 * URL. Optionally, a shared secret can be sent as a header or in the body
 * so the BotBiz flow can verify the caller.
 *
 * Server-only. All configuration comes from environment variables read at
 * call time (never bundled to the client):
 *
 *   - BOTBIZ_WEBHOOK_URL     (required — the trigger URL from BotBiz)
 *   - BOTBIZ_WEBHOOK_SECRET  (optional — signed header + body echo)
 *   - BOTBIZ_BOT_ID          (optional — echoed into the payload)
 *   - BOTBIZ_TIMEOUT_MS      (optional — default 15000)
 *
 * The Communication Gateway interface (WhatsAppAdapter) is unchanged.
 * Business modules and the gateway continue to call `send()` / read
 * `ready`; the underlying transport is an implementation detail.
 */

import type { WhatsAppAdapter, WhatsAppSendInput, WhatsAppSendResult } from "../types";

const DEFAULT_TIMEOUT_MS = 15_000;

interface BotBizConfig {
  webhookUrl: string;
  webhookSecret: string | null;
  botId: string | null;
  timeoutMs: number;
}

interface BotBizValidation {
  ok: boolean;
  reason?: string;
  config?: {
    webhookHost: string;
    webhookPath: string;
    hasSecret: boolean;
    botId: string | null;
    timeoutMs: number;
  };
}

function readConfig(): BotBizConfig | null {
  const webhookUrl = process.env.BOTBIZ_WEBHOOK_URL;
  if (!webhookUrl) return null;
  const webhookSecret = process.env.BOTBIZ_WEBHOOK_SECRET ?? null;
  const botId = process.env.BOTBIZ_BOT_ID ?? null;
  const t = Number(process.env.BOTBIZ_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
  return { webhookUrl, webhookSecret, botId, timeoutMs };
}

/** Public — never returns the URL or secret in full, only sanitized shape. */
export function validateBotBizConfiguration(): BotBizValidation {
  const cfg = readConfig();
  if (!cfg) return { ok: false, reason: "BOTBIZ_WEBHOOK_URL is not configured" };
  let host = "";
  let path = "";
  try {
    const u = new URL(cfg.webhookUrl);
    host = u.host;
    path = u.pathname;
  } catch {
    return { ok: false, reason: "BOTBIZ_WEBHOOK_URL is not a valid URL" };
  }
  return {
    ok: true,
    config: {
      webhookHost: host,
      webhookPath: path,
      hasSecret: Boolean(cfg.webhookSecret),
      botId: cfg.botId,
      timeoutMs: cfg.timeoutMs,
    },
  };
}

/** Normalize a phone number to digits (BotBiz expects E.164 without '+'). */
function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

async function botbizPost(
  cfg: BotBizConfig,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (cfg.webhookSecret) {
      // BotBiz flows verify shared secrets via either a header or a body
      // field — send both so the operator can match against whichever the
      // flow inspects.
      headers["X-BotBiz-Secret"] = cfg.webhookSecret;
    }
    const body = cfg.webhookSecret
      ? { ...payload, secret: cfg.webhookSecret }
      : payload;
    const res = await fetch(cfg.webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cheap connectivity probe used by Platform Admin UI. BotBiz webhooks are
 * POST-only, so we send a `{"ping": true}` payload — a well-formed BotBiz
 * flow ignores this input (no phone/message) and simply returns 200.
 */
export async function botbizHealthCheck(): Promise<{
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  message: string;
}> {
  const cfg = readConfig();
  if (!cfg)
    return {
      ok: false,
      status: null,
      latencyMs: null,
      message: "BOTBIZ_WEBHOOK_URL not set",
    };
  const start = Date.now();
  try {
    const res = await botbizPost(cfg, { ping: true, source: "healthcheck" });
    const latencyMs = Date.now() - start;
    const ok = res.status >= 200 && res.status < 500;
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      latencyMs,
      message:
        res.status < 300
          ? "Connected"
          : ok
            ? `Webhook reachable (HTTP ${res.status})`
            : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - start,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
}

function extractMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const candidates = [
    b.message_id,
    b.id,
    b.request_id,
    (b.data as Record<string, unknown> | undefined)?.message_id,
    (b.data as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) if (typeof c === "string" && c.length > 0) return c;
  return null;
}

function extractError(body: unknown, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === "string") return body.slice(0, 500) || fallback;
  if (typeof body === "object") {
    const b = body as Record<string, unknown>;
    const msg =
      (typeof b.message === "string" && b.message) ||
      (typeof b.error === "string" && b.error) ||
      "";
    if (msg) return msg;
  }
  return fallback;
}

async function sendBotBiz(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  const cfg = readConfig();
  if (!cfg) {
    return {
      ok: false,
      adapter: "botbiz",
      status: "failed",
      error: "BotBiz not configured: BOTBIZ_WEBHOOK_URL missing",
      retryable: false,
    };
  }

  const phone = normalizePhone(input.to);
  if (!phone) {
    return {
      ok: false,
      adapter: "botbiz",
      status: "failed",
      error: "Recipient phone number is empty after normalization",
      retryable: false,
    };
  }

  const payload: Record<string, unknown> = {
    phone,
    message: input.message,
    type: "text",
    context: input.context ?? {},
  };
  if (cfg.botId) payload.bot_id = cfg.botId;
  if (input.recipientName) payload.name = input.recipientName;

  try {
    const res = await botbizPost(cfg, payload);

    if (res.status >= 200 && res.status < 300) {
      return {
        ok: true,
        adapter: "botbiz",
        status: "delivered",
        provider_message_id: extractMessageId(res.body),
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(res.body, "Rate limited by BotBiz"),
        retryable: true,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(
          res.body,
          `BotBiz webhook rejected caller (HTTP ${res.status}) — check BOTBIZ_WEBHOOK_SECRET`,
        ),
        retryable: false,
      };
    }
    if (res.status === 404) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(
          res.body,
          "BotBiz webhook URL not found — verify BOTBIZ_WEBHOOK_URL",
        ),
        retryable: false,
      };
    }
    if (res.status >= 400 && res.status < 500) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(res.body, `BotBiz rejected payload (HTTP ${res.status})`),
        retryable: false,
      };
    }
    return {
      ok: false,
      adapter: "botbiz",
      status: "failed",
      error: extractError(res.body, `BotBiz upstream error (HTTP ${res.status})`),
      retryable: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    const isTimeout = msg.toLowerCase().includes("abort");
    return {
      ok: false,
      adapter: "botbiz",
      status: "failed",
      error: isTimeout ? "BotBiz request timed out" : msg,
      retryable: true,
    };
  }
}

export const botbizWhatsAppAdapter: WhatsAppAdapter = {
  key: "botbiz",
  label: "BotBiz",
  get ready() {
    return Boolean(process.env.BOTBIZ_WEBHOOK_URL);
  },
  send: sendBotBiz,
};
