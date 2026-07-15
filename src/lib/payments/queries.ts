// Client query helpers (React Query keys + wrappers).
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPaymentConfigs,
  savePaymentConfig,
  testPaymentConfig,
  rotatePaymentCredentials,
  saveOfflinePaymentSettings,
} from "./config.functions";
import type { PaymentScope } from "./types";

export const paymentsKeys = {
  configs: (scope: PaymentScope, tenantId?: string | null) => ["payment-configs", scope, tenantId ?? null] as const,
};

export function usePaymentConfigs(scope: PaymentScope, tenantId?: string | null) {
  const fn = useServerFn(listPaymentConfigs);
  return useQuery({
    queryKey: paymentsKeys.configs(scope, tenantId),
    queryFn: () => fn({ data: { scope, tenantId } }),
  });
}

export function useSavePaymentConfig(scope: PaymentScope, tenantId?: string | null) {
  const fn = useServerFn(savePaymentConfig);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof fn>[0]["data"]) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentsKeys.configs(scope, tenantId) }),
  });
}

export function useTestPaymentConfig(scope: PaymentScope, tenantId?: string | null) {
  const fn = useServerFn(testPaymentConfig);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentsKeys.configs(scope, tenantId) }),
  });
}

export function useRotatePaymentCredentials(scope: PaymentScope, tenantId?: string | null) {
  const fn = useServerFn(rotatePaymentCredentials);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof fn>[0]["data"]) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentsKeys.configs(scope, tenantId) }),
  });
}

export function useSaveOfflinePaymentSettings() {
  const fn = useServerFn(saveOfflinePaymentSettings);
  return useMutation({ mutationFn: (input: Parameters<typeof fn>[0]["data"]) => fn({ data: input }) });
}

/** Absolute webhook URL to display in settings for copy-paste. */
export function webhookUrlFor(scope: PaymentScope, provider: string, tenantId?: string | null) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const q = scope === "tenant" && tenantId ? `?tenant_id=${tenantId}` : "";
  return `${origin}/api/public/payments/${provider}/webhook${q}`;
}
