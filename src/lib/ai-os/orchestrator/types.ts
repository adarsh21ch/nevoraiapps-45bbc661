/**
 * Orchestrator public contract.
 *
 * The orchestrator is the ONLY thing that talks to providers. Everything
 * else (features, chat UIs, background jobs) calls `runAgent(...)`.
 */

import type { AIContext } from "../context/types";
import type { AgentId } from "../agents/types";
import type { AIMessage, AIUsage } from "../providers/types";
import type { QueuedAction } from "../queue/types";

export type RunAgentInput = {
  agentId: AgentId;
  ctx: AIContext;
  conversationId: string;
  /** Latest user message. */
  userMessage: string;
  /** Optional prior messages if the caller doesn't rely on the memory store. */
  history?: AIMessage[];
  /** Approved queued action ids the orchestrator may now execute. */
  approvedActionIds?: string[];
  /** Abort signal. */
  signal?: AbortSignal;
};

export type RunAgentResult = {
  runId: string;
  conversationId: string;
  /** Terminal assistant text, if any. */
  text?: string;
  /** Structured tool output(s) executed inline (read-only tools only). */
  toolResults?: { name: string; ok: boolean; data?: unknown; message?: string }[];
  /** Write actions queued and awaiting confirmation. */
  pendingActions?: QueuedAction[];
  usage: AIUsage;
  completionStatus: "ok" | "error" | "aborted";
  errorMessage?: string;
};
