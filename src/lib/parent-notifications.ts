/* ================================================================
 * Parent Portal notification hooks (architecture only).
 * ----------------------------------------------------------------
 * A tiny synchronous event bus that the Progress Report and other
 * parent-portal surfaces can `emit` into. Nothing consumes the bus
 * yet — this file exists so future push / in-app / e-mail delivery
 * can subscribe without touching parent-portal components.
 *
 * Do NOT wire push notifications here. Consumers register handlers
 * from their own module (e.g. a service worker bridge, a toast
 * bridge, or an outbound Supabase edge webhook).
 * ================================================================ */

export type ParentNotificationType =
  | "attendance_marked_today"
  | "absent_today"
  | "monthly_report_ready"
  | "achievement_unlocked"
  | "coach_remark_added";

export type ParentNotificationEvent = {
  type: ParentNotificationType;
  studentId: string;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
  at: string; // ISO
};

type Handler = (e: ParentNotificationEvent) => void;

const handlers = new Set<Handler>();

export function onParentNotification(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emitParentNotification(
  e: Omit<ParentNotificationEvent, "at"> & { at?: string },
): void {
  const evt: ParentNotificationEvent = { ...e, at: e.at ?? new Date().toISOString() };
  for (const h of handlers) {
    try {
      h(evt);
    } catch {
      // Handlers are best-effort; never let one break others.
    }
  }
}
