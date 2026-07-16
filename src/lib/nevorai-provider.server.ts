/**
 * NevorAI provider — Official Google Gemini API (server-only).
 *
 * This is the ONLY place the AI SDK connects to a model provider for the
 * `/api/chat` streaming route. The Provider Registry (src/lib/ai-os/providers)
 * remains the abstract layer that future providers (Claude, OpenAI, Grok)
 * plug into — but user-facing chat streaming uses the AI SDK's official
 * Google provider directly for first-class streaming + tool calling.
 *
 * Never import this from client code. Reads `GOOGLE_API_KEY` from env.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function createNevorAIProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

/** Default chat model for NevorAI. Configurable per agent. */
export const NEVORAI_DEFAULT_MODEL = "gemini-2.5-flash";
