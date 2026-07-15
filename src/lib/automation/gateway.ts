/**
 * Communication Gateway
 * ---------------------
 * Single point of routing between the Automation Engine and provider adapters.
 * Business modules and the automation engine only ever call the gateway —
 * they do NOT reference BotBiz / Meta / Twilio directly.
 *
 * Responsibilities:
 *   - Resolve the currently Active provider + account for a channel
 *     (whatsapp | email | sms | push | webhook) from
 *     `platform_comm_active` (Platform-Admin-controlled).
 *   - Dispatch to the resolved adapter via the existing ActionProvider registry.
 *   - Own retry/fallback/health/logging concerns (scaffolded here; individual
 *     concerns already live in the engine and are consolidated here so future
 *     enhancements — priority routing, cost routing, provider failover —
 *     require no changes to business code).
 *
 * Server-only. Never import into client bundles.
 */
import type { ActionContext, ActionResult, ActionType } from "./types";
import { resolveProvider } from "./providers";

export type CommChannel = "whatsapp" | "email" | "sms" | "push" | "webhook";

export interface ActiveProviderResolution {
  channel: CommChannel;
  providerId: string | null;
  adapterKey: string | null;
  accountId: string | null;
  accountLabel: string | null;
  ready: boolean;
}

/** Map an ActionType to its communication channel. */
export function channelForAction(type: ActionType): CommChannel | null {
  if (type === "notification.whatsapp") return "whatsapp";
  if (type === "notification.push") return "push";
  if (type === "notification.sms") return "sms";
  if (type === "notification.email") return "email";
  if (type === "webhook.call") return "webhook";
  // notification.create is in-app only — no external channel
  return null;
}

/**
 * Look up the Active provider/account for a channel. Returns a resolution
 * even when no active row is configured — the caller can then decide to
 * fall back to the mock/default adapter.
 */
export async function resolveActiveProvider(
  channel: CommChannel,
): Promise<ActiveProviderResolution> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: active } = await supabaseAdmin
      .from("platform_comm_active")
      .select("provider_id, account_id")
      .eq("channel", channel)
      .maybeSingle();

    const providerId = (active as { provider_id?: string | null } | null)?.provider_id ?? null;
    const accountId = (active as { account_id?: string | null } | null)?.account_id ?? null;

    let adapterKey: string | null = null;
    let ready = false;
    if (providerId) {
      const { data: prov } = await supabaseAdmin
        .from("platform_comm_providers")
        .select("adapter_key, ready, enabled")
        .eq("id", providerId)
        .maybeSingle();
      const p = prov as { adapter_key?: string; ready?: boolean; enabled?: boolean } | null;
      adapterKey = p?.adapter_key ?? null;
      ready = Boolean(p?.ready && p?.enabled);
    }

    let accountLabel: string | null = null;
    if (accountId) {
      const { data: acct } = await supabaseAdmin
        .from("platform_comm_accounts")
        .select("label")
        .eq("id", accountId)
        .maybeSingle();
      accountLabel = (acct as { label?: string } | null)?.label ?? null;
    }

    return { channel, providerId, adapterKey, accountId, accountLabel, ready };
  } catch {
    return {
      channel,
      providerId: null,
      adapterKey: null,
      accountId: null,
      accountLabel: null,
      ready: false,
    };
  }
}

/**
 * Channel Layer — the Automation Engine only speaks channels
 * (whatsapp | email | sms | push | webhook). Providers, accounts, and
 * adapters live entirely below this line and are resolved by the gateway.
 */
export interface ChannelResolution extends ActiveProviderResolution {
  requestId: string;
  primary: ActiveProviderResolution;
  secondaries: ActiveProviderResolution[];
}

function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolve a channel end-to-end: primary provider + prepared secondaries
 * ordered by priority. Failover is NOT executed yet — the secondaries are
 * exposed so future code can consume them without another architecture pass.
 */
export async function resolveChannel(channel: CommChannel): Promise<ChannelResolution> {
  const primary = await resolveActiveProvider(channel);
  const secondaries: ActiveProviderResolution[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_comm_providers")
      .select("id, adapter_key, ready, enabled, priority")
      .eq("channel", channel)
      .eq("enabled", true)
      .order("priority");
    for (const row of (data ?? []) as Array<{
      id: string;
      adapter_key: string;
      ready: boolean;
      priority: number;
    }>) {
      if (row.id === primary.providerId) continue;
      secondaries.push({
        channel,
        providerId: row.id,
        adapterKey: row.adapter_key,
        accountId: null,
        accountLabel: null,
        ready: row.ready,
      });
    }
  } catch {
    /* no-op */
  }
  return { ...primary, requestId: newRequestId(), primary, secondaries };
}

/**
 * Dispatch an action through the gateway. The active provider for the
 * channel wins; if none is configured, the ActionProvider registry falls
 * back to sensible defaults (mock / notification-log).
 *
 * Returned result includes the requestId for end-to-end observability.
 */
export async function dispatchThroughGateway(
  ctx: ActionContext,
): Promise<ActionResult & { requestId: string }> {
  const channel = channelForAction(ctx.action.type);
  const requestId = newRequestId();
  let adapterOverride: string | undefined;
  if (channel) {
    const active = await resolveActiveProvider(channel);
    if (active.adapterKey && active.ready) {
      adapterOverride = `${channel}.${active.adapterKey}`;
    }
  }
  const provider = resolveProvider(ctx.action.type, adapterOverride ?? ctx.action.provider);
  const result = await provider.dispatch(ctx);
  return { ...result, requestId };
}

