// Provider-agnostic payment types. Safe to import from client or server.

export type PaymentProviderId = "razorpay" | "stripe" | "cashfree" | "phonepe" | "payu" | "paddle" | "manual";
export type PaymentScope = "platform" | "tenant";
export type PaymentCurrency = "INR" | "USD" | "EUR" | "GBP";

export type PaymentPurpose =
  | "subscription"
  | "registration_fee"
  | "monthly_fee"
  | "admission_fee"
  | "advance"
  | "outstanding"
  | "other";

export type PaymentStatus = "created" | "pending" | "success" | "failed" | "refunded" | "partially_refunded";

/** Non-secret projection safe to send to the browser. */
export type PaymentProviderConfigPublic = {
  id: string;
  scope: PaymentScope;
  tenant_id: string | null;
  provider: PaymentProviderId;
  enabled: boolean;
  test_mode: boolean;
  key_id: string | null;
  has_secret: boolean;
  has_webhook_secret: boolean;
  last_tested_at: string | null;
  last_test_status: "ok" | "failed" | null;
  last_test_error: string | null;
  last_webhook_at: string | null;
  updated_at: string;
};

export type CreateOrderInput = {
  scope: PaymentScope;
  tenantId?: string | null;
  amountPaise: number;
  currency?: PaymentCurrency;
  purpose: PaymentPurpose;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type CreateOrderResult = {
  transactionId: string;
  providerOrderId: string;
  provider: PaymentProviderId;
  keyId: string;
  amountPaise: number;
  currency: PaymentCurrency;
  testMode: boolean;
};

export type VerifyPaymentInput = {
  transactionId: string;
  providerPaymentId: string;
  providerSignature: string;
  providerOrderId: string;
};

export type WebhookVerifyInput = {
  provider: PaymentProviderId;
  scope: PaymentScope;
  tenantId?: string | null;
  rawBody: string;
  signature: string;
};

export type ProviderHealth = {
  status: "ok" | "failed" | "unconfigured";
  detail?: string;
  latencyMs?: number;
};

/** The shape every provider adapter must implement. Server-only. */
export interface PaymentProvider {
  id: PaymentProviderId;
  displayName: string;
  supportsWebhook: boolean;
  testConnection(creds: DecryptedCredentials): Promise<ProviderHealth>;
  createOrder(creds: DecryptedCredentials, input: CreateOrderInput): Promise<{ providerOrderId: string }>;
  verifyPayment(creds: DecryptedCredentials, input: VerifyPaymentInput): Promise<{ ok: boolean; error?: string }>;
  verifyWebhook(creds: DecryptedCredentials, input: WebhookVerifyInput): Promise<{ ok: boolean; eventId: string; eventType: string; payload: unknown }>;
}

export type DecryptedCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  testMode: boolean;
};

export const PROVIDER_CATALOG: Array<{ id: PaymentProviderId; name: string; available: boolean }> = [
  { id: "razorpay", name: "Razorpay", available: true },
  { id: "stripe", name: "Stripe", available: false },
  { id: "cashfree", name: "Cashfree", available: false },
  { id: "phonepe", name: "PhonePe", available: false },
  { id: "payu", name: "PayU", available: false },
  { id: "paddle", name: "Paddle", available: false },
  { id: "manual", name: "Manual Transfer", available: true },
];
