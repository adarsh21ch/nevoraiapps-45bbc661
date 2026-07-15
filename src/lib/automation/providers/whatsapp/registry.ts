import type { WhatsAppAdapter } from "./types";
import { mockWhatsAppAdapter } from "./adapters/mock";
import { metaWhatsAppAdapter } from "./adapters/meta";
import { botbizWhatsAppAdapter } from "./adapters/botbiz";

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

// Register built-ins. Only `mock` is `ready:true` today; others are scaffolds.
registerWhatsAppAdapter(mockWhatsAppAdapter);
registerWhatsAppAdapter(metaWhatsAppAdapter);
registerWhatsAppAdapter(botbizWhatsAppAdapter);

export const DEFAULT_WHATSAPP_ADAPTER = "mock";
