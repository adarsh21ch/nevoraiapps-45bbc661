/**
 * Supabase-backed ActionQueue.
 * SERVER-ONLY. Preserves the existing `ActionQueue` interface.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ActionQueue, ActionStatus, QueuedAction } from "./types";

function rowToAction(r: {
  id: string;
  tenant_id: string;
  user_id: string;
  agent_id: string;
  conversation_id: string | null;
  tool_name: string;
  input: unknown;
  status: string;
  target: string | null;
  confirmation_title: string | null;
  confirmation_body: string | null;
  result: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}): QueuedAction {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    agentId: r.agent_id,
    conversationId: r.conversation_id ?? "",
    toolName: r.tool_name,
    input: r.input ?? {},
    status: r.status as ActionStatus,
    target: r.target ?? undefined,
    confirmationTitle: r.confirmation_title ?? undefined,
    confirmationBody: r.confirmation_body ?? undefined,
    result: r.result ?? undefined,
    errorMessage: r.error_message ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SupabaseActionQueue implements ActionQueue {
  async enqueue(
    action: Omit<QueuedAction, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<QueuedAction> {
    const { data, error } = await supabaseAdmin
      .from("ai_action_queue")
      .insert({
        tenant_id: action.tenantId,
        user_id: action.userId,
        agent_id: action.agentId,
        conversation_id: action.conversationId || null,
        tool_name: action.toolName,
        input: (action.input ?? {}) as never,
        target: action.target ?? null,
        confirmation_title: action.confirmationTitle ?? null,
        confirmation_body: action.confirmationBody ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("failed to enqueue action");
    return rowToAction(data);
  }

  async get(id: string): Promise<QueuedAction | null> {
    const { data } = await supabaseAdmin
      .from("ai_action_queue")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? rowToAction(data) : null;
  }

  async list(filter: { tenantId: string; status?: ActionStatus }): Promise<QueuedAction[]> {
    let q = supabaseAdmin
      .from("ai_action_queue")
      .select("*")
      .eq("tenant_id", filter.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter.status) q = q.eq("status", filter.status);
    const { data } = await q;
    return (data ?? []).map(rowToAction);
  }

  async updateStatus(
    id: string,
    status: ActionStatus,
    patch: Partial<QueuedAction> = {},
  ): Promise<QueuedAction | null> {
    const update: Record<string, unknown> = { status };
    if (status === "approved") update.approved_at = new Date().toISOString();
    if (status === "executed") update.executed_at = new Date().toISOString();
    if (patch.result !== undefined) update.result = patch.result;
    if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
    const { data } = await supabaseAdmin
      .from("ai_action_queue")
      .update(update as never)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    return data ? rowToAction(data) : null;
  }
}
