/**
 * In-memory `MemoryStore` — for local dev + tests only.
 * Phase 11.1 replaces this with a Supabase-backed implementation.
 */

import type { ConversationId, MemoryStore, MemorySummary, MemoryTurn } from "./types";

export class InMemoryMemoryStore implements MemoryStore {
  private turns = new Map<ConversationId, MemoryTurn[]>();
  private summaries = new Map<ConversationId, MemorySummary>();

  async append(turn: MemoryTurn): Promise<void> {
    const list = this.turns.get(turn.conversationId) ?? [];
    list.push(turn);
    this.turns.set(turn.conversationId, list);
  }

  async list(conversationId: ConversationId): Promise<MemoryTurn[]> {
    return [...(this.turns.get(conversationId) ?? [])];
  }

  async summary(conversationId: ConversationId): Promise<MemorySummary | null> {
    return this.summaries.get(conversationId) ?? null;
  }

  async setSummary(summary: MemorySummary): Promise<void> {
    this.summaries.set(summary.conversationId, summary);
  }

  async clear(conversationId: ConversationId): Promise<void> {
    this.turns.delete(conversationId);
    this.summaries.delete(conversationId);
  }
}
