/**
 * Automation Engine — server-only.
 *
 * Runs against pending `automation_events`, matches enabled rules, evaluates
 * conditions, and dispatches actions through the provider registry. Each
 * action produces one row in `automation_executions` with full audit trail.
 *
 * IMPORTANT: This module imports the admin client and MUST never be imported
 * from client code. Route/server-function callers use the queue tick via the
 * server function in ./queue.functions.ts.
 */

import type {
  Action,
  ActionContext,
  ActionResult,
  AutomationEvent,
  AutomationRule,
  ExecutionStatus,
} from "./types";
import { evaluateConditions } from "./conditions";
import { resolveProvider } from "./providers";

// Retry backoff: 30s, 2m, 10m
const BACKOFF_SECONDS = [30, 120, 600];

function nextRetryDelay(attempt: number): number {
  return BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)] ?? 600;
}

function renderDedupeKey(tpl: string, event: AutomationEvent): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const parts = path.split(".");
    let cur: unknown = { event, payload: event.payload };
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "";
      cur = (cur as Record<string, unknown>)[p];
    }
    return cur == null ? "" : String(cur);
  });
}

async function dispatchAction(
  ctx: ActionContext,
): Promise<ActionResult> {
  const provider = resolveProvider(ctx.action.type, ctx.action.provider);
  try {
    return await provider.dispatch(ctx);
  } catch (e) {
    return {
      ok: false,
      provider: provider.key,
      error: e instanceof Error ? e.message : String(e),
      retryable: true,
    };
  }
}

async function processEvent(event: AutomationEvent): Promise<{ actions: number; ok: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rules, error: rulesErr } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .eq("tenant_id", event.tenant_id)
    .eq("event_type", event.event_type)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (rulesErr) throw new Error(rulesErr.message);

  let dispatched = 0;
  let ok = 0;
  let failed = 0;

  for (const rawRule of (rules ?? []) as unknown as AutomationRule[]) {
    const rule: AutomationRule = {
      ...rawRule,
      conditions: Array.isArray(rawRule.conditions) ? rawRule.conditions : [],
      actions: Array.isArray(rawRule.actions) ? rawRule.actions : [],
    };
    if (!evaluateConditions(rule.conditions, event.payload)) continue;

    for (const action of rule.actions as Action[]) {
      dispatched += 1;
      const dedupeKey = action.dedupe_key ? renderDedupeKey(action.dedupe_key, event) : null;

      // Insert queued execution first (dedupe unique index blocks duplicates)
      const startedAt = new Date();
      const { data: execRow, error: insertErr } = await supabaseAdmin
        .from("automation_executions")
        .insert({
          tenant_id: event.tenant_id,
          rule_id: rule.id,
          event_id: event.id,
          event_type: event.event_type,
          action_type: action.type,
          provider: action.provider ?? null,
          status: "running" as ExecutionStatus,
          attempt: 1,
          max_attempts: action.max_attempts ?? 3,
          dedupe_key: dedupeKey,
          started_at: startedAt.toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (insertErr) {
        // Duplicate dedupe → skip silently
        if (insertErr.code === "23505") continue;
        failed += 1;
        continue;
      }
      if (!execRow) continue;

      const ctx: ActionContext = {
        tenantId: event.tenant_id,
        event,
        rule,
        action,
        attempt: 1,
      };
      const result = await dispatchAction(ctx);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const shouldRetry = !result.ok && result.retryable && 1 < (action.max_attempts ?? 3);
      const nextStatus: ExecutionStatus = result.ok ? "success" : shouldRetry ? "retrying" : "failed";
      const nextRetryAt = shouldRetry
        ? new Date(Date.now() + nextRetryDelay(1) * 1000).toISOString()
        : null;

      await supabaseAdmin
        .from("automation_executions")
        .update({
          status: nextStatus,
          provider: result.provider,
          duration_ms: durationMs,
          result: (result.data ?? null) as never,
          error: result.error ?? null,
          finished_at: finishedAt.toISOString(),
          next_retry_at: nextRetryAt,
        })
        .eq("id", execRow.id);

      if (result.ok) ok += 1;
      else failed += 1;
    }
  }

  return { actions: dispatched, ok, failed };
}

/** Worker tick: process a batch of pending events. Returns per-batch stats. */
export async function processPendingEvents(limit = 25): Promise<{
  events: number;
  actions: number;
  ok: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pending, error } = await supabaseAdmin
    .from("automation_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let totalActions = 0, totalOk = 0, totalFailed = 0;
  for (const evRow of (pending ?? []) as unknown as AutomationEvent[]) {
    try {
      const stats = await processEvent(evRow);
      totalActions += stats.actions;
      totalOk += stats.ok;
      totalFailed += stats.failed;
      await supabaseAdmin
        .from("automation_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", evRow.id);
    } catch (e) {
      await supabaseAdmin
        .from("automation_events")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
          processed_at: new Date().toISOString(),
        })
        .eq("id", evRow.id);
    }
  }

  return { events: pending?.length ?? 0, actions: totalActions, ok: totalOk, failed: totalFailed };
}

/** Retry sweep: pick up executions in `retrying` whose next_retry_at is due. */
export async function processDueRetries(limit = 25): Promise<{ retried: number; ok: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: due, error } = await supabaseAdmin
    .from("automation_executions")
    .select("*, automation_events(*), automation_rules(*)")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let ok = 0, failed = 0;
  for (const row of (due ?? []) as unknown as Array<{
    id: string;
    tenant_id: string;
    action_type: string;
    provider: string | null;
    attempt: number;
    max_attempts: number;
    automation_events: AutomationEvent | null;
    automation_rules: AutomationRule | null;
  }>) {
    if (!row.automation_events) continue;
    const attempt = row.attempt + 1;
    const startedAt = new Date();
    const rule = row.automation_rules;
    // Reconstruct action from the rule (we intentionally do not snapshot params
    // to keep executions small; retries always use the current rule definition).
    const action = rule?.actions.find((a) => a.type === row.action_type) ?? {
      type: row.action_type,
      params: {},
    } as Action;

    const ctx: ActionContext = {
      tenantId: row.tenant_id,
      event: row.automation_events,
      rule,
      action,
      attempt,
    };
    const result = await dispatchAction(ctx);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const canRetry = !result.ok && result.retryable && attempt < row.max_attempts;
    const nextStatus: ExecutionStatus = result.ok ? "success" : canRetry ? "retrying" : "failed";
    const nextRetryAt = canRetry
      ? new Date(Date.now() + nextRetryDelay(attempt) * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from("automation_executions")
      .update({
        status: nextStatus,
        attempt,
        provider: result.provider,
        duration_ms: durationMs,
        result: (result.data ?? null) as never,
        error: result.error ?? null,
        finished_at: finishedAt.toISOString(),
        next_retry_at: nextRetryAt,
      })
      .eq("id", row.id);

    if (result.ok) ok += 1;
    else failed += 1;
  }
  return { retried: due?.length ?? 0, ok, failed };
}
