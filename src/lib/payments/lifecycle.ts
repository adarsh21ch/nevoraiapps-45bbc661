/**
 * Subscription lifecycle event emission (Phase 10.1).
 *
 * Thin wrapper around the automation event bus so subscription mutations
 * (setPlanTier / grantTrial / suspend / resume / extend) publish canonical
 * lifecycle events that existing Automation Engine rules can react to.
 */
import { emitEvent } from "@/lib/automation/emit-client";
import { AUTOMATION_EVENTS } from "@/lib/automation/types";
import type { PlanTier } from "./plans";

export function emitSubscriptionEvent(
  eventType: (typeof AUTOMATION_EVENTS)[keyof typeof AUTOMATION_EVENTS],
  input: {
    tenantId: string;
    from?: PlanTier | null;
    to?: PlanTier | null;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
    meter?: string;
    used?: number;
    max?: number | null;
  },
): void {
  emitEvent({
    tenantId: input.tenantId,
    eventType,
    sourceModule: "subscription",
    sourceId: input.tenantId,
    payload: { ...input },
  });
}

export const SUBSCRIPTION_EVENTS = {
  TrialStarted: AUTOMATION_EVENTS.SubscriptionTrialStarted,
  TrialExpiring: AUTOMATION_EVENTS.SubscriptionTrialExpiring,
  Expired: AUTOMATION_EVENTS.SubscriptionExpired,
  Renewed: AUTOMATION_EVENTS.SubscriptionRenewed,
  Upgraded: AUTOMATION_EVENTS.SubscriptionUpgraded,
  Downgraded: AUTOMATION_EVENTS.SubscriptionDowngraded,
  Suspended: AUTOMATION_EVENTS.SubscriptionSuspended,
  Resumed: AUTOMATION_EVENTS.SubscriptionResumed,
  GracePeriod: AUTOMATION_EVENTS.SubscriptionGracePeriod,
  LimitReached: AUTOMATION_EVENTS.FeatureLimitReached,
} as const;
