/**
 * Event Bus — public API for emitting platform events.
 *
 * Any business module (Attendance, Fees, Students, Match Center, etc.) calls
 * `emitAutomationEvent` when a domain change happens. The call is fire-and-
 * forget from the caller's perspective: it inserts a pending row into
 * `automation_events` and returns.
 *
 * A background worker (see queue.functions.ts) drains the queue and dispatches
 * actions. The event bus itself does no matching, so the business workflow
 * is never blocked by rule evaluation or provider latency.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const emitInput = z.object({
  tenantId: z.string().uuid(),
  eventType: z.string().min(1).max(120),
  sourceModule: z.string().max(60).nullable().optional(),
  sourceId: z.string().max(120).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const emitAutomationEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => emitInput.parse(v))
  .handler(async ({ data, context }) => {
    // Tenant isolation: the caller must belong to the tenant they're emitting for.
    // RLS enforces this on the INSERT, but check explicitly for a clearer error.
    const { data: member } = await context.supabase.rpc("is_tenant_member", {
      _uid: context.userId,
      _tenant: data.tenantId,
    });
    if (!member) {
      const { data: admin } = await context.supabase.rpc("is_platform_admin", {
        _uid: context.userId,
      });
      if (!admin) throw new Error("Forbidden: not a tenant member");
    }

    const { data: row, error } = await context.supabase
      .from("automation_events")
      .insert({
        tenant_id: data.tenantId,
        event_type: data.eventType,
        source_module: data.sourceModule ?? null,
        source_id: data.sourceId ?? null,
        payload: data.payload as never,
      })
      .select("id, created_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id ?? null, created_at: row?.created_at ?? null };
  });
