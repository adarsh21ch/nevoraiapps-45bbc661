/**
 * BotBiz WhatsApp Adapter — production integration.
 *
 * Server-only. Credentials are read from environment variables at call time:
 *   - BOTBIZ_API_KEY       (required — Bearer token)
 *   - BOTBIZ_BASE_URL      (optional — defaults to https://app.botbiz.io)
 *   - BOTBIZ_SEND_PATH     (optional — defaults to /api/v1/send-message)
 *   - BOTBIZ_HEALTH_PATH   (optional — defaults to /api/v1/health)
 *   - BOTBIZ_BOT_ID        (optional — passed as bot_id when set)
 *   - BOTBIZ_TIMEOUT_MS    (optional — default 15000)
 *
 * The adapter never surfaces secrets to callers or logs. Business modules
 * only see success/failure + provider_message_id. All routing rules (rate
 * limit backoff, retryable classification) live here so upstream code stays
 * provider-agnostic.
 */

import type { WhatsAppAdapter, WhatsAppSendInput, WhatsAppSendResult } from "../types";

const DEFAULT_BASE_URL = "https://app.botbiz.io";
const DEFAULT_SEND_PATH = "/api/v1/send-message";
const DEFAULT_HEALTH_PATH = "/api/v1/health";
const DEFAULT_TIMEOUT_MS = 15_000;

interface BotBizConfig {
  apiKey: string;
  baseUrl: string;
  sendPath: string;
  healthPath: string;
  botId: string | null;
  timeoutMs: number;
}

interface BotBizValidation {
  ok: boolean;
  reason?: string;
  config?: Omit<BotBizConfig, "apiKey"> & { hasApiKey: boolean };
}

function readConfig(): BotBizConfig | null {
  const apiKey = process.env.BOTBIZ_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.BOTBIZ_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const sendPath = process.env.BOTBIZ_SEND_PATH ?? DEFAULT_SEND_PATH;
  const healthPath = process.env.BOTBIZ_HEALTH_PATH ?? DEFAULT_HEALTH_PATH;
  const botId = process.env.BOTBIZ_BOT_ID ?? null;
  const t = Number(process.env.BOTBIZ_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
  return { apiKey, baseUrl, sendPath, healthPath, botId, timeoutMs };
}

/** Public — never returns the secret, only presence flag. */
export function validateBotBizConfiguration(): BotBizValidation {
  const cfg = readConfig();
  if (!cfg) return { ok: false, reason: "BOTBIZ_API_KEY is not configured" };
  return {
    ok: true,
    config: {
      baseUrl: cfg.baseUrl,
      sendPath: cfg.sendPath,
      healthPath: cfg.healthPath,
      botId: cfg.botId,
      timeoutMs: cfg.timeoutMs,
      hasApiKey: true,
    },
  };
}

/** Normalize a phone number to digits (BotBiz expects E.164 without '+'). */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits;
}

async function botbizFetch(
  cfg: BotBizConfig,
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Public — cheap connectivity probe used by Platform Admin UI. */
export async function botbizHealthCheck(): Promise<{
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  message: string;
}> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, status: null, latencyMs: null, message: "BOTBIZ_API_KEY not set" };
  const start = Date.now();
  try {
    const res = await botbizFetch(cfg, cfg.healthPath, { method: "GET" });
    const latencyMs = Date.now() - start;
    const ok = res.status >= 200 && res.status < 500; // 401/403 still means reachable
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      latencyMs,
      message: ok
        ? res.status < 300
          ? "Connected"
          : `Reachable but returned HTTP ${res.status}`
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
    (b.data as Record<string, unknown> | undefined)?.message_id,
    (b.data as Record<string, unknown> | undefined)?.id,
    (b.result as Record<string, unknown> | undefined)?.id,
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
      (typeof (b.error as Record<string, unknown> | undefined)?.message === "string" &&
        (b.error as Record<string, unknown>).message) ||
      "";
    if (typeof msg === "string" && msg) return msg;
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
      error: "BotBiz not configured: BOTBIZ_API_KEY missing",
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
  };
  if (cfg.botId) payload.bot_id = cfg.botId;
  if (input.recipientName) payload.name = input.recipientName;

  try {
    const res = await botbizFetch(cfg, cfg.sendPath, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Success (2xx)
    if (res.status >= 200 && res.status < 300) {
      return {
        ok: true,
        adapter: "botbiz",
        status: "delivered",
        provider_message_id: extractMessageId(res.body),
      };
    }

    // Rate limit — retryable with backoff
    if (res.status === 429) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(res.body, "Rate limited by BotBiz"),
        retryable: true,
      };
    }

    // Auth / permission — NOT retryable
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(res.body, `BotBiz auth failed (HTTP ${res.status})`),
        retryable: false,
      };
    }

    // Client errors — not retryable
    if (res.status >= 400 && res.status < 500) {
      return {
        ok: false,
        adapter: "botbiz",
        status: "failed",
        error: extractError(res.body, `BotBiz rejected request (HTTP ${res.status})`),
        retryable: false,
      };
    }

    // Server errors — retryable
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
  // `ready` is a static hint for the UI; runtime send performs its own check.
  // We report ready when the env var is present at module load *or* leave
  // it true so operators can flip the Active provider before restart.
  get ready() {
    return Boolean(process.env.BOTBIZ_API_KEY);
  },
  send: sendBotBiz,
};
