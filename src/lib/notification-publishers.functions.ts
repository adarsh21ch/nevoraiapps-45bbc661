/**
 * Server-side notification publishers (Phase 03.1).
 *
 * Thin wrappers around the `publish_notification` RPC. Every module that owns
 * writes (billing, registration, match finalization, attendance) can call
 * these from an existing `createServerFn` handler as a side effect.
 *
 * This file is a *.functions.ts module — safe to import from client code,
 * but the handler bodies only run on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  NotificationCategory,
  NotificationPriority,
} from "@/lib/notifications";

export type PublishInput = {
  recipient_user_id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string | null;
  deep_link?: string | null;
  priority?: NotificationPriority;
  payload?: Record<string, unknown>;
  tenant_id?: string | null;
  dedupe_key?: string | null;
  expires_at?: string | null;
  channels?: Array<"in_app" | "push" | "email" | "whatsapp">;
};

/**
 * Server-only publish helper. Call from inside another server function
 * handler (attendance check-in, invoice issue, registration approval, etc.).
 * Uses the caller's supabase client, so authorization is enforced by the RPC.
 */
export async function publishNotificationForCaller(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  input: PublishInput,
): Promise<string | null> {
  const { data, error } = await (supabase.rpc as unknown as (...a: unknown[])=>Promise<{data:unknown;error:unknown}>)("publish_notification", {
    _recipient_user_id: input.recipient_user_id,
    _category: input.category,
    _type: input.type,
    _title: input.title,
    _body: input.body ?? null,
    _deep_link: input.deep_link ?? null,
    _priority: input.priority ?? "normal",
    _payload: input.payload ?? {},
    _tenant_id: input.tenant_id ?? null,
    _dedupe_key: input.dedupe_key ?? null,
    _expires_at: input.expires_at ?? null,
    _channels: input.channels ?? ["in_app"],
  });
  if (error) {
    console.error("publish_notification failed", error);
    return null;
  }
  return (data as string) ?? null;
}

/**
 * Public server function — allows an authenticated user to publish a
 * notification (subject to RPC authorization: self, same-tenant member, or
 * platform admin). Primary use case is "notify self" / "notify child" flows;
 * module-owned publishes should use `publishNotificationForCaller` from
 * inside their own server functions instead of round-tripping through this.
 */
export const publishNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PublishInput) => data)
  .handler(async ({ data, context }) =>
    publishNotificationForCaller(context.supabase, data),
  );
