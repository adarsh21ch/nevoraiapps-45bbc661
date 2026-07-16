/**
 * Conversation memory contract.
 *
 * A `MemoryStore` is an interface — the concrete implementation lands
 * in phase 11.1 (in-memory for dev, Supabase-backed for production).
 * The shape here is intentionally minimal so we can swap stores.
 */

import type { AIMessage } from "../providers/types";

export type ConversationId = string;

export type MemoryTurn = {
  id: string;
  conversationId: ConversationId;
  role: AIMessage["role"];
  content: string;
  /** Tool outputs are stored as compact JSON strings. */
  toolName?: string;
  toolCallId?: string;
  createdAt: string;
  /** Approx token count (populated by usage tracker). */
  tokens?: number;
};

/** A rolling summary produced when memory is trimmed. */
export type MemorySummary = {
  conversationId: ConversationId;
  content: string;
  /** How many turns this summary replaces. */
  replacedTurns: number;
  createdAt: string;
};

export interface MemoryStore {
  append(turn: MemoryTurn): Promise<void>;
  list(conversationId: ConversationId): Promise<MemoryTurn[]>;
  summary(conversationId: ConversationId): Promise<MemorySummary | null>;
  setSummary(summary: MemorySummary): Promise<void>;
  clear(conversationId: ConversationId): Promise<void>;
}
