/**
 * NevorAI Action Queue server functions.
 *
 * Reuses the existing `ai_action_queue` table + Phase 11.1 `approveAction` /
 * `rejectAction` orchestrator helpers so this UI can never bypass the
 * confirmation gate.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActionQueueRow = {
  id: string;
  tool_name: string;
  status: string;
  target: string | null;
  confirmation_title: string | null;
  confirmation_body: string | null;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export const listActionQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.tenant_id) return [] as ActionQueueRow[];
    const { data, error } = await context.supabase
      .from("ai_action_queue")
      .select(
        "id, tool_name, status, target, confirmation_title, confirmation_body, input, result, error_message, created_at, updated_at",
      )
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as ActionQueueRow[];
  });

export const approveQueuedAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { bootstrapNevorAI } = await import("@/lib/ai-os/bootstrap.server");
    bootstrapNevorAI();
    const { approveAction } = await import("@/lib/ai-os");
    const ok = await approveAction(data.id);
    return { ok };
  });

export const rejectQueuedAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { bootstrapNevorAI } = await import("@/lib/ai-os/bootstrap.server");
    bootstrapNevorAI();
    const { rejectAction } = await import("@/lib/ai-os");
    const ok = await rejectAction(data.id);
    return { ok };
  });
