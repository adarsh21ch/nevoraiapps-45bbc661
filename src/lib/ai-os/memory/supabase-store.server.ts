/**
 * Supabase-backed MemoryStore.
 *
 * Persists conversation turns + rolling summaries. Reuses the existing
 * `MemoryStore` interface — the orchestrator does not change.
 *
 * SERVER-ONLY. Uses the admin client so writes bypass RLS; RLS still
 * governs any read from browser code (which goes through the standard
 * supabase client, not this store).
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_OS_CONFIG } from "../config";
import type { ConversationId, MemoryStore, MemorySummary, MemoryTurn } from "./types";

type ConvContext = { tenantId: string; userId: string; agentId: string };

/**
 * Ensure a `ai_conversations` row exists — the orchestrator uses opaque
 * conversation IDs; if the caller passes a UUID that isn't provisioned yet
 * we lazily insert. If the caller passes something non-UUID, this store
 * silently drops the turn (defensive; UI should always pass a UUID).
 */
async function ensureConversation(
  conversationId: ConversationId,
  ctx?: ConvContext,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle();
  if (data) return true;
  if (!ctx) return false;
  const { error } = await supabaseAdmin.from("ai_conversations").insert({
    id: conversationId,
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    agent_id: ctx.agentId,
  });
  return !error;
}

export class SupabaseMemoryStore implements MemoryStore {
  /** Optional creation context — set by the orchestrator before append(). */
  private ctx = new Map<ConversationId, ConvContext>();

  /** Called by the orchestrator to seed lazy-create context. */
  setConversationContext(conversationId: ConversationId, ctx: ConvContext): void {
    this.ctx.set(conversationId, ctx);
  }

  async append(turn: MemoryTurn): Promise<void> {
    const ctx = this.ctx.get(turn.conversationId);
    const ok = await ensureConversation(turn.conversationId, ctx);
    if (!ok) return;
    await supabaseAdmin.from("ai_conversation_turns").insert({
      conversation_id: turn.conversationId,
      tenant_id: ctx?.tenantId ?? "00000000-0000-0000-0000-000000000000",
      role: turn.role,
      content: turn.content.slice(0, AI_OS_CONFIG.memory.maxCharsPerTurn),
      tool_name: turn.toolName ?? null,
      tool_call_id: turn.toolCallId ?? null,
      tokens: turn.tokens ?? null,
    });
    await supabaseAdmin
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", turn.conversationId);
  }

  async list(conversationId: ConversationId): Promise<MemoryTurn[]> {
    const { data } = await supabaseAdmin
      .from("ai_conversation_turns")
      .select("id, conversation_id, role, content, tool_name, tool_call_id, tokens, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(AI_OS_CONFIG.memory.maxTurns);
    if (!data) return [];
    return data.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role as MemoryTurn["role"],
      content: r.content,
      toolName: r.tool_name ?? undefined,
      toolCallId: r.tool_call_id ?? undefined,
      tokens: r.tokens ?? undefined,
      createdAt: r.created_at,
    }));
  }

  async summary(conversationId: ConversationId): Promise<MemorySummary | null> {
    const { data } = await supabaseAdmin
      .from("ai_conversation_summaries")
      .select("conversation_id, content, replaced_turns, created_at")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (!data) return null;
    return {
      conversationId: data.conversation_id,
      content: data.content,
      replacedTurns: data.replaced_turns,
      createdAt: data.created_at,
    };
  }

  async setSummary(summary: MemorySummary): Promise<void> {
    const ctx = this.ctx.get(summary.conversationId);
    await supabaseAdmin.from("ai_conversation_summaries").upsert(
      {
        conversation_id: summary.conversationId,
        tenant_id: ctx?.tenantId ?? "00000000-0000-0000-0000-000000000000",
        content: summary.content,
        replaced_turns: summary.replacedTurns,
      },
      { onConflict: "conversation_id" },
    );
  }

  async clear(conversationId: ConversationId): Promise<void> {
    // Soft-delete the conversation; cascade turns.
    await supabaseAdmin
      .from("ai_conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", conversationId);
  }
}
