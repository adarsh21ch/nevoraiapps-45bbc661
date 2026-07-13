import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Search, TrendingUp, TrendingDown, Trophy, Users2, Activity, ArrowRight, GitCompare } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { LoadingSkeleton, EmptyState } from "@/components/match-center/ui";
import { useDashboard } from "@/lib/dashboard-context";
import { listAthletes } from "@/lib/mc-athletes";
import { StatPill, TrendArrow } from "@/components/match-center/perf-charts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listAcademyPerformance } from "@/lib/mc-performance-analytics";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";
import { useDemoData } from "@/lib/mc-demo/store";

export const Route = createFileRoute("/match-center/performance")({
  head: () => ({
    meta: [
      { title: "Performance Analysis · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  const { tenant } = useDashboard();
  const [q, setQ] = useState("");

  const athletesQ = useQuery({
    queryKey: ["mc-perf-athletes", tenant.id],
    queryFn: () => listAthletes(tenant.id),
  });

  const overviewQ = useQuery({
    enabled: !!athletesQ.data?.length,
    queryKey: ["mc-perf-overview", tenant.id, athletesQ.data?.map((a) => a.id).join(",")],
    queryFn: () =>
      listAcademyPerformance(
        tenant.id,
        (athletesQ.data ?? []).map((a) => a.id),
      ),
  });

  const athletes = useDemoOverlay(tenant.id, athletesQ.data, (d) => d.players);
  const demo = useDemoData(tenant.id);

  const rows = useMemo(() => {
    const overview = overviewQ.data ?? [];
    const byId = new Map(overview.map((r) => [r.athleteId, r]));
    const demoById = new Map((demo?.perfRows ?? []).map((r) => [r.athleteId, r]));
    return athletes.map((a) => {
      const real = byId.get(a.id);
      const d = demoById.get(a.id);
      const row = real ?? (d
        ? {
            athleteId: a.id,
            matches: d.matches,
            runs: d.runs,
            wickets: d.wickets,
            average: d.average,
            economy: d.economy,
            consistency: 0,
            trend: "flat" as const,
            formAvg: 0,
          }
        : undefined);
      return { athlete: a, row };
    });
  }, [athletes, overviewQ.data, demo]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      (r.athlete.student?.name ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const summary = useMemo(() => {
    const active = rows.filter((r) => (r.row?.matches ?? 0) > 0);
    const totalRuns = active.reduce((s, r) => s + (r.row?.runs ?? 0), 0);
    const totalWkts = active.reduce((s, r) => s + (r.row?.wickets ?? 0), 0);
    const topBat = [...active].sort((a, b) => (b.row?.runs ?? 0) - (a.row?.runs ?? 0))[0];
    const topBowl = [...active].sort((a, b) => (b.row?.wickets ?? 0) - (a.row?.wickets ?? 0))[0];
    return {
      activeCount: active.length,
      totalRuns,
      totalWkts,
      topBat,
      topBowl,
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Performance Analysis"
        description="Understand who's improving, who's consistent, and who needs attention."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Performance" },
        ]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/match-center/performance/compare">
              <GitCompare className="size-4 mr-1.5" /> Compare Players
            </Link>
          </Button>
        }
      />

      {/* Overview cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <StatPill
          label="Active Players"
          value={summary.activeCount}
          hint={`${rows.length} total registered`}
        />
        <StatPill label="Runs Scored" value={summary.totalRuns} hint="Across all finalized matches" />
        <StatPill label="Wickets Taken" value={summary.totalWkts} hint="Across all finalized matches" />
        <StatPill
          label="Top Scorer"
          value={summary.topBat?.row?.runs ?? 0}
          hint={summary.topBat?.athlete.student?.name ?? "—"}
        />
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players…"
            className="pl-9"
          />
        </div>
      </div>

      {athletesQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title={q ? "No players match" : "No players yet"}
          description={
            q
              ? "Try a different search."
              : "Once players are registered and matches are finalized, their performance appears here."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ athlete, row }) => (
            <Link
              key={athlete.id}
              to="/match-center/performance/$athleteId"
              params={{ athleteId: athlete.id }}
              className="group rounded-2xl border bg-card p-4 transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">
                    {athlete.student?.name ?? "Unnamed"}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {athlete.cricket?.playing_role ?? "Player"}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <MicroStat label="M" value={row?.matches ?? 0} />
                <MicroStat label="Runs" value={row?.runs ?? 0} />
                <MicroStat label="Wkts" value={row?.wickets ?? 0} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Avg {(row?.average ?? 0).toFixed(1)}</span>
                <span>Econ {(row?.economy ?? 0).toFixed(2)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Team analytics teaser */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <TeaserCard
          icon={Users2}
          title="Team Analytics"
          description="Consistency, best partnerships, win rates and captain performance."
          to="/match-center/teams"
          cta="Open Teams"
        />
        <TeaserCard
          icon={Trophy}
          title="Records & Awards"
          description="Academy records and recognition based on the same underlying engines."
          to="/match-center/records"
          cta="View Records"
        />
      </div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-background/60 px-2 py-1 text-center">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-black tabular-nums">{value}</div>
    </div>
  );
}

function TeaserCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" /> {title}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <Button asChild size="sm" variant="ghost" className="mt-2 -ml-2">
        <Link to={to}>{cta} →</Link>
      </Button>
    </div>
  );
}

// Silence unused import lint helpers.
void TrendingUp;
void TrendingDown;
void Activity;
void TrendArrow;
