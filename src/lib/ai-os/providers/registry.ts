/**
 * Provider registry — the single lookup point for `AIProvider` instances.
 *
 * Concrete providers live in `providers/<id>.server.ts` and register
 * themselves at server-module load time. Client code never imports
 * `.server.ts` files directly; use the higher-level orchestrator instead
 * (added in phase 11.1).
 */

import type { AIProvider } from "./types";

const registry = new Map<string, AIProvider>();

export function registerProvider(provider: AIProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): AIProvider {
  const p = registry.get(id);
  if (!p) throw new Error(`AI provider "${id}" is not registered`);
  return p;
}

export function hasProvider(id: string): boolean {
  return registry.has(id);
}

export function listProviders(): string[] {
  return Array.from(registry.keys());
}
