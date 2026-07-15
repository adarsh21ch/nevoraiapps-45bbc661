/**
 * PushService — business-facing façade.
 *
 * Business modules NEVER call Expo or the push provider directly. They call:
 *
 *   await PushService.sendToUser(userId, message)
 *   await PushService.sendToTenant(tenantId, message, { roles: ["parent"] })
 *
 * which internally emits a `notification.push` action through the Automation
 * Engine + Communication Gateway. Delivery logs, retries, and history are
 * handled by the existing engine — this file only sugar-coats the call site.
 *
 * Server-only.
 */

import { emitAutomationEvent } from "./event-bus.functions";
import type { PushMessage } from "./providers/push/types";

export interface SendPushOptions {
  tenantId: string;
  eventType?: string;
  studentId?: string | null;
  /** Extra payload merged into the event. */
  payload?: Record<string, unknown>;
}

async function emitPushEvent(
  opts: SendPushOptions,
  params: Record<string, unknown>,
): Promise<void> {
  await emitAutomationEvent({
    data: {
      tenantId: opts.tenantId,
      eventType: opts.eventType ?? "push.direct",
      sourceModule: "push_service",
      sourceId: opts.studentId ?? null,
      payload: {
        ...(opts.payload ?? {}),
        __push_action: {
          type: "notification.push",
          params,
        },
      },
    },
  });
}

/** Send push to explicit user ids. Writes in-app notification + delivery logs. */
export async function sendToUsers(
  userIds: string[],
  message: PushMessage,
  opts: SendPushOptions,
): Promise<void> {
  await emitPushEvent(opts, {
    recipient_user_ids: userIds,
    title: message.title,
    body: message.body,
    subtitle: message.subtitle,
    deep_link: message.deepLink,
    category: message.category,
    priority: message.priority,
    data: message.data,
    student_id: opts.studentId,
  });
}

/** Send push to a single user. */
export async function sendToUser(
  userId: string,
  message: PushMessage,
  opts: SendPushOptions,
): Promise<void> {
  await sendToUsers([userId], message, opts);
}

/** Broadcast to every user in the tenant with one of the given roles. */
export async function sendToRole(
  role: "parent" | "owner" | "coach" | "staff",
  message: PushMessage,
  opts: SendPushOptions,
): Promise<void> {
  await emitPushEvent(opts, {
    target_roles: [role],
    title: message.title,
    body: message.body,
    subtitle: message.subtitle,
    deep_link: message.deepLink,
    category: message.category,
    priority: message.priority,
    data: message.data,
  });
}

/** Broadcast to multiple roles at once. */
export async function sendToRoles(
  roles: Array<"parent" | "owner" | "coach" | "staff">,
  message: PushMessage,
  opts: SendPushOptions,
): Promise<void> {
  await emitPushEvent(opts, {
    target_roles: roles,
    title: message.title,
    body: message.body,
    subtitle: message.subtitle,
    deep_link: message.deepLink,
    category: message.category,
    priority: message.priority,
    data: message.data,
  });
}

export const PushService = {
  sendToUser,
  sendToUsers,
  sendToRole,
  sendToRoles,
};

export type { PushMessage };
