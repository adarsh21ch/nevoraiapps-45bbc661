/**
 * NevorAI provider — Lovable AI Gateway (server-only).
 *
 * Chat streams for `/api/chat` go through the Lovable AI Gateway using
 * `LOVABLE_API_KEY`. This replaces the earlier direct-to-Google Gemini
 * transport, which hit the free-tier `generate_content_free_tier_requests`
 * cap (20 req/day for gemini-2.5-flash) and surfaced as a generic
 * "Something went wrong" error in the chat UI.
 *
 * The Lovable AI Gateway is OpenAI-compatible, streaming + tool-calling
 * capable, and billed against workspace credits (no free-tier per-day cap).
 *
 * Never import this from client code.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createNevorAIProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Default chat model for NevorAI.
 * `google/gemini-3-flash-preview` is the Lovable AI Gateway default chat
 * model — same Gemini family as the previous direct-API model, no free-tier
 * per-day cap.
 */
export const NEVORAI_DEFAULT_MODEL = "google/gemini-3-flash-preview";
