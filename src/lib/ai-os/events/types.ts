/**
 * AI event contract.
 *
 * Emitted by the orchestrator during a run so the platform's existing
 * Automation Engine can subscribe and react (audit logs, notifications,
 * downstream workflows). We do NOT build a parallel event system — the
 * bus here is a thin publisher that forwards to whatever handlers
 * `registerAIEventHandler` receives (in phase 11.2 the Automation Engine
 * registers itself here).
 */

export type AIEventType =
  | "ai.request_started"
  | "ai.request_completed"
  | "ai.request_failed"
  | "ai.tool_called"
  | "ai.tool_failed"
  | "ai.confirmation_requested"
  | "ai.confirmation_completed";

export type AIEvent = {
  type: AIEventType;
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  at: string;
  payload?: Record<string, unknown>;
};

export type AIEventHandler = (event: AIEvent) => void | Promise<void>;
