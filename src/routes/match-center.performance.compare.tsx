import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompare, ArrowLeft, User } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSkeleton, EmptyState } from "@/components/match-center/ui";
import { listAthletes } from "@/lib/mc-athletes";
import { buildPlayerPerformance } from "@/lib/mc-performance-analytics";
import { RadarChartSVG, StatPill } from "@/components/match-center/perf-charts";

export const Route = createFileRoute("/match-center/performance/compare")({
  head: () => ({
    meta: [
      { title: "Compare Players · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { tenant } = useDashboard();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);

  const athletesQ = useQuery({
    queryKey: ["mc-perf-compare-list", tenant.id],
    queryFn: () => listAthletes(tenant.id),
  });

  const options = useMemo(
    () =>
      (athletesQ.data ?? []).map((x) => ({
        id: x.id,
        name: x.student?.name ?? "Unnamed",
      })),
    [athletesQ.data],
  );

  const aQ = useQuery({
    enabled: !!a,
    queryKey: ["mc-perf-compare-a", a],
    queryFn: () => buildPlayerPerformance(a!, tenant.id),
  });
  const bQ = useQuery({
    enabled: !!b,
    queryKey: ["mc-perf-compare-b", b],
    queryFn: () => buildPlayerPerformance(b!, tenant.id),
  });

  const nameA = options.find((o) => o.id === a)?.name ?? "Player A";
  const nameB = options.find((o) => o.id === b)?.name ?? "Player B";

  const radarA = aQ.data
    ? [
        Math.min(100, (aQ.data.totals.runs / 500) * 100),
        Math.min(100, (aQ.data.totals.average / 40) * 100),
        Math.min(100, (aQ.data.totals.strikeRate / 150) * 100),
        Math.min(100, (aQ.data.totals.wickets / 25) * 100),
        aQ.data.totals.ballsBowled > 0
          ? Math.max(0, 100 - (aQ.data.totals.economy / 10) * 100)
          : 0,
        aQ.data.consistency.score,
      ]
    : [0, 0, 0, 0, 0, 0];

  const radarB = bQ.data
    ? [
        Math.min(100, (bQ.data.totals.runs / 500) * 100),
        Math.min(100, (bQ.data.totals.average / 40) * 100),
        Math.min(100, (bQ.data.totals.strikeRate / 150) * 100),
        Math.min(100, (bQ.data.totals.wickets / 25) * 100),
        bQ.data.totals.ballsBowled > 0
          ? Math.max(0, 100 - (bQ.data.totals.economy / 10) * 100)
          : 0,
        bQ.data.consistency.score,
      ]
    : [0, 0, 0, 0, 0, 0];

  return (
    <div>
      <PageHeader
        title="Compare Players"
        description="Head-to-head profile using existing engine data."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Performance", to: "/match-center/performance" },
          { label: "Compare" },
        ]}
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link to="/match-center/performance">
              <ArrowLeft className="size-4 mr-1.5" /> Back
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <PlayerPicker label="Player A" value={a} onChange={setA} options={options} />
        <PlayerPicker label="Player B" value={b} onChange={setB} options={options} />
      </div>

      {(!a || !b) ? (
        <EmptyState
          icon={GitCompare}
          title="Select two players"
          description="Choose Player A and Player B to compare their careers side by side."
        />
      ) : aQ.isLoading || bQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : !aQ.data || !bQ.data ? null : (
        <div className="space-y-6">
          <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <CompareStat label="Matches" a={aQ.data.totals.matches} b={bQ.data.totals.matches} nameA={nameA} nameB={nameB} />
            <CompareStat label="Runs" a={aQ.data.totals.runs} b={bQ.data.totals.runs} nameA={nameA} nameB={nameB} />
            <CompareStat label="Average" a={aQ.data.totals.average} b={bQ.data.totals.average} nameA={nameA} nameB={nameB} precision={1} />
            <CompareStat label="Strike Rate" a={aQ.data.totals.strikeRate} b={bQ.data.totals.strikeRate} nameA={nameA} nameB={nameB} precision={1} />
            <CompareStat label="Wickets" a={aQ.data.totals.wickets} b={bQ.data.totals.wickets} nameA={nameA} nameB={nameB} />
            <CompareStat label="Economy" a={aQ.data.totals.economy} b={bQ.data.totals.economy} nameA={nameA} nameB={nameB} precision={2} lowerBetter />
            <CompareStat label="Consistency" a={aQ.data.consistency.score} b={bQ.data.consistency.score} nameA={nameA} nameB={nameB} />
            <CompareStat label="Last-5 Avg" a={aQ.data.form.last5.average} b={bQ.data.form.last5.average} nameA={nameA} nameB={nameB} precision={1} />
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-black uppercase tracking-widest">Profile Radar</h2>
              <div className="flex gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" /> {nameA}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-muted-foreground" /> {nameB}
                </span>
              </div>
            </div>
            <RadarChartSVG
              axes={["Runs", "Avg", "SR", "Wkts", "Econ", "Consistency"]}
              values={radarA}
              compare={radarB}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function PlayerPicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <User className="size-3" /> {label}
      </div>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a player…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CompareStat({
  label,
  a,
  b,
  nameA,
  nameB,
  precision = 0,
  lowerBetter = false,
}: {
  label: string;
  a: number;
  b: number;
  nameA: string;
  nameB: string;
  precision?: number;
  lowerBetter?: boolean;
}) {
  const winner =
    a === b ? null : lowerBetter ? (a < b ? "a" : "b") : a > b ? "a" : "b";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1 text-[13px] font-black tabular-nums">
        <div className={winner === "a" ? "text-primary" : ""}>
          <span className="block text-[9px] font-semibold text-muted-foreground truncate">{nameA}</span>
          {a.toFixed(precision)}
        </div>
        <div className={`text-right ${winner === "b" ? "text-primary" : ""}`}>
          <span className="block text-[9px] font-semibold text-muted-foreground truncate">{nameB}</span>
          {b.toFixed(precision)}
        </div>
      </div>
    </div>
  );
}

void StatPill;
