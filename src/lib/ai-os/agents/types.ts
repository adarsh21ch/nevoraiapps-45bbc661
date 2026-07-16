/**
 * Agent Registry contract.
 *
 * An Agent is a NAMED AI capability — Owner, Founder, Finance, Coach, Parent, etc.
 * The orchestrator resolves an agent, then executes it through the standard
 * Context → Prompt → Provider → Tools pipeline.
 *
 * NEVER hardcode agent definitions inside the orchestrator. Register them here.
 */

import type { AIRole } from "../context/types";
import type { PromptId } from "../prompts";

export type AgentId =
  | "owner"
  | "founder"
  | "finance"
  | "admissions"
  | "attendance"
  | "communications"
  | "marketing"
  | "coach"
  | "parent"
  | "player"
  | "reports";

export type MemoryPolicy = {
  /** Persist turns to the memory store. */
  persist: boolean;
  /** Max turns kept before summarization kicks in. */
  maxTurns: number;
  /** Compress older turns into a rolling summary. */
  summarize: boolean;
};

export type ConfirmationPolicy = {
  /** Require explicit confirmation for ANY write tool call. */
  requireForWrites: boolean;
  /** Tools that ALWAYS require confirmation, regardless of the tool's own flag. */
  alwaysConfirm?: string[];
};

export type ResponseStyle = {
  tone: "professional" | "friendly" | "concise" | "detailed";
  /** Prefer markdown tables where numeric. */
  preferTables?: boolean;
  /** Include reasoning transparency in the response. */
  showReasoning?: boolean;
};

export type AgentDef = {
  id: AgentId;
  name: string;
  description: string;
  /** Roles allowed to invoke this agent. Empty = no one. */
  allowedRoles: AIRole[];
  /** Prompt id from `PROMPTS`. */
  systemPrompt: PromptId;
  /** Tool names the agent may see. Empty = all role-permitted tools. */
  allowedTools: string[];
  /** Provider id + model override. */
  provider?: string;
  defaultModel?: string;
  temperature: number;
  memory: MemoryPolicy;
  confirmation: ConfirmationPolicy;
  responseStyle: ResponseStyle;
  /** Capabilities reserved for future modules — descriptive only. */
  futureCapabilities?: string[];
};
