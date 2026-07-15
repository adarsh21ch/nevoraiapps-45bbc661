import type { WhatsAppAdapter } from "./types";
import { mockWhatsAppAdapter } from "./adapters/mock";
import { metaWhatsAppAdapter } from "./adapters/meta";

const adapters = new Map<string, WhatsAppAdapter>();

export function registerWhatsAppAdapter(a: WhatsAppAdapter): void {
  adapters.set(a.key, a);
}

export function getWhatsAppAdapter(key: string): WhatsAppAdapter | undefined {
  return adapters.get(key);
}

export function listWhatsAppAdapters(): WhatsAppAdapter[] {
  return Array.from(adapters.values());
}

// Register built-ins. `mock` is always ready; `meta` flips ready once the
// META_WA_* secrets are configured. Additional providers register through
// registerWhatsAppAdapter() without touching engine/gateway code.
registerWhatsAppAdapter(mockWhatsAppAdapter);
registerWhatsAppAdapter(metaWhatsAppAdapter);

export const DEFAULT_WHATSAPP_ADAPTER = "mock";
