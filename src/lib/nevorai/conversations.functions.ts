/**
 * NevorAI conversation server functions.
 *
 * Reuses the existing `ai_conversations` / `ai_conversation_turns` tables
 * (created in Phase 11.2). All writes go through `supabaseAdmin` after
 * the caller has been authenticated by `requireSupabaseAuth`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_AGENT = "owner_ai";

export type ConversationRow = {
  id: string;
  title: string | null;
  pinned: boolean;
  agent_id: string;
  created_at: string;
  updated_at: string;
};

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_conversations")
      .select("id, title, pinned, agent_id, created_at, updated_at")
      .is("deleted_at", null)
      .eq("user_id", context.userId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as ConversationRow[];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title?: string }) =>
    z.object({ title: z.string().max(200).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up tenant for this user.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("No tenant for user");
    const { data: row, error } = await supabaseAdmin
      .from("ai_conversations")
      .insert({
        tenant_id: profile.tenant_id,
        user_id: context.userId,
        agent_id: DEFAULT_AGENT,
        title: data.title ?? "New conversation",
      })
      .select("id, title, pinned, agent_id, created_at, updated_at")
      .single();
    if (error) throw error;
    return row as ConversationRow;
  });

export const renameConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; title: string }) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const pinConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; pinned: boolean }) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .update({ pinned: data.pinned })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_conversations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export type TurnRow = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  parts: unknown | null;
  tool_name: string | null;
  created_at: string;
};

export const listTurns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_conversation_turns")
      .select("id, role, content, parts, tool_name, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return (rows ?? []) as TurnRow[];
  });
