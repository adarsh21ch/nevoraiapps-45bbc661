/**
 * LimitReachedCard — shown at creation surfaces when a tenant hits its plan
 * limit. Extends the UpgradeCard visual with current usage + max, so owners
 * see exactly why the action was blocked and how to unblock it.
 */
import { Link } from "@tanstack/react-router";
import { Gauge, ArrowRight } from "lucide-react";
import { Card } from "@/components/ds/Card";
import { PLAN_META, nextPlan, type LimitId, type PlanTier } from "@/lib/payments/plans";

const METER_LABEL: Record<string, string> = {
  students: "Students",
  coaches: "Coaches",
  staff: "Staff",
  parents: "Parents",
  matches: "Matches",
  tournaments: "Tournaments",
  automation_rules: "Automation rules",
  campaigns: "Campaigns",
  website_pages: "Website pages",
  media_uploads: "Media uploads",
  storage_mb: "Storage (MB)",
  ai_credits: "AI credits",
  push_notifications: "Push notifications",
  api_calls: "API calls",
};

export function LimitReachedCard({
  meter,
  used,
  max,
  currentPlan,
}: {
  meter: LimitId | string;
  used: number;
  max: number | null;
  currentPlan: PlanTier;
}) {
  const required = nextPlan(currentPlan) ?? "enterprise";
  const req = PLAN_META[required];
  const cur = PLAN_META[currentPlan];
  const label = METER_LABEL[meter] ?? meter;
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 100;

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
          <Gauge className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {cur.name} plan limit reached
          </div>
          <h2 className="mt-1 text-lg font-semibold">
            {label}: {used}
            {max !== null ? ` / ${max}` : ""}
          </h2>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: "var(--brand)" }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Upgrade to {req.name} to raise this limit and unlock everything below.
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
