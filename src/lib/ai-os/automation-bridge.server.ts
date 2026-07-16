/**
 * Automation bridge — forward AI events into the existing Automation Engine.
 *
 * The Automation Engine consumes `public.automation_events`. We register a
 * single AI event handler that inserts one row per emitted AI event; the
 * existing engine handles routing, retries, and rule matching. NO new event
 * system is introduced.
 *
 * SERVER-ONLY. Call `bootstrapAutomationBridge()` from server bootstrap
 * exactly once.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registerAIEventHandler } from "./events/bus";

let installed = false;
let disposer: (() => void) | null = null;

export function bootstrapAutomationBridge(): void {
  if (installed) return;
  installed = true;
  disposer = registerAIEventHandler(async (event) => {
    try {
      await supabaseAdmin.from("automation_events").insert({
        tenant_id: event.tenantId,
        event_type: event.type,
        source_module: "nevorai",
        source_id: event.conversationId,
        payload: {
          agentId: event.agentId,
          userId: event.userId,
          at: event.at,
          ...(event.payload ?? {}),
        },
        status: "pending",
      });
    } catch {
      // Never let observability failures propagate into the orchestrator.
    }
  });
}

export function teardownAutomationBridge(): void {
  disposer?.();
  disposer = null;
  installed = false;
}
