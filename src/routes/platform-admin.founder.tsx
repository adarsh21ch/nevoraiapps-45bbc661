import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import {
  fetchIntelligenceSnapshot,
  computeExecutiveKpis,
  computeTenantHealth,
  computeFeatureAdoption,
  computeOnboarding,
  computePlatformAnalytics,
  computeDailyBrief,
  computeFounderAlerts,
  computeTenantTimeline,
  ADOPTION_FEATURES,
  founderKeys,
  type HealthBand,
  type AdoptionLevel,
} from "@/lib/founder-intelligence";
import {
  TrendingUp,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  Wallet,
  Activity,
  Bell,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform-admin/founder")({
  head: () => ({
    meta: [
      { title: "Founder Intelligence · NevorAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FounderPage,
});

type Tab = "overview" | "health" | "adoption" | "onboarding" | "churn" | "analytics" | "alerts";

function FounderPage() {
  const tenantsQ = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const snapshotQ = useQuery({
    queryKey: founderKeys.snapshot,
    queryFn: () => fetchIntelligenceSnapshot(tenantsQ.data ?? []),
    enabled: (tenantsQ.data?.length ?? 0) > 0,
    staleTime: 60_000,
  });

  const kpis = useMemo(() => (snapshotQ.data ? computeExecutiveKpis(snapshotQ.data) : null), [snapshotQ.data]);
  const health = useMemo(() => (snapshotQ.data ? computeTenantHealth(snapshotQ.data) : []), [snapshotQ.data]);
  const adoption = useMemo(() => (snapshotQ.data ? computeFeatureAdoption(snapshotQ.data) : []), [snapshotQ.data]);
  const onboarding = useMemo(() => (snapshotQ.data ? computeOnboarding(snapshotQ.data) : []), [snapshotQ.data]);
  const analytics = useMemo(() => (snapshotQ.data ? computePlatformAnalytics(snapshotQ.data) : null), [snapshotQ.data]);
  const brief = useMemo(
    () => (kpis && analytics ? computeDailyBrief(kpis, health, analytics) : []),
    [kpis, health, analytics],
  );
  const alerts = useMemo(
    () => (snapshotQ.data ? computeFounderAlerts(snapshotQ.data, health) : []),
    [snapshotQ.data, health],
  );

  const [tab, setTab] = useState<Tab>("overview");
  const loading = tenantsQ.isLoading || snapshotQ.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Founder Intelligence
          </h1>
          <p className="text-sm text-neutral-400">
            NevorAI internal OS · health, adoption, churn & revenue signals across every academy.
          </p>
        </div>
        <div className="text-xs text-neutral-500">
          {snapshotQ.data ? `Snapshot: ${new Date(snapshotQ.data.fetched_at).toLocaleString()}` : "Loading…"}
        </div>
      </header>

      <TabsBar tab={tab} onChange={setTab} alertCount={alerts.length} />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-white/5" />
          ))}
        </div>
      ) : tab === "overview" && kpis && analytics ? (
        <OverviewPanel kpis={kpis} analytics={analytics} brief={brief} />
      ) : tab === "health" ? (
        <HealthPanel health={health} />
      ) : tab === "adoption" ? (
        <AdoptionPanel adoption={adoption} />
      ) : tab === "onboarding" ? (
        <OnboardingPanel onboarding={onboarding} />
      ) : tab === "churn" ? (
        <ChurnPanel health={health} />
      ) : tab === "analytics" && analytics ? (
        <AnalyticsPanel analytics={analytics} />
      ) : tab === "alerts" ? (
        <AlertsPanel alerts={alerts} />
      ) : null}

      {tab === "overview" && snapshotQ.data ? (
        <TenantTimelinesPreview snapshot={snapshotQ.data} health={health} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TabsBar({ tab, onChange, alertCount }: { tab: Tab; onChange: (t: Tab) => void; alertCount: number }) {
  const tabs: Array<{ id: Tab; label: string; icon?: React.ReactNode; badge?: number }> = [
    { id: "overview", label: "Overview", icon: <Sparkles className="size-3" /> },
    { id: "health", label: "Health" },
    { id: "adoption", label: "Adoption" },
    { id: "onboarding", label: "Onboarding" },
    { id: "churn", label: "Churn" },
    { id: "analytics", label: "Analytics" },
    { id: "alerts", label: "Alerts", badge: alertCount },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-white/10 pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            tab === t.id ? "bg-white text-neutral-900" : "text-neutral-400 hover:bg-white/5 hover:text-white",
          )}
        >
          {t.icon}
          {t.label}
          {t.badge && t.badge > 0 ? (
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === t.id ? "bg-neutral-900 text-white" : "bg-white/10 text-white",
              )}
            >
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function OverviewPanel({
  kpis,
  analytics,
  brief,
}: {
  kpis: ReturnType<typeof computeExecutiveKpis>;
  analytics: ReturnType<typeof computePlatformAnalytics>;
  brief: ReturnType<typeof computeDailyBrief>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<TrendingUp className="size-4" />} label="MRR" value={`₹${kpis.mrr.toLocaleString("en-IN")}`} sub={`ARR ₹${kpis.arr.toLocaleString("en-IN")}`} />
        <KpiCard icon={<Wallet className="size-4" />} label="Revenue (90d)" value={`₹${kpis.total_revenue_90d.toLocaleString("en-IN")}`} sub={`₹${kpis.received_this_month.toLocaleString("en-IN")} this month`} />
        <KpiCard icon={<TrendingUp className="size-4" />} label="Growth" value={`${kpis.revenue_growth_pct >= 0 ? "+" : ""}${kpis.revenue_growth_pct}%`} sub="Revenue 30d vs prior" tone={kpis.revenue_growth_pct >= 0 ? "positive" : "warning"} />
        <KpiCard icon={<Building2 className="size-4" />} label="Active academies" value={kpis.active_academies} sub={`${kpis.trial_academies} trial · ${kpis.paid_academies} paid`} />
        <KpiCard icon={<Sparkles className="size-4" />} label="New (30d)" value={kpis.new_academies_30d} sub={`${kpis.new_academies_7d} this week`} />
        <KpiCard icon={<AlertTriangle className="size-4" />} label="Cancelled (30d)" value={kpis.cancelled_academies_30d} sub={`${kpis.suspended_academies} suspended`} tone={kpis.cancelled_academies_30d > 0 ? "warning" : undefined} />
        <KpiCard icon={<Bell className="size-4" />} label="Renewals ≤ 7d" value={kpis.renewals_due_7d} sub="Follow up now" />
        <KpiCard icon={<Users className="size-4" />} label="Students (7d)" value={analytics.student_growth_7d} sub={`${analytics.student_growth_30d} in 30d`} />
      </div>

      <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="size-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-300">Daily Founder Brief</h2>
        </div>
        {brief.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing to report today. Everything humming.</p>
        ) : (
          <ul className="space-y-1.5">
            {brief.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-1.5 inline-block size-1.5 rounded-full",
                    b.kind === "positive" && "bg-emerald-400",
                    b.kind === "warning" && "bg-amber-400",
                    b.kind === "critical" && "bg-red-500",
                    b.kind === "neutral" && "bg-sky-400",
                  )}
                />
                <span className={cn(b.kind === "critical" && "text-red-300")}>{b.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function HealthPanel({ health }: { health: ReturnType<typeof computeTenantHealth> }) {
  const sorted = [...health].sort((a, b) => a.score - b.score);
  const summary: Record<HealthBand, number> = { excellent: 0, good: 0, needs_attention: 0, critical: 0 };
  for (const h of health) summary[h.band]++;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <BandCard label="Excellent" count={summary.excellent} tone="emerald" />
        <BandCard label="Good" count={summary.good} tone="sky" />
        <BandCard label="Needs Attention" count={summary.needs_attention} tone="amber" />
        <BandCard label="Critical" count={summary.critical} tone="red" />
      </div>
      <Card className="bg-neutral-900 border-white/10 overflow-hidden">
        <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
          Per-tenant health (lowest first)
        </div>
        <div className="divide-y divide-white/5">
          {sorted.map((h) => (
            <Link
              key={h.tenant_id}
              to="/platform-admin/tenants/$id"
              params={{ id: h.tenant_id }}
              className="grid grid-cols-[1fr_auto] gap-3 p-3 hover:bg-white/5 text-sm text-neutral-100"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{h.tenant_name}</span>
                  <BandBadge band={h.band} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-400">
                  <span>Att {h.factors.attendance_usage}%</span>
                  <span>Fees {h.factors.fee_collection}%</span>
                  <span>Parents {h.factors.parent_activation}%</span>
                  <span>Automation {h.factors.automation_usage}%</span>
                  <span>Adoption {h.factors.feature_adoption}%</span>
                  <span>Inactive {h.factors.days_inactive}d</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold tabular-nums">{h.score}</div>
                <div className="text-[10px] text-neutral-500">/ 100</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BandCard({ label, count, tone }: { label: string; count: number; tone: "emerald" | "sky" | "amber" | "red" }) {
  const bg = {
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
    sky: "bg-sky-500/10 border-sky-500/30 text-sky-200",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    red: "bg-red-500/10 border-red-500/30 text-red-200",
  }[tone];
  return (
    <Card className={cn("p-3 border", bg)}>
      <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{count}</div>
    </Card>
  );
}

function BandBadge({ band }: { band: HealthBand }) {
  const cls = {
    excellent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    good: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    needs_attention: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    critical: "bg-red-500/15 text-red-300 border-red-500/30",
  }[band];
  const label = {
    excellent: "Excellent",
    good: "Good",
    needs_attention: "Needs Attention",
    critical: "Critical",
  }[band];
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", cls)}>{label}</span>;
}

// ---------------------------------------------------------------------------
function AdoptionPanel({ adoption }: { adoption: ReturnType<typeof computeFeatureAdoption> }) {
  const sorted = [...adoption].sort((a, b) => b.score - a.score);
  return (
    <Card className="bg-neutral-900 border-white/10 overflow-hidden">
      <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
        Feature adoption matrix
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-neutral-200">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-neutral-900">Tenant</th>
              {ADOPTION_FEATURES.map((f) => (
                <th key={f} className="p-2 text-center capitalize whitespace-nowrap">
                  {f.replace("_", " ")}
                </th>
              ))}
              <th className="p-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((a) => (
              <tr key={a.tenant_id} className="hover:bg-white/5">
                <td className="p-2 sticky left-0 bg-neutral-900 whitespace-nowrap">
                  <Link
                    to="/platform-admin/tenants/$id"
                    params={{ id: a.tenant_id }}
                    className="hover:underline"
                  >
                    {a.tenant_name}
                  </Link>
                </td>
                {ADOPTION_FEATURES.map((f) => (
                  <td key={f} className="p-2 text-center">
                    <AdoptionDot level={a.levels[f]} />
                  </td>
                ))}
                <td className="p-2 text-right font-bold tabular-nums">{a.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-[10px] text-neutral-400">
        <LegendDot level="never" /> Never used
        <LegendDot level="testing" /> Testing
        <LegendDot level="partial" /> Partially adopted
        <LegendDot level="full" /> Fully adopted
      </div>
    </Card>
  );
}

function AdoptionDot({ level }: { level: AdoptionLevel }) {
  const cls =
    level === "full"
      ? "bg-emerald-400"
      : level === "partial"
        ? "bg-sky-400"
        : level === "testing"
          ? "bg-amber-400"
          : "bg-neutral-700";
  return <span className={cn("inline-block size-2.5 rounded-full", cls)} />;
}
function LegendDot({ level }: { level: AdoptionLevel }) {
  return (
    <span className="inline-flex items-center gap-1">
      <AdoptionDot level={level} />
    </span>
  );
}

// ---------------------------------------------------------------------------
function OnboardingPanel({ onboarding }: { onboarding: ReturnType<typeof computeOnboarding> }) {
  const sorted = [...onboarding].sort((a, b) => a.completion_pct - b.completion_pct);
  return (
    <Card className="bg-neutral-900 border-white/10 overflow-hidden">
      <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
        Onboarding tracker
      </div>
      <div className="divide-y divide-white/5">
        {sorted.map((o) => (
          <div key={o.tenant_id} className="p-3 hover:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <Link
                to="/platform-admin/tenants/$id"
                params={{ id: o.tenant_id }}
                className="text-sm font-medium text-white hover:underline truncate"
              >
                {o.tenant_name}
              </Link>
              <div className="text-sm tabular-nums text-neutral-300">{o.completion_pct}%</div>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full",
                  o.completion_pct >= 80
                    ? "bg-emerald-400"
                    : o.completion_pct >= 50
                      ? "bg-sky-400"
                      : "bg-amber-400",
                )}
                style={{ width: `${o.completion_pct}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <Step ok={o.import_completed} label="Import" />
              <Step ok={o.student_activation_pct >= 40} label={`Students ${o.student_activation_pct}%`} />
              <Step ok={o.parent_activation_pct >= 30} label={`Parents ${o.parent_activation_pct}%`} />
              <Step ok={o.coach_setup} label="Coach" />
              <Step ok={o.fee_plans} label="Fee plans" />
              <Step ok={o.attendance_started} label="Attendance" />
              <Step ok={o.first_payment} label="First payment" />
              <Step ok={o.website_published} label="Website" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Step({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", ok ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-neutral-400")}>
      {ok ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
function ChurnPanel({ health }: { health: ReturnType<typeof computeTenantHealth> }) {
  const groups = {
    high: health.filter((h) => h.churn_risk === "high"),
    medium: health.filter((h) => h.churn_risk === "medium"),
    low: health.filter((h) => h.churn_risk === "low"),
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <BandCard label="High risk" count={groups.high.length} tone="red" />
        <BandCard label="Medium" count={groups.medium.length} tone="amber" />
        <BandCard label="Low" count={groups.low.length} tone="emerald" />
      </div>
      {(["high", "medium"] as const).map((k) =>
        groups[k].length === 0 ? null : (
          <Card key={k} className="bg-neutral-900 border-white/10 overflow-hidden">
            <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
              {k === "high" ? "High risk" : "Medium risk"} — {groups[k].length}
            </div>
            <div className="divide-y divide-white/5">
              {groups[k].map((h) => (
                <Link
                  key={h.tenant_id}
                  to="/platform-admin/tenants/$id"
                  params={{ id: h.tenant_id }}
                  className="block p-3 hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{h.tenant_name}</span>
                    <BandBadge band={h.band} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {h.churn_reasons.map((r) => (
                      <Badge key={r} variant="outline" className="border-white/15 text-[10px] text-neutral-300">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function AnalyticsPanel({ analytics }: { analytics: ReturnType<typeof computePlatformAnalytics> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard icon={<Activity className="size-4" />} label="Daily active academies" value={analytics.daa} />
      <KpiCard icon={<Activity className="size-4" />} label="Weekly active" value={analytics.waa} />
      <KpiCard icon={<Activity className="size-4" />} label="Monthly active" value={analytics.maa} />
      <KpiCard icon={<Users className="size-4" />} label="Student growth 30d" value={analytics.student_growth_30d} />
      <KpiCard icon={<Zap className="size-4" />} label="Automation runs 30d" value={analytics.automation_executions_30d} sub={`${analytics.automation_failures_30d} failed`} tone={analytics.automation_failures_30d > 0 ? "warning" : undefined} />
      <KpiCard icon={<Bell className="size-4" />} label="Notifications 30d" value={analytics.notification_volume_30d} sub={`${analytics.campaigns_30d} campaigns`} />
      <KpiCard icon={<Bell className="size-4" />} label="Push success (7d)" value={`${analytics.push_success_pct}%`} sub={`${analytics.notification_delivered_7d} delivered · ${analytics.notification_failed_7d} failed`} tone={analytics.push_success_pct >= 90 ? "positive" : "warning"} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function AlertsPanel({ alerts }: { alerts: ReturnType<typeof computeFounderAlerts> }) {
  if (alerts.length === 0) {
    return (
      <Card className="p-8 bg-neutral-900 border-white/10 text-center text-sm text-neutral-400">
        No active alerts — every academy looks healthy.
      </Card>
    );
  }
  return (
    <Card className="bg-neutral-900 border-white/10 overflow-hidden">
      <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
        Founder alerts — {alerts.length}
      </div>
      <div className="divide-y divide-white/5">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-start justify-between gap-3 p-3 text-sm">
            <div className="flex items-start gap-2 min-w-0">
              <span
                className={cn(
                  "mt-1.5 inline-block size-1.5 shrink-0 rounded-full",
                  a.severity === "critical" && "bg-red-500",
                  a.severity === "warning" && "bg-amber-400",
                  a.severity === "info" && "bg-sky-400",
                )}
              />
              <div className="min-w-0">
                <div className="text-neutral-100 truncate">{a.message}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                  {a.category.replace(/_/g, " ")}
                </div>
              </div>
            </div>
            {a.tenant_id ? (
              <Link
                to="/platform-admin/tenants/$id"
                params={{ id: a.tenant_id }}
                className="text-xs text-neutral-300 hover:text-white inline-flex items-center gap-1 shrink-0"
              >
                Open <ChevronRight className="size-3" />
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function TenantTimelinesPreview({
  snapshot,
  health,
}: {
  snapshot: NonNullable<ReturnType<typeof computeExecutiveKpis> extends never ? never : any>;
  health: ReturnType<typeof computeTenantHealth>;
}) {
  // Show timelines for the top 3 lowest-health tenants (the ones needing attention).
  const focus = [...health].sort((a, b) => a.score - b.score).slice(0, 3);
  if (focus.length === 0) return null;
  return (
    <Card className="bg-neutral-900 border-white/10 overflow-hidden">
      <div className="p-3 border-b border-white/10 text-xs uppercase tracking-widest text-neutral-400">
        Focus timelines — 3 lowest-health tenants
      </div>
      <div className="divide-y divide-white/5">
        {focus.map((h) => {
          const events = computeTenantTimeline(snapshot, h.tenant_id);
          return (
            <div key={h.tenant_id} className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Link
                  to="/platform-admin/tenants/$id"
                  params={{ id: h.tenant_id }}
                  className="font-medium text-white hover:underline"
                >
                  {h.tenant_name}
                </Link>
                <BandBadge band={h.band} />
              </div>
              <ol className="grid gap-1 sm:grid-cols-2 text-[11px]">
                {events.map((e) => (
                  <li key={e.kind} className="flex items-center gap-2">
                    {e.at ? (
                      <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="size-3 text-neutral-600 shrink-0" />
                    )}
                    <span className={cn("truncate", e.at ? "text-neutral-200" : "text-neutral-500")}>
                      {e.label}
                    </span>
                    {e.at ? (
                      <span className="ml-auto text-neutral-500">
                        {new Date(e.at).toLocaleDateString("en-IN")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "positive" | "warning";
}) {
  return (
    <Card
      className={cn(
        "p-4 bg-neutral-900 border-white/10 text-neutral-100",
        tone === "positive" && "border-emerald-500/30",
        tone === "warning" && "border-amber-500/30",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        {icon}
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums", tone === "positive" && "text-emerald-300", tone === "warning" && "text-amber-300")}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-neutral-500">{sub}</div> : null}
    </Card>
  );
}

// Prevent unused-import warning when Button is not referenced (kept for future filters).
void Button;
