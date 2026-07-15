import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Share2, Trophy, Target, Activity, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { LoadingSkeleton, EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildPlayerPerformance,
  generateCoachInsights,
  type CoachInsight,
} from "@/lib/mc-performance-analytics";
import { getAthlete } from "@/lib/mc-athletes";
import { useMCPlayerCareer, useMCPlayerPerformance } from "@/lib/mc-data";
import { useDemoData } from "@/lib/mc-demo/store";
import {
  LineChartSVG,
  BarChartSVG,
  RadarChartSVG,
  ProgressRing,
  TrendArrow,
  StatPill,
} from "@/components/match-center/perf-charts";
import { toast } from "sonner";

export const Route = createFileRoute("/match-center/performance/$athleteId")({
  head: () => ({
    meta: [{ title: "Player Performance · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: PlayerPerformancePage,
});

function PlayerPerformancePage() {
  const { athleteId } = Route.useParams();
  const { tenant } = useDashboard();
  const demoPerf = useMCPlayerPerformance(tenant.id, athleteId);
  const demoCareer = useMCPlayerCareer(tenant.id, athleteId);
  const demoData = useDemoData(tenant.id);
  const isDemo = demoPerf !== null;

  const athleteQ = useQuery({
    queryKey: ["mc-perf-athlete", tenant.id, athleteId],
    queryFn: () => getAthlete(tenant.id, athleteId),
    enabled: !isDemo,
  });

  const perfQ = useQuery({
    queryKey: ["mc-perf-player", tenant.id, athleteId],
    queryFn: () => buildPlayerPerformance(athleteId, tenant.id),
    enabled: !isDemo,
  });

  const careerQ = useQuery({
    queryKey: ["mc-perf-career", athleteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_player_careers")
        .select("*")
        .eq("athlete_profile_id", athleteId)
        .maybeSingle();
      return data;
    },
    enabled: !isDemo,
  });

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied");
      }
    } catch {
      /* ignore */
    }
  };

  const demoAthlete = isDemo ? demoData?.players.find((p) => p.id === athleteId) : null;
  const athlete = isDemo ? (demoAthlete ?? null) : (athleteQ.data ?? null);
  const perf = isDemo
    ? (demoPerf as unknown as NonNullable<
        ReturnType<typeof buildPlayerPerformance> extends Promise<infer T> ? T : never
      >)
    : perfQ.data;
  const career = isDemo
    ? ({ catches: demoCareer?.fielding.catches ?? 0 } as Record<string, unknown>)
    : careerQ.data;

  return (
    <div className="print:bg-white">
      <PageHeader
        title={athlete?.student?.name ?? "Player"}
        description={
          athlete?.cricket?.playing_role
            ? `${athlete.cricket.playing_role}${athlete.cricket.batting_style ? ` · ${athlete.cricket.batting_style}` : ""}`
            : "Performance profile"
        }
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Performance", to: "/match-center/performance" },
          { label: athlete?.student?.name ?? "Player" },
        ]}
        actions={
          <div className="no-print flex gap-1.5">
            <Button asChild size="sm" variant="ghost">
              <Link to="/match-center/performance">
                <ArrowLeft className="size-4 mr-1.5" /> Back
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare}>
              <Share2 className="size-4 mr-1.5" /> Share
            </Button>
          </div>
        }
      />

      {perfQ.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : !perf || perf.points.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No finalized matches yet"
          description="Once this player features in finalized matches, their performance profile appears here."
        />
      ) : (
        <div className="space-y-6">
          {/* Header stat strip */}
          <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <StatPill label="Matches" value={perf.totals.matches} />
            <StatPill
              label="Runs"
              value={perf.totals.runs}
              hint={`Avg ${perf.totals.average.toFixed(1)} · SR ${perf.totals.strikeRate.toFixed(1)}`}
            />
            <StatPill
              label="Wickets"
              value={perf.totals.wickets}
              hint={
                perf.totals.ballsBowled > 0
                  ? `Econ ${perf.totals.economy.toFixed(2)}`
                  : "No overs bowled"
              }
            />
            <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
              <ProgressRing value={perf.consistency.score} label="Consistency" hint="/100" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Band
                </div>
                <div className="text-sm font-black">{perf.consistency.band}</div>
                <TrendArrow trend={perf.form.trend} delta={perf.form.trendDelta} />
              </div>
            </div>
          </section>

          {/* Form chart */}
          <SectionCard
            title="Form"
            subtitle={`Runs across last ${perf.points.length} matches · Trend ${perf.form.trend}`}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Runs per match
                </div>
                <LineChartSVG
                  values={perf.points.map((p) => p.runs)}
                  labels={perf.points.map((p) => p.date ?? p.matchId.slice(0, 6))}
                  ariaLabel="Runs per match"
                />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Batting average to date
                </div>
                <LineChartSVG
                  values={perf.points.map((p) => p.battingAvgToDate)}
                  labels={perf.points.map((p) => p.date ?? p.matchId.slice(0, 6))}
                  ariaLabel="Batting average to date"
                  fill={false}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-2 grid-cols-3">
              <FormBucket label="Last 5" value={perf.form.last5} />
              <FormBucket label="Last 10" value={perf.form.last10} />
              <FormBucket label="Last 20" value={perf.form.last20} />
            </div>
          </SectionCard>

          {/* Radar - overall profile */}
          <SectionCard
            title="Player Radar"
            subtitle="Normalised profile — batting, bowling and fielding balance."
          >
            <RadarChartSVG
              axes={["Runs", "Avg", "SR", "Wkts", "Econ", "Fielding"]}
              values={playerRadar(perf, career)}
            />
          </SectionCard>

          {/* Match type / pressure splits */}
          <SectionCard
            title="Splits"
            subtitle="Performance by match context — no cricket math added, splits over existing engine output."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SplitTable title="By Match Type" data={perf.byMatchType} />
              <SplitTable title="Innings Order" data={perf.byInningsOrder} />
              <SplitTable title="Result" data={perf.byResult} />
              <SplitTable title="Venue" data={perf.byVenue} />
            </div>
          </SectionCard>

          {/* Batting analysis */}
          <SectionCard title="Batting" subtitle="Boundary %, dot balls, dismissal breakdown.">
            <div className="grid gap-4 md:grid-cols-2">
              <BarChartSVG
                data={perf.dismissals.map((d) => ({ label: d.type, value: d.count }))}
                ariaLabel="Dismissal breakdown"
              />
              <div className="space-y-1.5 text-[12px]">
                {perf.dismissals.length === 0 && (
                  <p className="text-muted-foreground">No dismissals recorded.</p>
                )}
                {perf.dismissals.map((d) => (
                  <div key={d.type} className="flex items-center gap-2">
                    <span className="w-28 text-xs font-semibold capitalize">
                      {d.type.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {d.count} · {d.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Insights */}
          <SectionCard
            title="Coach Insights"
            subtitle="Deterministic — derived from Statistics + Career engines. No LLM."
          >
            <InsightList insights={generateCoachInsights(perf)} />
          </SectionCard>

          {/* Fitness (from athlete profile) */}
          {athlete && (
            <SectionCard title="Fitness & Profile" subtitle="From athlete profile.">
              <div className="grid gap-3 md:grid-cols-4 text-[12px]">
                <ProfileField
                  label="Height"
                  value={athlete.height_cm ? `${athlete.height_cm} cm` : "—"}
                />
                <ProfileField
                  label="Weight"
                  value={athlete.weight_kg ? `${athlete.weight_kg} kg` : "—"}
                />
                <ProfileField label="Fitness" value={athlete.fitness_status ?? "—"} />
                <ProfileField label="Status" value={athlete.current_status ?? "—"} />
              </div>
              {athlete.medical_notes && (
                <p className="mt-3 text-[12px] text-muted-foreground italic">
                  Medical notes: {athlete.medical_notes}
                </p>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

type Perf = NonNullable<
  ReturnType<typeof buildPlayerPerformance> extends Promise<infer T> ? T : never
>;

function playerRadar(perf: Perf, career: Record<string, unknown> | null | undefined): number[] {
  const t = perf.totals;
  const runsScore = Math.min(100, (t.runs / 500) * 100);
  const avgScore = Math.min(100, (t.average / 40) * 100);
  const srScore = Math.min(100, (t.strikeRate / 150) * 100);
  const wktScore = Math.min(100, (t.wickets / 25) * 100);
  const econScore = t.ballsBowled > 0 ? Math.max(0, 100 - (t.economy / 10) * 100) : 0;
  const catches = Number((career?.catches as number | undefined) ?? 0);
  const fieldScore = Math.min(100, (catches / 10) * 100);
  return [runsScore, avgScore, srScore, wktScore, econScore, fieldScore];
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FormBucket({
  label,
  value,
}: {
  label: string;
  value: {
    matches: number;
    innings: number;
    runs: number;
    average: number;
    strikeRate: number;
    wickets: number;
  };
}) {
  return (
    <div className="rounded-xl border bg-background/40 p-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-black tabular-nums mt-0.5">
        {value.runs} <span className="text-muted-foreground text-[10px]">runs</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Avg {value.average.toFixed(1)} · {value.wickets} wkts
      </div>
    </div>
  );
}

function SplitTable({
  title,
  data,
}: {
  title: string;
  data: Array<{
    label: string;
    matches: number;
    runs: number;
    average: number;
    strikeRate: number;
    wickets: number;
    economy: number;
  }>;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No data.</p>
      ) : (
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-y text-[9px] uppercase tracking-widest text-muted-foreground">
              <th className="text-left py-1">Split</th>
              <th className="text-right">M</th>
              <th className="text-right">R</th>
              <th className="text-right">Avg</th>
              <th className="text-right">SR</th>
              <th className="text-right">W</th>
              <th className="text-right">Econ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b last:border-0">
                <td className="py-1 font-semibold">{d.label}</td>
                <td className="text-right tabular-nums">{d.matches}</td>
                <td className="text-right tabular-nums">{d.runs}</td>
                <td className="text-right tabular-nums">{d.average.toFixed(1)}</td>
                <td className="text-right tabular-nums">{d.strikeRate.toFixed(1)}</td>
                <td className="text-right tabular-nums">{d.wickets}</td>
                <td className="text-right tabular-nums">{d.economy.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InsightList({ insights }: { insights: CoachInsight[] }) {
  if (insights.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">Not enough data yet to generate insights.</p>
    );
  }
  const badge = (k: CoachInsight["kind"]) => {
    const map: Record<
      CoachInsight["kind"],
      { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
    > = {
      strength: {
        label: "Strength",
        cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        icon: Trophy,
      },
      weakness: {
        label: "Weakness",
        cls: "border-rose-500/40 text-rose-600 dark:text-rose-400",
        icon: Target,
      },
      development: {
        label: "Development",
        cls: "border-amber-500/40 text-amber-600 dark:text-amber-400",
        icon: Activity,
      },
      suggestion: {
        label: "Training",
        cls: "border-blue-500/40 text-blue-600 dark:text-blue-400",
        icon: Activity,
      },
      selection: { label: "Selection", cls: "border-primary/40 text-primary", icon: User },
    };
    return map[k];
  };
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {insights.map((ins, i) => {
        const b = badge(ins.kind);
        const Icon = b.icon;
        return (
          <li key={i} className="rounded-xl border bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${b.cls} gap-1`}>
                <Icon className="size-3" /> {b.label}
              </Badge>
              <span className="text-[13px] font-bold">{ins.title}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{ins.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
