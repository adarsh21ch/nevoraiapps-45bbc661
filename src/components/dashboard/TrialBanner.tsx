import { Link } from "@tanstack/react-router";
import { AlertCircle, Sparkles } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";

/**
 * Shows a subscription state banner on the dashboard:
 * - trial: countdown + upgrade CTA
 * - suspended / past_due: hard warning
 * - active/paid: renders nothing
 *
 * Uses `tenant.subscription_status` (existing column). No schema change.
 */
export function TrialBanner() {
  const { tenant, profile } = useDashboard();
  const status = (tenant.subscription_status ?? "").toLowerCase();
  const owner = isOwner(profile);

  if (!status || status === "paid" || status === "active") return null;

  if (status === "suspended" || status === "past_due") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
        <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-destructive">
            {status === "suspended" ? "Academy suspended" : "Payment overdue"}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {status === "suspended"
              ? "Reach out to platform support to reactivate."
              : "Please clear the outstanding balance to keep your academy running."}
          </p>
        </div>
        {owner && (
          <Link
            to="/dashboard/subscription"
            className="text-sm font-medium text-destructive hover:underline shrink-0 self-center"
          >
            Resolve →
          </Link>
        )}
      </div>
    );
  }

  if (status === "trial" || status === "trialing") {
    return (
      <div
        className="rounded-xl border p-4 flex items-start gap-3"
        style={{
          borderColor: "color-mix(in oklab, var(--brand) 30%, transparent)",
          background: "color-mix(in oklab, var(--brand) 6%, transparent)",
        }}
      >
        <Sparkles className="size-5 shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
        <div className="flex-1 text-sm">
          <p className="font-medium">You're on a free trial</p>
          <p className="text-muted-foreground mt-0.5">
            All features unlocked. Add a plan before your trial ends to keep everything running.
          </p>
        </div>
        {owner && (
          <Link
            to="/dashboard/subscription"
            className="text-sm font-medium shrink-0 self-center hover:underline"
            style={{ color: "var(--brand)" }}
          >
            Upgrade →
          </Link>
        )}
      </div>
    );
  }

  return null;
}
