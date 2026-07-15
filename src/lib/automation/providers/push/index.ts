/**
 * Push ActionProvider — dispatches `notification.push` actions through the
 * Communication Gateway. Resolves recipient user IDs → live push tokens from
 * push_devices, hands them to the active adapter, and writes one
 * `automation_deliveries` row per token so the existing history / retry
 * engine works with zero changes.
 *
 * Server-only.
 */

import type { ActionContext, ActionResult } from "../../types";
import type { ActionProvider } from "../index";
import type {
  PushMessage,
  PushRecipient,
  PushSendItemResult,
} from "./types";
import { DEFAULT_PUSH_ADAPTER, getPushAdapter } from "./registry";
import { renderPushTemplate, type TemplateVars } from "./templates";

interface PushActionParams {
  /** Explicit recipient user IDs. */
  recipient_user_ids?: string[];
  /** Broadcast targets — resolved server-side to user ids for the tenant. */
  target_roles?: Array<"parent" | "owner" | "coach" | "staff">;
  /** Convenience: derive parent user id from student. */
  student_id?: string;
  /** Explicit message override. If not present the template for event type is used. */
  title?: string;
  body?: string;
  subtitle?: string;
  deep_link?: string;
  category?: string;
  priority?: "default" | "normal" | "high";
  data?: Record<string, unknown>;
  /** Adapter override (e.g. "mock"). */
  adapter?: string;
  /** Vars appended to template variables. */
  vars?: Partial<TemplateVars>;
}

interface StudentLite {
  id: string;
  name: string;
  tenant_id: string;
  batch_id: string | null;
  coach_name: string | null;
  parent_user_id: string | null;
}

async function resolveStudentParentUser(
  studentId: string,
  tenantId: string,
): Promise<{ student: StudentLite | null; parentUserIds: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("students")
    .select("id, name, tenant_id, batch_id, coach_name, user_id")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const s = data as
    | {
        id: string;
        name: string;
        tenant_id: string;
        batch_id: string | null;
        coach_name: string | null;
        user_id?: string | null;
      }
    | null;
  if (!s) return { student: null, parentUserIds: [] };

  const parentIds = new Set<string>();
  if (s.user_id) parentIds.add(s.user_id);

  const { data: links } = await supabaseAdmin
    .from("mc_parent_links")
    .select("parent_user_id")
    .eq("student_id", studentId);
  for (const row of (links ?? []) as Array<{ parent_user_id: string | null }>) {
    if (row.parent_user_id) parentIds.add(row.parent_user_id);
  }

  return {
    student: {
      id: s.id,
      name: s.name,
      tenant_id: s.tenant_id,
      batch_id: s.batch_id,
      coach_name: s.coach_name,
      parent_user_id: s.user_id ?? null,
    },
    parentUserIds: Array.from(parentIds),
  };
}

type AppRole = "owner" | "admin" | "platform_admin" | "student";

async function resolveRoleUsers(
  tenantId: string,
  roles: Array<"parent" | "owner" | "coach" | "staff">,
): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = new Set<string>();

  // Map high-level target roles to the actual app_role enum + auxiliary queries.
  const appRoles: AppRole[] = [];
  for (const r of roles) {
    if (r === "owner" || r === "staff" || r === "coach") {
      // Owners/staff/coach all fall under the tenant `owner`/`admin` roles today.
      if (!appRoles.includes("owner")) appRoles.push("owner");
      if (!appRoles.includes("admin")) appRoles.push("admin");
    }
    // "parent" is resolved through students.parent_user_id — handled below.
  }

  if (appRoles.length > 0) {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .in("role", appRoles);
    for (const row of (data ?? []) as Array<{ user_id: string | null }>) {
      if (row.user_id) ids.add(row.user_id);
    }
  }

  if (roles.includes("parent")) {
    const { data: studentUsers } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .not("user_id", "is", null);
    for (const row of (studentUsers ?? []) as Array<{ user_id: string | null }>) {
      if (row.user_id) ids.add(row.user_id);
    }
    const { data: links } = await supabaseAdmin
      .from("mc_parent_links")
      .select("parent_user_id")
      .not("parent_user_id", "is", null);
    for (const row of (links ?? []) as Array<{ parent_user_id: string | null }>) {
      if (row.parent_user_id) ids.add(row.parent_user_id);
    }
  }

  return Array.from(ids);
}

