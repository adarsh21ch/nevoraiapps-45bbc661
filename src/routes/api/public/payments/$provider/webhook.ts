// Generic payment webhook endpoint. Reuses the PaymentProviderRegistry so each
// provider verifies its own signature. Public — verify signature before writes.
import { createFileRoute } from "@tanstack/react-router";
import type { PaymentProviderId, PaymentScope } from "@/lib/payments/types";

export const Route = createFileRoute("/api/public/payments/$provider/webhook")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerId = params.provider as PaymentProviderId;
        const url = new URL(request.url);
        const tenantIdParam = url.searchParams.get("tenant_id");
        const scope: PaymentScope = tenantIdParam ? "tenant" : "platform";

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-razorpay-signature") ??
          request.headers.get("stripe-signature") ??
          request.headers.get("x-webhook-signature") ??
          "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find the config
        let q = supabaseAdmin
          .from("payment_provider_configs")
          .select("*")
          .eq("provider", providerId)
          .eq("scope", scope);
        q = tenantIdParam ? q.eq("tenant_id", tenantIdParam) : q.is("tenant_id", null);
        const { data: config, error: cerr } = await q.maybeSingle();
        if (cerr || !config || !config.webhook_secret_ciphertext) {
          return new Response("No config", { status: 400 });
        }

        const { decryptSecret } = await import("@/lib/payments/crypto.server");
        const { getProvider } = await import("@/lib/payments/registry.server");
        const provider = getProvider(providerId);
        const creds = {
          keyId: config.key_id ?? "",
          keySecret: config.key_secret_ciphertext ? decryptSecret(config.key_secret_ciphertext) : "",
          webhookSecret: decryptSecret(config.webhook_secret_ciphertext),
          testMode: !!config.test_mode,
        };

        let verified;
        try {
          verified = await provider.verifyWebhook(creds, {
            provider: providerId,
            scope,
            tenantId: tenantIdParam,
            rawBody,
            signature,
          });
        } catch (e) {
          return new Response("Verification error", { status: 400 });
        }
        if (!verified.ok) return new Response("Invalid signature", { status: 401 });

        // Replay protection via unique (provider, event_id)
        const { error: insErr } = await supabaseAdmin.from("payment_webhooks").insert({
          scope,
          tenant_id: tenantIdParam,
          provider: providerId,
          event_id: verified.eventId,
          event_type: verified.eventType,
          signature,
          payload: verified.payload as any,
        });
        if (insErr && !String(insErr.message).includes("duplicate")) {
          return new Response("Store failed", { status: 500 });
        }
        if (insErr) {
          // duplicate → already processed
          return new Response("Duplicate ignored", { status: 200 });
        }

        await supabaseAdmin
          .from("payment_provider_configs")
          .update({ last_webhook_at: new Date().toISOString() })
          .eq("id", config.id);

        return new Response("ok");
      },
    },
  },
});
