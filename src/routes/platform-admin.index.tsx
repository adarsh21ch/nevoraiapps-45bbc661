import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusChip, SubChip } from "@/components/platform/StatusChips";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { analyticsKeys, fetchPlatformStats } from "@/lib/platform-analytics";
import {
  Building2,
  ChevronRight,
  ExternalLink,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  GraduationCap,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { niche } from "@/lib/niche";
import { tenantSiteUrl } from "@/lib/tenant";

export const Route = createFileRoute("/platform-admin/")({
  component: Overview,
});

function Overview() {
  const { data = [], isLoading } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const { data: stats } = useQuery({ queryKey: analyticsKeys.stats, queryFn: fetchPlatformStats });

  const activeTenants = data.filter((t) => t.status === "active");
  const mrr = stats?.mrr ?? activeTenants.reduce((s, t) => s + (t.monthly_price ?? 0), 0);
  const receivedThisMonth =
    stats?.mrr_collected ??
    activeTenants
      .filter((t) => t.subscription_status === "paid")
      .reduce((s, t) => s + (t.monthly_price ?? 0), 0);
  const expectedThisMonth = mrr;
  const pct = expectedThisMonth > 0 ? Math.round((receivedThisMonth / expectedThisMonth) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Platform overview</h1>
          <p className="text-sm text-neutral-400">
            SaaS control center · every academy, every metric.
          </p>
        </div>
        <Button asChild className="bg-white text-neutral-900 hover:bg-neutral-100">
          <Link to="/platform-admin/new">
            <Plus className="size-4 mr-1" /> Onboard client
          </Link>
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiLink
          to="/platform-admin/tenants"
          icon={<Building2 className="size-4" />}
          label="Academies"
          value={stats?.total_tenants ?? data.length}
          sub={`${stats?.active_tenants ?? activeTenants.length} active · ${stats?.suspended_tenants ?? 0} suspended`}
        />
        <KpiLink
          to="/platform-admin/subscriptions"
          icon={<TrendingUp className="size-4" />}
          label="MRR"
          value={`₹${mrr.toLocaleString("en-IN")}`}
          sub={`${pct}% collected`}
        />
        <KpiLink
          to="/platform-admin/usage"
          icon={<GraduationCap className="size-4" />}
          label="Students"
          value={stats?.total_students ?? "—"}
          sub={`${stats?.total_parents ?? 0} parents linked`}
        />
        <KpiLink
          to="/platform-admin/usage"
          icon={<ShieldCheck className="size-4" />}
          label="Admins"
          value={stats?.total_admins ?? "—"}
          sub="Owners + coaches"
        />
        <Kpi
          icon={<MessageSquare className="size-4" />}
          label="Comms sent"
          value={stats?.campaigns_sent ?? "—"}
          sub={`${stats?.notifications_30d ?? 0} notifs · 30d`}
        />
        <Kpi
          icon={<Sparkles className="size-4" />}
          label="Trial"
          value={stats?.trial_tenants ?? 0}
          sub="Convert these"
        />
        <KpiLink
          to="/platform-admin/audit"
          icon={<ShieldCheck className="size-4" />}
          label="Audit trail"
          value="Immutable"
          sub="View log"
        />
        <KpiLink
          to="/platform-admin/health"
          icon={<Wallet className="size-4" />}
          label="System"
          value="Live"
          sub="Probe status"
        />
      </div>

      <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-400">This month</div>
            <div className="mt-1 text-lg font-semibold">
              <span className="text-emerald-300">₹{receivedThisMonth.toLocaleString("en-IN")}</span>
              <span className="text-neutral-500 text-sm"> received of </span>
              <span>₹{expectedThisMonth.toLocaleString("en-IN")}</span>
              <span className="text-neutral-500 text-sm"> expected</span>
            </div>
          </div>
          <Link
            to="/platform-admin/subscriptions"
            className="text-xs text-neutral-300 hover:text-white inline-flex items-center gap-1"
          >
            Manage <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-neutral-500">{pct}% collected</div>
      </Card>

      <Card className="bg-neutral-900 border-white/10 text-neutral-100 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">Tenants</div>
          <div className="text-xs text-neutral-400">{data.length} total</div>
        </div>

        {isLoading && (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 bg-white/5" />
            ))}
          </div>
        )}
        {!isLoading && data.length === 0 && (
          <div className="p-8 text-center text-sm text-neutral-400">
            No tenants yet.{" "}
            <Link to="/platform-admin/new" className="underline">
              Onboard your first client
            </Link>
            .
          </div>
        )}

        <div className="divide-y divide-white/5">
          {data.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 p-4 hover:bg-white/5">
              <div
                className="size-9 rounded-md grid place-items-center text-white text-xs font-bold shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})`,
                }}
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/platform-admin/tenants/$id"
                    params={{ id: t.id }}
                    className="font-semibold hover:underline truncate"
                  >
                    {t.name}
                  </Link>
                  <StatusChip status={t.status} />
                  <SubChip sub={t.subscription_status} />
                  <span className="text-xs text-neutral-400 capitalize">
                    · {niche(t.niche).label}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  /{t.slug} · {t.student_count ?? 0} students · created{" "}
                  {new Date(t.created_at).toLocaleDateString("en-IN")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">
                  ₹{(t.monthly_price ?? 0).toLocaleString("en-IN")}
                  <span className="text-xs text-neutral-400">/mo</span>
                </div>
                <a
                  href={tenantSiteUrl(t)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1"
                >
                  View site <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </Card>
  );
}

function KpiLink({
  to,
  icon,
  label,
  value,
  sub,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100 group-hover:border-white/30 transition-colors">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-2">
            {icon}
            {label}
          </span>
          <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
      </Card>
    </Link>
  );
}
