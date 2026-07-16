/**
 * AI OS — public entrypoint (client-safe).
 *
 * This barrel intentionally re-exports ONLY client-safe modules.
 * Provider implementations live in `providers/*.server.ts` and must
 * be imported from server code (server functions, server routes).
 */

export { AI_OS_CONFIG } from "./config";
export type { AIContext, AIRole } from "./context/types";
export { buildContext } from "./context/builder";
export type { ContextInput } from "./context/builder";
export type {
  AIProvider,
  AIMessage,
  AIToolSchema,
  AIToolCall,
  AIUsage,
  AIGenerateRequest,
  AIGenerateResult,
  AIStreamEvent,
} from "./providers/types";
export {
  getProvider,
  hasProvider,
  listProviders,
  registerProvider,
} from "./providers/registry";
export type { AnyToolDef, ToolDef, ToolResult } from "./tools/types";
export {
  registerTool,
  registerTools,
  toolsForContext,
  getTool,
  invokeTool,
} from "./tools/registry";
export { bootstrapTools } from "./tools/bootstrap";
export { ALL_TOOLS, READ_TOOLS, WRITE_TOOLS } from "./tools/definitions";
export { PROMPTS, defaultPromptFor } from "./prompts";
export type { PromptId } from "./prompts";
export type { MemoryStore, MemoryTurn, MemorySummary, ConversationId } from "./memory/types";
export { InMemoryMemoryStore } from "./memory/in-memory-store";
export type { UsageTracker, UsageEvent, TenantDailyUsage } from "./usage/types";
export { InMemoryUsageTracker } from "./usage/in-memory-tracker";
export { checkRateLimit } from "./rate-limit";
export { describeConfirmation, FORBIDDEN_ACTIONS } from "./safety/guards";
export type { ConfirmationPrompt } from "./safety/guards";

// --- Phase 11.1 additions -------------------------------------------------
export type {
  AgentDef,
  AgentId,
  MemoryPolicy,
  ConfirmationPolicy,
  ResponseStyle,
} from "./agents/types";
export {
  registerAgent,
  registerAgents,
  getAgent,
  listAgents,
  agentsForContext,
  canUseAgent,
} from "./agents/registry";
export { ALL_AGENTS } from "./agents/definitions";
export { bootstrapAgents } from "./agents/bootstrap";

export type { AIEvent, AIEventType, AIEventHandler } from "./events/types";
export { registerAIEventHandler, emitAIEvent, makeEvent } from "./events/bus";

export type { ActionQueue, ActionStatus, QueuedAction } from "./queue/types";
export { InMemoryActionQueue } from "./queue/in-memory-queue";

export type { AIAnalyticsRecord, AIAnalyticsSink } from "./observability/types";
export { InMemoryAnalyticsSink } from "./observability/in-memory-sink";

export type {
  RateLimiter,
  RateLimitKey,
  RateLimitConfig,
  RateLimitScope,
  RateLimitWindow,
  RateLimitMetric,
  RateLimitResult,
} from "./rate-limit/limits";
export { DEFAULT_BUDGETS } from "./rate-limit/limits";
export { InMemoryRateLimiter } from "./rate-limit/in-memory-limiter";

export type { AIRuntime } from "./orchestrator/runtime";
export { getRuntime, setRuntime } from "./orchestrator/runtime";
export type { RunAgentInput, RunAgentResult } from "./orchestrator/types";
export { runAgent } from "./orchestrator/index";
export { approveAction, rejectAction } from "./orchestrator/confirm";