async function loadTokens(userIds: string[]): Promise<PushRecipient[]> {
  if (userIds.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("push_devices")
    .select("user_id, device_id, expo_push_token, platform, enabled")
    .in("user_id", userIds)
    .eq("enabled", true);
  return ((data ?? []) as Array<{
    user_id: string;
    device_id: string;
    expo_push_token: string;
    platform: "ios" | "android" | "web";
  }>).map((r) => ({
    userId: r.user_id,
    deviceId: r.device_id,
    token: r.expo_push_token,
    platform: r.platform,
  }));
}

async function resolveAdapterKey(): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_comm_active")
      .select("provider_id")
      .eq("channel", "push")
      .maybeSingle();
    const providerId = (data as { provider_id?: string | null } | null)?.provider_id ?? null;
    if (!providerId) return DEFAULT_PUSH_ADAPTER;
    const { data: prov } = await supabaseAdmin
      .from("platform_comm_providers")
      .select("adapter_key, ready, enabled")
      .eq("id", providerId)
      .maybeSingle();
    const p = prov as { adapter_key?: string; ready?: boolean; enabled?: boolean } | null;
    if (!p || !p.ready || !p.enabled) return DEFAULT_PUSH_ADAPTER;
    return p.adapter_key ?? DEFAULT_PUSH_ADAPTER;
  } catch {
    return DEFAULT_PUSH_ADAPTER;
  }
}

