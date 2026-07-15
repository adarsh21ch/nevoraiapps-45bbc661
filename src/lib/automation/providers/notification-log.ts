import type { ActionContext, ActionResult } from "../types";
import type { ActionProvider } from "./index";

/**
 * Notification Log provider — persists a row into `notifications` if that
 * table is reachable via the admin client. Falls back to a structured result
 * that the execution log will capture.
 *
 * This provider only runs server-side (queue worker). It loads the admin
 * client lazily to keep it out of any client bundle.
 */
export const notificationLogProvider: ActionProvider = {
  key: "notification.log",
  handles: ["notification.create"],
  async dispatch(ctx: ActionContext): Promise<ActionResult> {
    const params = ctx.action.params ?? {};
    const title = String(params.title ?? `Event: ${ctx.event.event_type}`);
    const body = String(params.body ?? "");
    const kind = String(params.kind ?? "automation");
    const recipient = (params.recipient_user_id as string | undefined) ?? null;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const row: Record<string, unknown> = {
        tenant_id: ctx.tenantId,
        kind,
        title,
        body,
        payload: {
          automation: {
            rule_id: ctx.rule?.id ?? null,
            event_id: ctx.event.id,
            event_type: ctx.event.event_type,
          },
        },
      };
      if (recipient) row.user_id = recipient;
      const { error } = await supabaseAdmin.from("notifications").insert(row as never);
      if (error) {
        return {
          ok: false,
          provider: "notification.log",
          error: error.message,
          retryable: true,
        };
      }
      return { ok: true, provider: "notification.log", data: { title, kind } };
    } catch (e) {
      return {
        ok: false,
        provider: "notification.log",
        error: e instanceof Error ? e.message : String(e),
        retryable: true,
      };
    }
  },
};
