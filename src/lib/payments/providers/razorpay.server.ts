// Razorpay adapter. Server-only.
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  PaymentProvider,
  DecryptedCredentials,
  CreateOrderInput,
  VerifyPaymentInput,
  WebhookVerifyInput,
  ProviderHealth,
} from "../types";

const BASE = "https://api.razorpay.com/v1";

function auth(creds: DecryptedCredentials) {
  return "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
}

export const razorpayProvider: PaymentProvider = {
  id: "razorpay",
  displayName: "Razorpay",
  supportsWebhook: true,

  async testConnection(creds): Promise<ProviderHealth> {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/payments?count=1`, { headers: { Authorization: auth(creds) } });
      if (res.status === 401) return { status: "failed", detail: "Invalid API keys" };
      if (!res.ok) return { status: "failed", detail: `HTTP ${res.status}` };
      return { status: "ok", latencyMs: Date.now() - t0 };
    } catch (e) {
      return { status: "failed", detail: e instanceof Error ? e.message : "Network error" };
    }
  },

  async createOrder(creds, input: CreateOrderInput) {
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { Authorization: auth(creds), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        receipt: input.idempotencyKey.slice(0, 40),
        notes: {
          purpose: input.purpose,
          ref_type: input.refType ?? "",
          ref_id: input.refId ?? "",
          scope: input.scope,
          tenant_id: input.tenantId ?? "",
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Razorpay order create failed: ${err}`);
    }
    const json = (await res.json()) as { id: string };
    return { providerOrderId: json.id };
  },

  async verifyPayment(creds, input: VerifyPaymentInput) {
    // Razorpay checkout signature: hmac_sha256(order_id + "|" + payment_id, key_secret)
    const expected = createHmac("sha256", creds.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(input.providerSignature);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return { ok, error: ok ? undefined : "Signature mismatch" };
  },

  async verifyWebhook(creds, input: WebhookVerifyInput) {
    if (!creds.webhookSecret) throw new Error("Webhook secret not configured");
    const expected = createHmac("sha256", creds.webhookSecret).update(input.rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(input.signature);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) return { ok: false, eventId: "", eventType: "", payload: null };
    const payload = JSON.parse(input.rawBody) as { event: string; id?: string; payload?: unknown };
    return {
      ok: true,
      eventId: payload.id ?? `${payload.event}:${Date.now()}`,
      eventType: payload.event,
      payload: payload.payload ?? payload,
    };
  },
};
