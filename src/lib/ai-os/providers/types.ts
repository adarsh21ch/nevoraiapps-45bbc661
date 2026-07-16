/**
 * Provider-agnostic AI interface.
 *
 * Consumers depend on `AIProvider`, never on a concrete model SDK.
 * A provider is the ONLY place model API calls happen.
 */

export type AIRole = "system" | "user" | "assistant" | "tool";

export type AIMessage = {
  role: AIRole;
  content: string;
  /** Present on `role: "tool"` messages. */
  toolName?: string;
  /** Present on `role: "tool"` messages. */
  toolCallId?: string;
};

export type AIToolSchema = {
  name: string;
  description: string;
  /** JSON schema for the tool's input. Keep it constraint-free. */
  parameters: Record<string, unknown>;
};

export type AIToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD (provider-specific). */
  estimatedCostUsd: number;
  /** End-to-end latency for THIS provider call. */
  latencyMs: number;
};

export type AIGenerateRequest = {
  /** Conversation so far, including the system prompt as the first entry. */
  messages: AIMessage[];
  /** Optional tool schemas the model may call. */
  tools?: AIToolSchema[];
  /** JSON schema for a structured response, or `undefined` for freeform text. */
  responseSchema?: Record<string, unknown>;
  /** Override the provider's default model. */
  model?: string;
  temperature?: number;
  /** Abort signal from the caller. */
  signal?: AbortSignal;
};

export type AIGenerateResult = {
  /** Freeform text output when no `responseSchema` was requested. */
  text?: string;
  /** Parsed structured output when `responseSchema` was requested. */
  data?: unknown;
  /** Tool calls the model wants to invoke, if any. */
  toolCalls?: AIToolCall[];
  usage: AIUsage;
  /** Terminal reason: stop | length | tool_calls | content_filter. */
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
};

export type AIStreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; call: AIToolCall }
  | { type: "usage"; usage: AIUsage }
  | { type: "finish"; finishReason: AIGenerateResult["finishReason"] }
  | { type: "error"; error: string };

export interface AIProvider {
  readonly id: string;
  readonly defaultModel: string;
  /** Non-streaming one-shot generation. */
  generate(req: AIGenerateRequest): Promise<AIGenerateResult>;
  /** Streaming generation. */
  stream(req: AIGenerateRequest): AsyncIterable<AIStreamEvent>;
}
