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
