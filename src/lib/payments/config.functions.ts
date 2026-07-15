// Client-safe server functions for managing payment provider configs.
// Handlers dynamically import server-only modules (crypto, registry, admin client).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentProviderConfigPublic, PaymentProviderId, PaymentScope } from "./types";

type ScopeInput = { scope: PaymentScope; tenantId?: string | null };

function toPublic(row: Record<string, unknown>): PaymentProviderConfigPublic {
  return {
    id: row.id as string,
    scope: row.scope as PaymentScope,
    tenant_id: (row.tenant_id as string | null) ?? null,
    provider: row.provider as PaymentProviderId,
    enabled: !!row.enabled,
    test_mode: !!row.test_mode,
    key_id: (row.key_id as string | null) ?? null,
    has_secret: !!row.key_secret_ciphertext,
    has_webhook_secret: !!row.webhook_secret_ciphertext,
    last_tested_at: (row.last_tested_at as string | null) ?? null,
    last_test_status: (row.last_test_status as "ok" | "failed" | null) ?? null,
    last_test_error: (row.last_test_error as string | null) ?? null,
    last_webhook_at: (row.last_webhook_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

async function authorize(context: { supabase: any; userId: string }, scope: PaymentScope, tenantId?: string | null) {
  if (scope === "platform") {
    const { data, error } = await context.supabase.rpc("is_platform_admin", { _uid: context.userId });
    if (error || !data) throw new Error("Forbidden");
    return;
  }
  if (!tenantId) throw new Error("tenantId required");
  const { data, error } = await context.supabase.rpc("is_tenant_owner", { _tenant: tenantId, _uid: context.userId });
  if (error || !data) throw new Error("Forbidden");
}

/** List configs for a given scope (non-secret projection). */
export const listPaymentConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: ScopeInput) => v)
  .handler(async ({ data, context }) => {
    await authorize(context, data.scope, data.tenantId);
    let q = context.supabase.from("payment_provider_configs").select("*").eq("scope", data.scope);
    if (data.scope === "tenant") q = q.eq("tenant_id", data.tenantId!);
    else q = q.is("tenant_id", null);
    const { data: rows, error } = await q.order("provider");
    if (error) throw error;
    return (rows ?? []).map(toPublic);
  });

type UpsertInput = ScopeInput & {
  provider: PaymentProviderId;
  enabled: boolean;
  test_mode: boolean;
  key_id?: string | null;
  key_secret?: string | null; // plaintext; will be encrypted server-side
  webhook_secret?: string | null;
};

/** Create or update a config. Secrets are encrypted before writing. */
export const savePaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: UpsertInput) => v)
  .handler(async ({ data, context }) => {
    await authorize(context, data.scope, data.tenantId);
    const { encryptSecret } = await import("./crypto.server");
    const patch = {
      scope: data.scope,
      tenant_id: data.scope === "tenant" ? data.tenantId! : null,
      provider: data.provider,
      enabled: data.enabled,
      test_mode: data.test_mode,
      key_id: data.key_id ?? null,
      ...(data.key_secret ? { key_secret_ciphertext: encryptSecret(data.key_secret) } : {}),
      ...(data.webhook_secret ? { webhook_secret_ciphertext: encryptSecret(data.webhook_secret) } : {}),
    };

    const filter = context.supabase
      .from("payment_provider_configs")
      .select("id")
      .eq("scope", data.scope)
      .eq("provider", data.provider);
    const existing = data.scope === "tenant" ? filter.eq("tenant_id", data.tenantId!) : filter.is("tenant_id", null);
    const { data: found } = await existing.maybeSingle();

    if (found?.id) {
      const { error } = await context.supabase
        .from("payment_provider_configs")
        .update(patch)
        .eq("id", found.id);
      if (error) throw error;
      return { ok: true, id: found.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("payment_provider_configs")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };

  });

/** Run testConnection against the stored (decrypted) credentials. */
export const testPaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string }) => v)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_provider_configs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Config not found");
    await authorize(context, row.scope as PaymentScope, row.tenant_id);
    if (!row.key_id || !row.key_secret_ciphertext) {
      return { status: "failed" as const, detail: "Missing key id or secret" };
    }
    const { decryptSecret } = await import("./crypto.server");
    const { getProvider } = await import("./registry.server");
    const provider = getProvider(row.provider as PaymentProviderId);

    const health = await provider.testConnection({
      keyId: row.key_id,
      keySecret: decryptSecret(row.key_secret_ciphertext),
      webhookSecret: row.webhook_secret_ciphertext ? decryptSecret(row.webhook_secret_ciphertext) : null,
      testMode: row.test_mode,
    });
    await context.supabase
      .from("payment_provider_configs")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: health.status === "ok" ? "ok" : "failed",
        last_test_error: health.status === "ok" ? null : (health.detail ?? "Unknown error"),
      })
      .eq("id", row.id);
    return health;
  });

/** Rotate credentials (writes new encrypted values; clears old test status). */
export const rotatePaymentCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { id: string; key_id: string; key_secret: string; webhook_secret?: string | null }) => v)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_provider_configs")
      .select("id, scope, tenant_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Config not found");
    await authorize(context, row.scope as PaymentScope, row.tenant_id);
    const { encryptSecret } = await import("./crypto.server");
    const patch = {
      key_id: data.key_id,
      key_secret_ciphertext: encryptSecret(data.key_secret),
      last_tested_at: null,
      last_test_status: null,
      last_test_error: null,
      ...(data.webhook_secret ? { webhook_secret_ciphertext: encryptSecret(data.webhook_secret) } : {}),
    };
    const { error: uerr } = await context.supabase.from("payment_provider_configs").update(patch).eq("id", row.id);

    if (uerr) throw uerr;
    return { ok: true };
  });

/** Save/read offline (QR/UPI/bank) settings on the tenant. */
export const saveOfflinePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (v: {
      tenantId: string;
      online_payments_enabled: boolean;
      upi_id?: string | null;
      upi_qr_url?: string | null;
      bank_account_name?: string | null;
      bank_account_number?: string | null;
      bank_ifsc?: string | null;
      payment_instructions?: string | null;
    }) => v,
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_tenant_owner", {
      _tenant: data.tenantId,
      _uid: context.userId,
    });
    if (!ok) throw new Error("Forbidden");
    const { tenantId, ...patch } = data;
    const { error } = await context.supabase.from("tenants").update(patch).eq("id", tenantId);
    if (error) throw error;
    return { ok: true };
  });
