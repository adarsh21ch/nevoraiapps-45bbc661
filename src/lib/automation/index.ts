/**
 * Platform Automation Engine — public entry.
 *
 * Client-safe exports only. Server-only pieces (engine, admin dispatch) live
 * in engine.server.ts and are never re-exported here.
 */

export { AUTOMATION_EVENTS } from "./types";
export type {
  AutomationEvent,
  AutomationEventType,
  AutomationRule,
  AutomationExecution,
  Action,
  ActionType,
  ActionResult,
  ActionContext,
  Condition,
  ConditionOperator,
  ExecutionStatus,
  EventPayload,
} from "./types";
export { evaluateConditions } from "./conditions";
export { emitAutomationEvent } from "./event-bus.functions";
export type { AiProvider, AiRequest, AiResponse, AiCapability } from "./ai";
export { registerAiProvider, getAiProvider, listAiProviders } from "./ai";
