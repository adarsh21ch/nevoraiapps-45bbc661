/**
 * Client-side emit helper — fire-and-forget wrapper around the
 * `emitAutomationEvent` server function.
 *
 * Business modules import `emitEvent(...)` and call it after a successful
 * mutation. The helper NEVER throws and NEVER blocks the caller — automation
 * failures must not roll back domain writes.
 *
 * All heavy work (rule matching, action dispatch, retries) happens in the
 * queue worker; this call is a single INSERT into `automation_events`.
 */

import { emitAutomationEvent } from "./event-bus.functions";
import type { AutomationEventType, EventPayload } from "./types";

export interface EmitInput {
  tenantId: string;
  eventType: AutomationEventType;
  sourceModule?: string | null;
  sourceId?: string | null;
  payload?: EventPayload;
}

/**
 * Fire-and-forget event emit. Errors are swallowed with a console warning —
 * automation must never break the business workflow that produced the event.
 */
export function emitEvent(input: EmitInput): void {
  try {
    void emitAutomationEvent({
      data: {
        tenantId: input.tenantId,
        eventType: input.eventType,
        sourceModule: input.sourceModule ?? null,
        sourceId: input.sourceId ?? null,
        payload: (input.payload ?? {}) as Record<string, unknown>,
      },
    }).catch((err: unknown) => {
      // Log only — never surface to the user or interrupt the workflow.
      // eslint-disable-next-line no-console
      console.warn("[automation] emit failed", input.eventType, err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[automation] emit threw", input.eventType, err);
  }
}
