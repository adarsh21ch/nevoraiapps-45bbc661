import type { ActionContext, ActionResult, ActionType } from "../types";
import type { ActionProvider } from "./index";

/**
 * Mock provider — accepts any action, logs it, always succeeds.
 * Useful as the fallback while real providers (WhatsApp, Email, SMS) are wired.
 */
export const mockProvider: ActionProvider = {
  key: "mock",
  handles: [
    "notification.create",
    "notification.whatsapp",
    "notification.email",
    "notification.sms",
    "notification.push",
    "webhook.call",
    "pdf.generate",
    "report.generate",
    "task.create",
    "record.update",
    "delay",
    "ai.generate",
  ] as ActionType[],
  async dispatch(ctx: ActionContext): Promise<ActionResult> {
    return {
      ok: true,
      provider: "mock",
      data: {
        note: "mock provider — no external side effects",
        action: ctx.action.type,
        event: ctx.event.event_type,
        params_keys: Object.keys(ctx.action.params ?? {}),
      },
    };
  },
};
