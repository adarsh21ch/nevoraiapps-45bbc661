/**
 * UpgradeCard — shown when a feature isn't available on the current plan.
 * Never renders an error; it turns the empty state into a sales opportunity.
 */
import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ds/Card";
import { PLAN_META, type FeatureId, type PlanTier } from "@/lib/payments/plans";
import { FEATURES } from "@/lib/payments/plans";

export function UpgradeCard({
  feature,
  currentPlan,
  requiredPlan,
  title,
}: {
  feature?: FeatureId;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  title?: string;
}) {
  const featureName = feature ? FEATURES[feature].name : "This feature";
  const req = PLAN_META[requiredPlan];
  const cur = PLAN_META[currentPlan];

  return (
    <Card className="p-6 border-2 border-dashed">
      <div className="flex items-start gap-3">
        <div
          className="size-11 rounded-xl grid place-items-center shrink-0"
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
            color: "var(--brand)",
          }}
        >
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Lock className="size-3" /> {cur.name} plan
          </div>
          <h2 className="mt-1 text-lg font-semibold">{title ?? `${featureName} is on ${req.name}`}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade to {req.name} to unlock {featureName.toLowerCase()} and everything below.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {req.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <Link
              to="/dashboard/subscription"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Upgrade to {req.name} <ArrowRight className="size-4" />
            </Link>
            <span className="text-xs text-muted-foreground">
              ₹{req.monthlyPrice.toLocaleString("en-IN")}/mo
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
