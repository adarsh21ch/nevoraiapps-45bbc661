// PaymentProviderRegistry + Factory. Server-only.
import type { PaymentProvider, PaymentProviderId } from "./types";
import { razorpayProvider } from "./providers/razorpay.server";

const REGISTRY: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  razorpay: razorpayProvider,
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
  const p = REGISTRY[id];
  if (!p) throw new Error(`Payment provider not implemented: ${id}`);
  return p;
}

export function listProviders(): PaymentProvider[] {
  return Object.values(REGISTRY).filter(Boolean) as PaymentProvider[];
}
