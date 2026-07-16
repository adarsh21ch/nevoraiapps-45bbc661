/**
 * Lovable AI Gateway provider — server only.
 *
 * Reused by every server-side call to Lovable AI (chat streaming, briefs,
 * one-shots). Never import from client code.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
    },
  });
}

/** Default chat model for NevorAI Owner AI. */
export const NEVORAI_DEFAULT_MODEL = "google/gemini-3-flash-preview";
