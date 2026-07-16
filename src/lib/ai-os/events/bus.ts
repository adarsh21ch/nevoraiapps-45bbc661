/**
 * AI event bus — thin publisher.
 *
 * The Automation Engine (existing system) registers a handler here to
 * receive AI lifecycle events. No new event system is created — this
 * is just the fan-out point.
 */

import type { AIEvent, AIEventHandler, AIEventType } from "./types";

const handlers = new Set<AIEventHandler>();

export function registerAIEventHandler(handler: AIEventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export async function emitAIEvent(event: AIEvent): Promise<void> {
  await Promise.allSettled(Array.from(handlers).map((h) => h(event)));
}

export function makeEvent(
  type: AIEventType,
  base: Pick<AIEvent, "tenantId" | "userId" | "agentId" | "conversationId">,
  payload?: Record<string, unknown>,
): AIEvent {
  return { type, at: new Date().toISOString(), payload, ...base };
}
