/**
 * NevorAI Orchestrator — the ONE entry point for every AI feature.
 *
 * Flow:
 *   User
 *     → Context Builder    (already have `AIContext` from caller)
 *     → Agent Registry     (agent = system prompt + tools + policies)
 *     → Rate Limit         (tenant / user / agent budgets)
 *     → Memory             (load prior turns, prepend rolling summary)
 *     → Provider           (single provider call; retries handled inside)
 *     → Tool Calls         (read tools execute inline; writes → Action Queue)
 *     → Response
 *     → Analytics + Events
 *
 * Nothing bypasses this pipeline. Providers are ONLY invoked here.
 */

import { AI_OS_CONFIG } from "../config";
import { getAgent } from "../agents/registry";
import { getProvider } from "../providers/registry";
import { PROMPTS } from "../prompts";
import { getTool, invokeTool, toolsForContext } from "../tools/registry";
import { describeConfirmation } from "../safety/guards";
import { emitAIEvent, makeEvent } from "../events/bus";
import { getRuntime } from "./runtime";
import { DEFAULT_BUDGETS, type RateLimitConfig, type RateLimitKey } from "../rate-limit/limits";
import type { AIMessage, AIToolSchema } from "../providers/types";
import type { QueuedAction } from "../queue/types";
import type { RunAgentInput, RunAgentResult } from "./types";

let runCounter = 0;

function newRunId(): string {
  runCounter += 1;
  return `run_${Date.now()}_${runCounter}`;
}

async function enforceRateLimits(
  tenantId: string,
  userId: string,
  agentId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { rateLimiter } = getRuntime();
  const scopes: [RateLimitKey, RateLimitConfig][] = DEFAULT_BUDGETS
    .filter((c) => c.metric === "requests")
    .map((cfg) => {
      const scopeId =
        cfg.scope === "tenant" ? tenantId : cfg.scope === "user" ? userId : agentId;
      return [{ scope: cfg.scope, scopeId, metric: cfg.metric, window: cfg.window }, cfg];
    });
  for (const [key, cfg] of scopes) {
    const result = await rateLimiter.check(key, 1, cfg);
    if (!result.ok) return { ok: false, reason: result.reason };
  }
  return { ok: true };
}

