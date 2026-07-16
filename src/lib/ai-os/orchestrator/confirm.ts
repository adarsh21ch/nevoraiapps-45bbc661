/**
 * Confirmation lifecycle helpers.
 *
 * A queued action starts as `pending_confirmation`. The UI calls
 * `approveAction()` on user consent, then re-runs the agent with
 * `approvedActionIds: [id]` — the orchestrator picks it up and executes.
 */

import { getRuntime } from "./runtime";
import { emitAIEvent, makeEvent } from "../events/bus";

export async function approveAction(actionId: string): Promise<boolean> {
  const { queue } = getRuntime();
  const cur = await queue.get(actionId);
  if (!cur) return false;
  const updated = await queue.updateStatus(actionId, "approved");
  if (!updated) return false;
  await emitAIEvent(
    makeEvent(
      "ai.confirmation_completed",
      {
        tenantId: cur.tenantId,
        userId: cur.userId,
        agentId: cur.agentId,
        conversationId: cur.conversationId,
      },
      { actionId, approved: true },
    ),
  );
  return true;
}

export async function rejectAction(actionId: string): Promise<boolean> {
  const { queue } = getRuntime();
  const cur = await queue.get(actionId);
  if (!cur) return false;
  const updated = await queue.updateStatus(actionId, "rejected");
  if (!updated) return false;
  await emitAIEvent(
    makeEvent(
      "ai.confirmation_completed",
      {
        tenantId: cur.tenantId,
        userId: cur.userId,
        agentId: cur.agentId,
        conversationId: cur.conversationId,
      },
      { actionId, approved: false },
    ),
  );
  return true;
}
