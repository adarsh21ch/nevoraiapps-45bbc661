/**
 * AI Extension Points.
 *
 * The Automation Engine does NOT integrate any AI model directly.
 * Future providers (Gemini, Lovable AI Gateway, etc.) implement AiProvider
 * and register through `registerAiProvider`. The `ai.generate` action then
 * dispatches through the standard action-provider registry (see providers/index.ts).
 *
 * Contract:
 *   - Providers are stateless with respect to the engine.
 *   - Providers receive the full event payload and can read tenant context.
 *   - Providers return plain strings or JSON — never streams — so results are
 *     safely serializable into the execution log.
 */

export type AiCapability =
  | "personalized_message"
  | "report_summary"
  | "parent_notification"
  | "owner_summary"
  | "question_answer";

export interface AiRequest {
  tenantId: string;
  capability: AiCapability;
  input: Record<string, unknown>;
  /** Optional model override; providers may ignore. */
  model?: string;
  /** Language hint (e.g. "en", "hi"). Providers may ignore. */
  locale?: string;
}

export interface AiResponse {
  text: string;
  data?: Record<string, unknown>;
  model?: string;
  usage?: Record<string, unknown>;
}

export interface AiProvider {
  key: string;
  capabilities: AiCapability[];
  generate(req: AiRequest): Promise<AiResponse>;
}

const aiRegistry = new Map<string, AiProvider>();

export function registerAiProvider(provider: AiProvider): void {
  aiRegistry.set(provider.key, provider);
}

export function getAiProvider(key: string): AiProvider | undefined {
  return aiRegistry.get(key);
}

export function listAiProviders(): AiProvider[] {
  return Array.from(aiRegistry.values());
}

/** No AI providers are registered by default. This is intentional. */