export const pushProvider: ActionProvider = {
  key: "push",
  handles: ["notification.push"],
  async dispatch(ctx: ActionContext): Promise<ActionResult> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const params = (ctx.action.params ?? {}) as PushActionParams;

    // -- 1. Resolve recipient user IDs -----------------------------------
    const recipientUserIds = new Set<string>(params.recipient_user_ids ?? []);
    const studentId =
      params.student_id ?? (ctx.event.payload?.student_id as string | undefined);

    let studentName: string | null = null;
    let batchName: string | null = null;
    let coachName: string | null = null;

    if (studentId) {
      const { student, parentUserIds } = await resolveStudentParentUser(studentId, ctx.tenantId);
      if (student) {
        studentName = student.name;
        coachName = student.coach_name;
        if (student.batch_id) {
          const { data: batch } = await supabaseAdmin
            .from("batches")
            .select("name")
            .eq("id", student.batch_id)
            .maybeSingle();
          batchName = (batch as { name?: string } | null)?.name ?? null;
        }
      }
      for (const uid of parentUserIds) recipientUserIds.add(uid);
    }

    if (params.target_roles && params.target_roles.length > 0) {
      const roleUsers = await resolveRoleUsers(ctx.tenantId, params.target_roles);
      for (const uid of roleUsers) recipientUserIds.add(uid);
    }

    // -- 2. Load academy name for template -------------------------------
    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", ctx.tenantId)
      .maybeSingle();
    const academyName = (tenantRow as { name?: string } | null)?.name ?? "Your Academy";

    // -- 3. Build the message from templates -----------------------------
    const now = new Date();
    const vars: TemplateVars = {
      ParentName: "Parent",
      StudentName: studentName ?? "Your child",
      AcademyName: academyName,
      BatchName: batchName ?? "Batch",
      CoachName: coachName ?? "Coach",
      Time: now.toLocaleTimeString(),
      Date: now.toLocaleDateString(),
      ...(params.vars ?? {}),
      ...((ctx.event.payload as Partial<TemplateVars>) ?? {}),
    };

    const message: PushMessage = renderPushTemplate(ctx.event.event_type, vars, {
      ...(params.title ? { title: params.title } : {}),
      ...(params.body ? { body: params.body } : {}),
      ...(params.subtitle ? { subtitle: params.subtitle } : {}),
      ...(params.deep_link ? { deepLink: params.deep_link } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.data
        ? { data: { ...params.data, student_id: studentId ?? null, event_id: ctx.event.id } }
        : { data: { student_id: studentId ?? null, event_id: ctx.event.id } }),
    });

    // -- 4. Resolve adapter + tokens -------------------------------------
    const adapterKey = params.adapter ?? (await resolveAdapterKey());
    const adapter = getPushAdapter(adapterKey);

    const userIds = Array.from(recipientUserIds);
    if (userIds.length === 0) {
      return {
        ok: false,
        provider: "push",
        error: "No recipients resolved for push action",
        retryable: false,
      };
    }

    // Always write one in-app notification per recipient — the OS delivery is
    // best-effort; the in-app center is the source of truth.
    for (const uid of userIds) {
      await supabaseAdmin.from("notifications").insert({
        tenant_id: ctx.tenantId,
        recipient_user_id: uid,
        category: message.category ?? "general",
        type: ctx.event.event_type,
        title: message.title,
        body: message.body,
        subtitle: message.subtitle ?? null,
        priority: message.priority ?? "high",
        deep_link: message.deepLink ?? null,
        payload: {
          ...(message.data ?? {}),
          event_id: ctx.event.id,
          rule_id: ctx.rule?.id ?? null,
        },
      } as never);
    }

    const recipients = await loadTokens(userIds);
    if (recipients.length === 0) {
      // No devices registered — record deliveries as "queued" so the UI shows the intent,
      // but return ok=true since the in-app notification landed.
      await supabaseAdmin.from("automation_deliveries").insert({
        tenant_id: ctx.tenantId,
        rule_id: ctx.rule?.id ?? null,
        event_id: ctx.event.id,
        student_id: studentId ?? null,
        channel: "push",
        provider: "push",
        adapter: adapterKey,
        recipient_name: null,
        recipient_number: null,
        message: `${message.title} — ${message.body}`,
        status: "queued",
        attempts: ctx.attempt,
        error: `No push devices registered for ${userIds.length} recipient(s)`,
      } as never);
      return {
        ok: true,
        provider: `push.${adapterKey}`,
        data: {
          adapter: adapterKey,
          recipients: 0,
          in_app_written: userIds.length,
          preview: `${message.title} — ${message.body}`.slice(0, 200),
        },
        retryable: false,
      };
    }

    if (!adapter) {
      return {
        ok: false,
        provider: "push",
        error: `Unknown push adapter: ${adapterKey}`,
        retryable: false,
      };
    }

    // -- 5. Insert queued delivery rows ----------------------------------
    const deliveryRows = await supabaseAdmin
      .from("automation_deliveries")
      .insert(
        recipients.map((r) => ({
          tenant_id: ctx.tenantId,
          rule_id: ctx.rule?.id ?? null,
          event_id: ctx.event.id,
          student_id: studentId ?? null,
          channel: "push",
          provider: "push",
          adapter: adapterKey,
          recipient_name: null,
          recipient_number: r.token.slice(0, 32),
          message: `${message.title} — ${message.body}`,
          status: "sending",
          attempts: ctx.attempt,
        })) as never,
      )
      .select("id, recipient_number");

    const deliveryByToken = new Map<string, string>();
    for (const row of ((deliveryRows.data ?? []) as Array<{ id: string; recipient_number: string }>)) {
      deliveryByToken.set(row.recipient_number, row.id);
    }

    // -- 6. Dispatch -----------------------------------------------------
    const start = Date.now();
    const result = await adapter.send(recipients, message);
    const durationMs = Date.now() - start;
    const nowIso = new Date().toISOString();

    // -- 7. Update deliveries + disable bad tokens -----------------------
    const disableTokens: string[] = [];
    for (const item of result.items) {
      const deliveryId = deliveryByToken.get(item.token.slice(0, 32));
      if (deliveryId) {
        await supabaseAdmin
          .from("automation_deliveries")
          .update({
            status: item.status,
            duration_ms: durationMs,
            provider_message_id: item.providerMessageId ?? null,
            error: item.error ?? null,
            sent_at: item.ok ? nowIso : null,
            delivered_at: item.status === "delivered" ? nowIso : null,
          } as never)
          .eq("id", deliveryId);
      }
      if (item.disableToken) disableTokens.push(item.token);
    }
    if (disableTokens.length > 0) {
      await supabaseAdmin
        .from("push_devices")
        .update({
          enabled: false,
          disabled_reason: "DeviceNotRegistered (auto-disabled by Expo)",
        } as never)
        .in("expo_push_token", disableTokens);
    }

    const okAll = result.items.every((i: PushSendItemResult) => i.ok);
    const anyRetryable = result.items.some((i) => !i.ok && i.retryable);

    return {
      ok: okAll,
      provider: `push.${adapterKey}`,
      data: {
        adapter: adapterKey,
        recipients: recipients.length,
        in_app_written: userIds.length,
        succeeded: result.items.filter((i) => i.ok).length,
        failed: result.items.filter((i) => !i.ok).length,
        disabled_tokens: disableTokens.length,
        preview: `${message.title} — ${message.body}`.slice(0, 200),
      },
      error: okAll ? undefined : result.items.find((i) => !i.ok)?.error ?? "Push delivery failed",
      retryable: !okAll && anyRetryable,
    };
  },
};
