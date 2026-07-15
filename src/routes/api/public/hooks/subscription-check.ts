/**
 * Daily subscription expiry cron.
 *
 * POST /api/public/hooks/subscription-check
 *
 * Scans every tenant and publishes lifecycle automation events:
 *  - trial_expiring   → trial ends in ≤ 3 days
 *  - expired          → trial_ends_at or current_period_end already past and
 *                       tenant not yet in grace
 *  - grace_period     → within 7-day grace window
 *
 * Reuses the existing Automation Engine to route notifications to owners
 * and platform admins. Idempotent — publishes are cheap and downstream
 * rules dedupe.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AUTOMATION_EVENTS } from "@/lib/automation/types";

export const Route = createFileRoute("/api/public/hooks/subscription-check")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = Date.now();
        const DAY = 86400_000;

        const { data: tenants, error } = await supabaseAdmin
          .from("tenants")
          .select(
            "id, plan_tier, subscription_status, trial_ends_at, current_period_end, grace_ends_at, status",
          );
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const events: Array<{
          tenant_id: string;
          event_type: string;
          source_module: string;
          source_id: string;
          payload: Record<string, unknown>;
        }> = [];

        for (const t of tenants ?? []) {
          const trialEnd = t.trial_ends_at ? new Date(t.trial_ends_at).getTime() : null;
          const periodEnd = t.current_period_end ? new Date(t.current_period_end).getTime() : null;
          const graceEnd = t.grace_ends_at ? new Date(t.grace_ends_at).getTime() : null;

          // Trial expiring (≤ 3 days remaining)
          if (trialEnd && trialEnd > now && trialEnd - now <= 3 * DAY) {
            events.push({
              tenant_id: t.id,
              event_type: AUTOMATION_EVENTS.SubscriptionTrialExpiring,
              source_module: "subscription",
              source_id: t.id,
              payload: {
                trialEndsAt: t.trial_ends_at,
                daysRemaining: Math.ceil((trialEnd - now) / DAY),
              },
            });
          }

          // Expired (trial or period ended, no active grace)
          const anchor = periodEnd ?? trialEnd;
          if (anchor && anchor < now && (!graceEnd || graceEnd < now)) {
            events.push({
              tenant_id: t.id,
              event_type: AUTOMATION_EVENTS.SubscriptionExpired,
              source_module: "subscription",
              source_id: t.id,
              payload: { expiredAt: new Date(anchor).toISOString() },
            });
          }

          // Grace period window active
          if (graceEnd && graceEnd > now && anchor && anchor < now) {
            events.push({
              tenant_id: t.id,
              event_type: AUTOMATION_EVENTS.SubscriptionGracePeriod,
              source_module: "subscription",
              source_id: t.id,
              payload: {
                graceEndsAt: t.grace_ends_at,
                daysRemaining: Math.ceil((graceEnd - now) / DAY),
              },
            });
          }
        }

        if (events.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabaseAdmin.from("automation_events").insert(
            events.map((e) => ({ ...e, payload: e.payload as never, status: "pending" })) as any,
          );
        }

        return Response.json({ ok: true, scanned: tenants?.length ?? 0, emitted: events.length });
      },
    },
  },
});
