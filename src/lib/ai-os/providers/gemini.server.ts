/**
 * Gemini provider — Official Google Generative Language API.
 *
 * SERVER-ONLY. Reads `GOOGLE_API_KEY` from process.env inside call sites.
 * Uses Google's OpenAI-compatibility endpoint so the OpenAI-shaped code
 * paths below (chat completions, tool_calls, streaming SSE) work unchanged.
 * Client code MUST NOT import this module.
 *
 * This is the first concrete implementation of `AIProvider`. Adding
 * Claude / OpenAI / Grok later means dropping another `<id>.server.ts`
 * and calling `registerProvider(...)` — no changes elsewhere.
 */

import { AI_OS_CONFIG } from "../config";
import { registerProvider } from "./registry";
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  AIStreamEvent,
  AIUsage,
} from "./types";

const GATEWAY_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Rough price per 1M tokens (USD). Only used for estimation / dashboards. */
const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.5-pro": { in: 1.25, out: 5.0 },
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const p = PRICE_PER_MTOK[model] ?? { in: 0, out: 0 };
  return (inTok * p.in + outTok * p.out) / 1_000_000;
}

async function sleep(ms: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

async function callGateway(body: unknown, signal: AbortSignal): Promise<Response> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set");

  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

function buildBody(model: string, req: AIGenerateRequest, stream: boolean) {
  const body: Record<string, unknown> = {
    model,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.toolName ? { name: m.toolName } : {}),
    })),
    stream,
  };
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  if (req.responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "response", schema: req.responseSchema, strict: false },
    };
  }
  return body;
}

class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly defaultModel = AI_OS_CONFIG.defaultModels.gemini;

  async generate(req: AIGenerateRequest): Promise<AIGenerateResult> {
    const model = req.model ?? this.defaultModel;
    const started = Date.now();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), AI_OS_CONFIG.requestTimeoutMs);
    req.signal?.addEventListener("abort", () => ctrl.abort());

    let attempt = 0;
    let lastErr: unknown;
    try {
      while (attempt < AI_OS_CONFIG.retry.maxAttempts) {
        attempt++;
        try {
          const res = await callGateway(buildBody(model, req, false), ctrl.signal);
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error(`gateway ${res.status}`);
            const delay = Math.min(
              AI_OS_CONFIG.retry.baseDelayMs * 2 ** (attempt - 1),
              AI_OS_CONFIG.retry.maxDelayMs,
            );
            await sleep(delay, ctrl.signal);
            continue;
          }
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`gateway ${res.status}: ${text}`);
          }
          const json = (await res.json()) as {
            choices: Array<{
              message: {
                content?: string;
                tool_calls?: Array<{
                  id: string;
                  function: { name: string; arguments: string };
                }>;
              };
              finish_reason: string;
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const choice = json.choices?.[0];
          const inTok = json.usage?.prompt_tokens ?? 0;
          const outTok = json.usage?.completion_tokens ?? 0;
          const usage: AIUsage = {
            inputTokens: inTok,
            outputTokens: outTok,
            estimatedCostUsd: estimateCost(model, inTok, outTok),
            latencyMs: Date.now() - started,
          };
          const toolCalls = choice?.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: safeJson(tc.function.arguments) as Record<string, unknown>,
          }));
          const rawText = choice?.message.content;
          const finishReason = (choice?.finish_reason ??
            "stop") as AIGenerateResult["finishReason"];
          return {
            text: req.responseSchema ? undefined : rawText,
            data: req.responseSchema ? safeJson(rawText ?? "") : undefined,
            toolCalls,
            usage,
            finishReason,
          };
        } catch (e) {
          lastErr = e;
          if (ctrl.signal.aborted) throw e;
          const delay = Math.min(
            AI_OS_CONFIG.retry.baseDelayMs * 2 ** (attempt - 1),
            AI_OS_CONFIG.retry.maxDelayMs,
          );
          await sleep(delay, ctrl.signal);
        }
      }
      throw lastErr ?? new Error("gemini generate failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  async *stream(req: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const model = req.model ?? this.defaultModel;
    const started = Date.now();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), AI_OS_CONFIG.requestTimeoutMs);
    req.signal?.addEventListener("abort", () => ctrl.abort());

    try {
      const res = await callGateway(buildBody(model, req, true), ctrl.signal);
      if (!res.ok || !res.body) {
        yield { type: "error", error: `gateway ${res.status}` };
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let inTok = 0;
      let outTok = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") continue;
          const chunk = safeJson(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          } | null;
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) yield { type: "text-delta", delta };
          if (chunk?.usage) {
            inTok = chunk.usage.prompt_tokens ?? inTok;
            outTok = chunk.usage.completion_tokens ?? outTok;
          }
        }
      }
      yield {
        type: "usage",
        usage: {
          inputTokens: inTok,
          outputTokens: outTok,
          estimatedCostUsd: estimateCost(model, inTok, outTok),
          latencyMs: Date.now() - started,
        },
      };
      yield { type: "finish", finishReason: "stop" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

registerProvider(new GeminiProvider());