/** Main entry point for every AI feature. */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { agentId, ctx, conversationId, userMessage, history = [], approvedActionIds = [] } = input;
  const runId = newRunId();
  const startedAt = new Date().toISOString();
  const runtime = getRuntime();
  const baseEvent = { tenantId: ctx.tenantId, userId: ctx.userId, agentId, conversationId };

  const agent = getAgent(agentId);
  if (!agent) {
    return failure(runId, conversationId, startedAt, "agent_not_found", `Unknown agent "${agentId}"`);
  }
  if (!agent.allowedRoles.includes(ctx.role)) {
    return failure(runId, conversationId, startedAt, "forbidden", `Role "${ctx.role}" cannot use "${agentId}"`);
  }

  const rate = await enforceRateLimits(ctx.tenantId, ctx.userId, agentId);
  if (!rate.ok) {
    return failure(runId, conversationId, startedAt, "rate_limited", rate.reason);
  }

  await emitAIEvent(makeEvent("ai.request_started", baseEvent, { runId }));

  // Execute previously-approved actions BEFORE the model call so their
  // results can be included in the assistant's next response.
  const toolResults: RunAgentResult["toolResults"] = [];
  for (const actionId of approvedActionIds) {
    const action = await runtime.queue.get(actionId);
    if (!action || action.tenantId !== ctx.tenantId) continue;
    if (action.status !== "approved") continue;
    const t0 = Date.now();
    const result = await invokeTool(action.toolName, action.input, ctx, { confirmed: true });
    await runtime.queue.updateStatus(actionId, result.ok ? "executed" : "failed", {
      result: result.ok ? result.data : undefined,
      errorMessage: result.ok ? undefined : result.message,
    });
    toolResults.push({
      name: action.toolName,
      ok: result.ok,
      data: result.ok ? result.data : undefined,
      message: result.ok ? undefined : result.message,
    });
    await emitAIEvent(
      makeEvent(result.ok ? "ai.tool_called" : "ai.tool_failed", baseEvent, {
        toolName: action.toolName,
        ms: Date.now() - t0,
        confirmed: true,
      }),
    );
    await emitAIEvent(makeEvent("ai.confirmation_completed", baseEvent, { actionId, approved: true }));
  }

  // Build messages: system prompt + memory + user turn.
  const systemPrompt = PROMPTS[agent.systemPrompt](ctx);
  const priorTurns = await runtime.memory.list(conversationId);
  const memMessages: AIMessage[] = priorTurns.map((t) => ({
    role: t.role,
    content: t.content,
    toolName: t.toolName,
    toolCallId: t.toolCallId,
  }));

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...memMessages,
    ...history,
    { role: "user", content: userMessage },
  ];

  // Tool set = registry ∩ agent.allowedTools (respecting role via registry).
  const availableTools = toolsForContext(ctx).filter((t) =>
    agent.allowedTools.length === 0 ? true : agent.allowedTools.includes(t.name),
  );
  const toolSchemas: AIToolSchema[] = availableTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const providerId = agent.provider ?? AI_OS_CONFIG.defaultProvider;
  const provider = getProvider(providerId);
  const model = agent.defaultModel ?? provider.defaultModel;

  const providerStart = Date.now();
  const pendingActions: QueuedAction[] = [];
  let assistantText: string | undefined;
  let usage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 0 };
  let completionStatus: RunAgentResult["completionStatus"] = "ok";
  let errorMessage: string | undefined;
  let confirmationRequired = false;

  try {
    const result = await provider.generate({
      messages,
      tools: toolSchemas.length ? toolSchemas : undefined,
      model,
      temperature: agent.temperature,
      signal: input.signal,
    });
    usage = result.usage;
    assistantText = result.text;

    // Handle tool calls the model wants to make.
    if (result.toolCalls?.length) {
      for (const call of result.toolCalls) {
        const tool = getTool(call.name);
        if (!tool) {
          toolResults.push({ name: call.name, ok: false, message: "unknown tool" });
          continue;
        }
        const mustConfirm =
          tool.requiresConfirmation ||
          agent.confirmation.alwaysConfirm?.includes(call.name) === true;

        if (mustConfirm) {
          confirmationRequired = true;
          const prompt = describeConfirmation(call.name, call.arguments, ctx);
          const action = await runtime.queue.enqueue({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            agentId,
            conversationId,
            toolName: call.name,
            input: call.arguments,
            confirmationTitle: prompt?.humanTitle,
            confirmationBody: prompt?.humanBody,
          });
          pendingActions.push(action);
          await emitAIEvent(
            makeEvent("ai.confirmation_requested", baseEvent, {
              actionId: action.id,
              toolName: call.name,
            }),
          );
        } else {
          const t0 = Date.now();
          const r = await invokeTool(call.name, call.arguments, ctx);
          toolResults.push({
            name: call.name,
            ok: r.ok,
            data: r.ok ? r.data : undefined,
            message: r.ok ? undefined : r.message,
          });
          await emitAIEvent(
            makeEvent(r.ok ? "ai.tool_called" : "ai.tool_failed", baseEvent, {
              toolName: call.name,
              ms: Date.now() - t0,
            }),
          );
        }
      }
    }

    // Persist memory turns (user + assistant).
    if (agent.memory.persist) {
      const now = new Date().toISOString();
      await runtime.memory.append({
        id: `${runId}_u`,
        conversationId,
        role: "user",
        content: userMessage,
        createdAt: now,
      });
      if (assistantText) {
        await runtime.memory.append({
          id: `${runId}_a`,
          conversationId,
          role: "assistant",
          content: assistantText,
          createdAt: now,
        });
      }
    }
  } catch (e) {
    completionStatus = e instanceof Error && e.name === "AbortError" ? "aborted" : "error";
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  const finishedAt = new Date().toISOString();
  usage.latencyMs = usage.latencyMs || Date.now() - providerStart;

  // Usage + analytics.
  await runtime.usage.record({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    provider: providerId,
    model,
    usage,
    retries: 0,
    ok: completionStatus === "ok",
    errorMessage,
    at: finishedAt,
  });
  await runtime.analytics.record({
    conversationId,
    runId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    agentId,
    provider: providerId,
    model,
    latencyMs: usage.latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
    toolCalls: (toolResults ?? []).map((t) => ({ name: t.name, ok: t.ok, ms: 0 })),
    failures: (toolResults ?? []).filter((t) => !t.ok).length,
    retries: 0,
    completionStatus,
    confirmationRequired,
    confirmationApproved: approvedActionIds.length > 0,
    startedAt,
    finishedAt,
    errorMessage,
  });

  await emitAIEvent(
    makeEvent(
      completionStatus === "ok" ? "ai.request_completed" : "ai.request_failed",
      baseEvent,
      { runId, completionStatus, errorMessage },
    ),
  );

  return {
    runId,
    conversationId,
    text: assistantText,
    toolResults: toolResults.length ? toolResults : undefined,
    pendingActions: pendingActions.length ? pendingActions : undefined,
    usage,
    completionStatus,
    errorMessage,
  };
}

function failure(
  runId: string,
  conversationId: string,
  startedAt: string,
  code: string,
  message: string,
): RunAgentResult {
  return {
    runId,
    conversationId,
    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 0 },
    completionStatus: "error",
    errorMessage: `${code}: ${message}`,
    // Preserve `startedAt` in error message context so callers can log it.
    // (Not part of the public shape; analytics captures full timing.)
    ...(startedAt ? {} : {}),
  };
}
