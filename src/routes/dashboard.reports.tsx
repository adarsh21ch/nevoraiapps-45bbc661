import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Printer,
  Search,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileType,
  Activity,
  Heart,
  Wallet,
  Users,
  Trophy,
  Radio,
  Minus,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  presetRange,
  rqk,
  toCsv,
  fetchAttendanceReport,
  fetchBillingReport,
  fetchAdmissionsReport,
  fetchPlayersReport,
  fetchMatchesReport,
  fetchCommsReport,
  type Preset,
  type Range,
  type AttendanceReport,
  type BillingReport,
  type AdmissionsReport,
  type PlayersReport,
  type MatchesReport,
  type CommsReport,
} from "@/lib/reports";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { cn } from "@/lib/utils";

// Recharts is heavy — lazy load so KPIs paint first.
const Charts = lazy(() =>
  import("@/components/reports/charts").then((m) => ({ default: m.Charts })),
);

export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({
    meta: [{ title: "Reports · Executive Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: ReportsHub,
});

type Category =
  | "overview"
  | "attendance"
  | "finance"
  | "admissions"
  | "students"
  | "cricket"
  | "communication";

const PRESET_LABELS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
];

function presetLabel(p: Preset) {
  return PRESET_LABELS.find((x) => x.key === p)?.label ?? "Custom";
}

// -------- Range helpers --------
function prevRange(r: Range): Range {
  const from = new Date(r.from).getTime();
  const to = new Date(r.to).getTime();
  const dur = Math.max(1, to - from);
  return { from: new Date(from - dur).toISOString(), to: new Date(from).toISOString() };
}
function pctChange(curr: number, prev: number): number | undefined {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return undefined;
  if (prev === 0) return curr === 0 ? 0 : undefined;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

// ============================================================
// ReportsHub
// ============================================================

function ReportsHub() {
  const { tenant, profile } = useDashboard();
  const owner = isOwner(profile);
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("overview");

  const range: Range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return {
        from: new Date(customFrom).toISOString(),
        to: new Date(new Date(customTo).setHours(23, 59, 59, 999)).toISOString(),
      };
    }
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const categories: { value: Category; label: string; ownerOnly?: boolean }[] = [
    { value: "overview", label: "Overview" },
    { value: "attendance", label: "Attendance" },
    { value: "finance", label: "Finance", ownerOnly: true },
    { value: "admissions", label: "Admissions" },
    { value: "students", label: "Students" },
    { value: "cricket", label: "Cricket" },
    { value: "communication", label: "Communication" },
  ];
  const visibleCats = categories.filter((c) => !c.ownerOnly || owner);

  return (
    <div className="space-y-4 pb-10">
      <ModuleHeader
        overline="Academy"
        title="Reports"
        backTo="/dashboard/academy"
        action={<ExportMenu />}
      />
      <div className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{tenant.name}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3" />{" "}
          {preset === "custom" ? rangeLabel(range) : presetLabel(preset)}
        </span>
      </div>

      {/* Search + range dropdown */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl"
          />
        </div>
        <RangeDropdown
          preset={preset}
          onPreset={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />
      </div>

      <CategorySegments value={category} onChange={setCategory} options={visibleCats} />

      {category === "overview" && (
        <OverviewReport tenantId={tenant.id} range={range} owner={owner} />
      )}
      {category === "attendance" && <AttendanceReport tenantId={tenant.id} range={range} />}
      {category === "finance" && owner && <FinanceReport tenantId={tenant.id} range={range} />}
      {category === "admissions" && <AdmissionsReport tenantId={tenant.id} range={range} />}
      {category === "students" && <StudentsReport tenantId={tenant.id} range={range} />}
      {category === "cricket" && <CricketReport tenantId={tenant.id} range={range} />}
      {category === "communication" && <CommunicationReport tenantId={tenant.id} range={range} />}
    </div>
  );
}

// ============================================================
// Segmented control (scrollable on mobile)
// ============================================================

function CategorySegments<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto no-scrollbar">
      <div className="mx-1 inline-flex min-w-full gap-1 rounded-xl bg-muted p-0.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap",
                active
                  ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Range dropdown
// ============================================================

function RangeDropdown(props: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (s: string) => void;
  onCustomTo: (s: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl shrink-0 gap-1">
          <CalendarDays className="size-4" />
          <span className="hidden sm:inline">
            {props.preset === "custom" ? "Custom" : presetLabel(props.preset)}
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Date range</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRESET_LABELS.map((p) => (
          <DropdownMenuItem key={p.key} onSelect={() => props.onPreset(p.key)}>
            {p.label}
            {props.preset === p.key && <CheckCircle2 className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Custom range</DropdownMenuLabel>
        <div className="p-2 flex flex-col gap-2">
          <Input
            type="date"
            value={props.customFrom}
            onChange={(e) => {
              props.onCustomFrom(e.target.value);
              props.onPreset("custom");
            }}
            className="h-8"
          />
          <Input
            type="date"
            value={props.customTo}
            onChange={(e) => {
              props.onCustomTo(e.target.value);
              props.onPreset("custom");
            }}
            className="h-8"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// Export menu
// ============================================================

function ExportMenu({ csv }: { csv?: () => void } = {}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="print:hidden h-9 gap-1">
          <Download className="size-4" /> <span className="hidden sm:inline">Export</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => window.print()}>
          <FileType className="size-4 mr-2" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => csv?.() ?? window.print()}>
          <FileSpreadsheet className="size-4 mr-2" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => csv?.() ?? window.print()}>
          <FileText className="size-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer className="size-4 mr-2" /> Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// OVERVIEW — CEO Dashboard
// ============================================================

function OverviewReport({
  tenantId,
  range,
  owner,
}: {
  tenantId: string;
  range: Range;
  owner: boolean;
}) {
  const pr = useMemo(() => prevRange(range), [range]);

  const kpisQ = useQuery({
    queryKey: qk.kpis(tenantId),
    queryFn: () => fetchKpis({ id: tenantId } as any),
  });
  const attQ = useQuery({
    queryKey: rqk.attendance(tenantId, range),
    queryFn: () => fetchAttendanceReport(tenantId, range),
  });
  const attPQ = useQuery({
    queryKey: rqk.attendance(tenantId, pr),
    queryFn: () => fetchAttendanceReport(tenantId, pr),
  });
  const admQ = useQuery({
    queryKey: rqk.admissions(tenantId, range),
    queryFn: () => fetchAdmissionsReport(tenantId, range),
  });
  const admPQ = useQuery({
    queryKey: rqk.admissions(tenantId, pr),
    queryFn: () => fetchAdmissionsReport(tenantId, pr),
  });
  const billQ = useQuery({
    enabled: owner,
    queryKey: rqk.billing(tenantId, range),
    queryFn: () => fetchBillingReport(tenantId, range),
  });
  const billPQ = useQuery({
    enabled: owner,
    queryKey: rqk.billing(tenantId, pr),
    queryFn: () => fetchBillingReport(tenantId, pr),
  });
  const plyQ = useQuery({
    queryKey: rqk.players(tenantId, range),
    queryFn: () => fetchPlayersReport(tenantId, range),
  });
  const mchQ = useQuery({
    queryKey: rqk.matches(tenantId, range),
    queryFn: () => fetchMatchesReport(tenantId, range),
  });
  const commQ = useQuery({
    queryKey: rqk.comms(tenantId, range),
    queryFn: () => fetchCommsReport(tenantId, range),
  });

  const health = computeHealthScore({
    att: attQ.data,
    bill: billQ.data,
    adm: admQ.data,
    ply: plyQ.data,
    comm: commQ.data,
  });

  const highlights = buildHighlights({
    curr: { att: attQ.data, bill: billQ.data, adm: admQ.data, ply: plyQ.data },
    prev: { att: attPQ.data, bill: billPQ.data, adm: admPQ.data },
  });

  const actions = buildActions({
    tenantId,
    att: attQ.data,
    bill: billQ.data,
    adm: admQ.data,
    ply: plyQ.data,
    owner,
  });

  return (
    <div className="space-y-5">
      {/* KPI grid + Health score side by side on desktop */}
      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(240px,300px)]">
        <KpiGrid>
          {owner && (
            <KpiTile
              label="Revenue"
              value={inr(billQ.data?.revenue ?? 0)}
              trend={pctChange(billQ.data?.revenue ?? 0, billPQ.data?.revenue ?? 0)}
              hint="vs previous"
            />
          )}
          {owner && (
            <KpiTile
              label="Pending Fees"
              value={inr(billQ.data?.pendingApprox ?? 0)}
              hint={`${billQ.data?.pendingStudents ?? 0} students`}
              tone={billQ.data && billQ.data.pendingStudents > 0 ? "warn" : "ok"}
            />
          )}
          {owner && (
            <KpiTile
              label="Collection %"
              value={`${billQ.data?.collectionRate ?? 100}%`}
              trend={pctChange(billQ.data?.collectionRate ?? 0, billPQ.data?.collectionRate ?? 0)}
              hint="paid ÷ due"
            />
          )}
          <KpiTile
            label="Attendance %"
            value={`${attQ.data?.percent ?? 0}%`}
            trend={pctChange(attQ.data?.percent ?? 0, attPQ.data?.percent ?? 0)}
            hint={`${attQ.data?.sessions ?? 0} sessions`}
          />
          <KpiTile
            label="Admissions"
            value={String(admQ.data?.converted ?? 0)}
            trend={pctChange(admQ.data?.converted ?? 0, admPQ.data?.converted ?? 0)}
            hint={`${admQ.data?.conversion ?? 0}% conversion`}
          />
          <KpiTile
            label="Retention %"
            value={`${plyQ.data?.retention ?? 0}%`}
            hint={`${plyQ.data?.inactive ?? 0} inactive`}
          />
          <KpiTile
            label="Active Students"
            value={String(plyQ.data?.active ?? kpisQ.data?.activeStudents ?? 0)}
            hint={`${plyQ.data?.newInRange ?? 0} new`}
          />
          <KpiTile
            label="Active Batches"
            value={String((plyQ.data?.byBatch ?? []).filter((b) => b.count > 0).length)}
          />
          <KpiTile
            label="Live Matches"
            value={String(mchQ.data?.live ?? 0)}
            hint={`${mchQ.data?.upcoming ?? 0} upcoming`}
          />
          <KpiTile
            label="Broadcast Reach"
            value={String(commQ.data?.delivered ?? 0)}
            hint={`${commQ.data?.sent ?? 0} sent`}
          />
        </KpiGrid>
        <HealthScoreCard score={health.total} status={health.status} breakdown={health.breakdown} />
      </div>

      {/* Highlights + Action Center — two-column on desktop */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Executive Highlights" icon={<Sparkles className="size-4 text-primary" />}>
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough data yet for this period.</p>
          ) : (
            <ul className="space-y-1.5">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {h.tone === "good" ? (
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0">{h.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <ActionCenter items={actions} />
      </div>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="grid gap-3 md:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        }
      >
        <Charts
          view="overview"
          data={{
            attendanceDaily: attQ.data?.daily ?? [],
            revenueByMonth: billQ.data?.byMonth ?? [],
            admissionsByStage: admQ.data?.byStage ?? [],
            attendanceByBatch: attQ.data?.perBatch ?? [],
          }}
        />
      </Suspense>

      {/* Top Performers */}
      <Panel title="Top Performers" icon={<TrendingUp className="size-4 text-primary" />}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <MiniStat
            icon={<Users className="size-3.5" />}
            label="Top Batch"
            value={attQ.data?.perBatch?.[0]?.batch ?? "—"}
            sub={
              attQ.data?.perBatch?.[0] ? `${attQ.data.perBatch[0].percent}% attendance` : undefined
            }
          />
          <MiniStat
            icon={<CheckCircle2 className="size-3.5" />}
            label="Highest Attendance"
            value={attQ.data?.topStudents?.[0]?.name ?? "—"}
            sub={attQ.data?.topStudents?.[0] ? `${attQ.data.topStudents[0].percent}%` : undefined}
          />
          {owner && (
            <MiniStat
              icon={<Wallet className="size-3.5" />}
              label="Top Revenue Month"
              value={topBy(billQ.data?.byMonth ?? [], "amount")?.label ?? "—"}
              sub={
                topBy(billQ.data?.byMonth ?? [], "amount")
                  ? inr(topBy(billQ.data?.byMonth ?? [], "amount")!.amount as number)
                  : undefined
              }
            />
          )}
          <MiniStat
            icon={<Sparkles className="size-3.5" />}
            label="Best Conversion Source"
            value={admQ.data?.bySource?.[0]?.label ?? "—"}
            sub={admQ.data?.bySource?.[0] ? `${admQ.data.bySource[0].count} leads` : undefined}
          />
          <MiniStat
            icon={<Trophy className="size-3.5" />}
            label="Most Active Tournament"
            value={mchQ.data?.byResult?.[0]?.label ?? "—"}
            sub={mchQ.data?.byResult?.[0] ? `${mchQ.data.byResult[0].count} matches` : undefined}
          />
          <MiniStat
            icon={<Users className="size-3.5" />}
            label="Largest Batch"
            value={plyQ.data?.byBatch?.[0]?.label ?? "—"}
            sub={plyQ.data?.byBatch?.[0] ? `${plyQ.data.byBatch[0].count} players` : undefined}
          />
        </div>
      </Panel>

      {/* AI Coach */}
      <AiCoach
        summary={buildAiSummary({
          revenueTrend: pctChange(billQ.data?.revenue ?? 0, billPQ.data?.revenue ?? 0),
          attendanceTrend: pctChange(attQ.data?.percent ?? 0, attPQ.data?.percent ?? 0),
          conversion: admQ.data?.conversion,
          pendingStudents: billQ.data?.pendingStudents,
          topBatch: attQ.data?.perBatch?.[0]?.batch,
        })}
        recommendations={buildRecommendations({
          pendingStudents: billQ.data?.pendingStudents ?? 0,
          lowAttendance: (attQ.data?.lowStudents ?? []).filter((s) => s.percent < 60).length,
          newLeads: (admQ.data?.byStage ?? []).find((s) => s.stage === "new")?.count ?? 0,
        })}
      />
    </div>
  );
}

// ============================================================
// Academy Health Score
// ============================================================

type HealthBreakdown = { label: string; value: number; icon: React.ReactNode };
type Health = { total: number; status: string; breakdown: HealthBreakdown[] };

function computeHealthScore(x: {
  att?: AttendanceReport;
  bill?: BillingReport;
  adm?: AdmissionsReport;
  ply?: PlayersReport;
  comm?: CommsReport;
}): Health {
  const attendance = clamp(x.att?.percent ?? 0);
  const finance = clamp(x.bill?.collectionRate ?? 0);
  const growthRaw = (x.ply?.newInRange ?? 0) * 8 + (x.adm?.conversion ?? 0);
  const growth = clamp(growthRaw);
  const engagementBase =
    x.comm && x.comm.sent > 0 ? Math.round((x.comm.delivered / x.comm.sent) * 100) : 60;
  const engagement = clamp(engagementBase);
  const activeBatches = (x.ply?.byBatch ?? []).filter((b) => b.count > 0).length;
  const totalStudents = (x.ply?.active ?? 0) + (x.ply?.inactive ?? 0);
  const inactivePenalty = totalStudents
    ? Math.min(40, Math.round(((x.ply?.inactive ?? 0) / totalStudents) * 100))
    : 0;
  const operations = clamp(80 + Math.min(10, activeBatches) - inactivePenalty);

  const total = Math.round((attendance + finance + growth + engagement + operations) / 5);
  const status =
    total >= 85 ? "Excellent" : total >= 70 ? "Healthy" : total >= 55 ? "Fair" : "Needs Attention";
  return {
    total,
    status,
    breakdown: [
      { label: "Attendance", value: attendance, icon: <Activity className="size-3.5" /> },
      { label: "Finance", value: finance, icon: <Wallet className="size-3.5" /> },
      { label: "Growth", value: growth, icon: <TrendingUp className="size-3.5" /> },
      { label: "Engagement", value: engagement, icon: <Radio className="size-3.5" /> },
      { label: "Operations", value: operations, icon: <Users className="size-3.5" /> },
    ],
  };
}

function HealthScoreCard({
  score,
  status,
  breakdown,
}: {
  score: number;
  status: string;
  breakdown: HealthBreakdown[];
}) {
  const stroke = 8;
  const size = 96;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const tone =
    score >= 85
      ? "text-emerald-600"
      : score >= 70
        ? "text-primary"
        : score >= 55
          ? "text-amber-600"
          : "text-rose-600";
  const ring =
    score >= 85
      ? "stroke-emerald-500"
      : score >= 70
        ? "stroke-primary"
        : score >= 55
          ? "stroke-amber-500"
          : "stroke-rose-500";
  return (
    <Card className="p-4 rounded-2xl border border-border/60">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
        <Heart className="size-3.5" /> Academy Health
      </div>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              className="stroke-muted"
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              className={cn(ring, "transition-all")}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              fill="none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={cn("text-2xl font-bold leading-none tabular-nums", tone)}>{score}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
              / 100
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-semibold", tone)}>{status}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Composite score across 5 dimensions.
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {breakdown.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 w-24 shrink-0 text-muted-foreground">
              {b.icon}
              <span className="truncate">{b.label}</span>
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  b.value >= 80
                    ? "bg-emerald-500"
                    : b.value >= 60
                      ? "bg-primary"
                      : b.value >= 40
                        ? "bg-amber-500"
                        : "bg-rose-500",
                )}
                style={{ width: `${b.value}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{b.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Action Center
// ============================================================

type ActionItem = {
  label: string;
  count: number;
  to: string;
  search?: Record<string, string>;
  tone?: "warn" | "info";
};

function buildActions(x: {
  tenantId: string;
  att?: AttendanceReport;
  bill?: BillingReport;
  adm?: AdmissionsReport;
  ply?: PlayersReport;
  owner: boolean;
}): ActionItem[] {
  const items: ActionItem[] = [];
  if (x.owner && (x.bill?.pendingStudents ?? 0) > 0) {
    items.push({
      label: "Pending fee payments",
      count: x.bill!.pendingStudents,
      to: "/dashboard/fees",
      search: { filter: "pending" },
      tone: "warn",
    });
  }
  const lowStudents = (x.att?.lowStudents ?? []).filter((s) => s.percent < 60).length;
  if (lowStudents > 0)
    items.push({
      label: "Students below 60% attendance",
      count: lowStudents,
      to: "/dashboard/attendance",
      tone: "warn",
    });
  const inactive = x.ply?.inactive ?? 0;
  if (inactive > 0)
    items.push({
      label: "Inactive students",
      count: inactive,
      to: "/dashboard/students",
      tone: "info",
    });
  const newLeads = (x.adm?.byStage ?? []).find((s) => s.stage === "new")?.count ?? 0;
  if (newLeads > 0)
    items.push({
      label: "Unanswered enquiries",
      count: newLeads,
      to: "/dashboard/leads",
      tone: "warn",
    });
  const inactiveBatches = (x.ply?.byBatch ?? []).filter((b) => b.count === 0).length;
  if (inactiveBatches > 0)
    items.push({
      label: "Inactive batches",
      count: inactiveBatches,
      to: "/dashboard/batches",
      tone: "info",
    });
  return items;
}

function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <Panel
      title="Needs Your Attention"
      icon={<AlertTriangle className="size-4 text-amber-600" />}
      tone="warn"
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everything looks good today 🎉</p>
      ) : (
        <ul className="divide-y divide-border/60 -mx-1">
          {items.map((it, i) => (
            <li key={i}>
              <Link
                to={it.to as any}
                search={it.search as any}
                className="flex items-center gap-3 px-1 py-2.5 -mx-0.5 rounded-lg hover:bg-muted/50 transition"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 min-w-8 justify-center tabular-nums text-[11px]",
                    it.tone === "warn" &&
                      "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300",
                  )}
                >
                  {it.count}
                </Badge>
                <span className="text-sm min-w-0 truncate flex-1">{it.label}</span>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ============================================================
// AI Coach
// ============================================================

function AiCoach({
  summary,
  recommendations,
}: {
  summary: { text: string; tone: "good" | "warn" }[];
  recommendations: string[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="rounded-2xl border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">AI Coach</div>
          <div className="text-[11px] text-muted-foreground">Insights and recommended actions</div>
        </div>
        <ChevronDown className={cn("size-4 opacity-60 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/60 grid gap-4 sm:grid-cols-2">
          <div className="pt-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Summary
            </div>
            <ul className="space-y-1.5 text-sm">
              {summary.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  {s.tone === "good" ? (
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0">{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pt-3 sm:border-l sm:border-border/60 sm:pl-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Recommended actions
            </div>
            <ul className="space-y-1.5 text-sm">
              {recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="size-3.5 mt-1 shrink-0 text-primary" />
                  <span className="min-w-0 text-foreground">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// ATTENDANCE
// ============================================================

function AttendanceReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const pr = useMemo(() => prevRange(range), [range]);
  const q = useQuery({
    queryKey: rqk.attendance(tenantId, range),
    queryFn: () => fetchAttendanceReport(tenantId, range),
  });
  const pq = useQuery({
    queryKey: rqk.attendance(tenantId, pr),
    queryFn: () => fetchAttendanceReport(tenantId, pr),
  });
  const d = q.data;
  const topBatch = d?.perBatch?.[0];
  const lowBatch = d?.perBatch
    ? [...d.perBatch].sort((a, b) => a.percent - b.percent)[0]
    : undefined;
  const belowThreshold = (d?.lowStudents ?? []).filter((s) => s.percent < 60);
  const longestAbsence = (d?.lowStudents ?? [])
    .slice()
    .sort((a, b) => b.total - b.present - (a.total - a.present))[0];

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile
          label="Attendance %"
          value={`${d?.percent ?? 0}%`}
          trend={pctChange(d?.percent ?? 0, pq.data?.percent ?? 0)}
        />
        <KpiTile label="Present" value={String(d?.present ?? 0)} />
        <KpiTile
          label="Absent"
          value={String(d?.absent ?? 0)}
          tone={d && d.absent > 0 ? "warn" : "ok"}
        />
        <KpiTile label="Late" value={String(d?.late ?? 0)} />
        <KpiTile label="Sessions" value={String(d?.sessions ?? 0)} />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts
          view="attendance"
          data={{ attendanceDaily: d?.daily ?? [], attendanceByBatch: d?.perBatch ?? [] }}
        />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel
          title="Top attendance"
          rows={(d?.topStudents ?? []).map((s) => ({
            label: s.name,
            value: `${s.percent}%`,
            sub: `${s.present}/${s.total}`,
          }))}
        />
        <ListPanel
          title="Lowest attendance"
          tone="warn"
          rows={(d?.lowStudents ?? []).map((s) => ({
            label: s.name,
            value: `${s.percent}%`,
            sub: `${s.present}/${s.total}`,
            warn: s.percent < 60,
          }))}
        />
      </div>
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {topBatch && (
            <InsightLi tone="good" text={`Top batch: ${topBatch.batch} at ${topBatch.percent}%`} />
          )}
          {lowBatch && lowBatch.batch !== topBatch?.batch && (
            <InsightLi
              tone="warn"
              text={`Lowest batch: ${lowBatch.batch} at ${lowBatch.percent}%`}
            />
          )}
          <InsightLi
            tone={belowThreshold.length ? "warn" : "good"}
            text={`${belowThreshold.length} students below 60% attendance`}
          />
          {longestAbsence && (
            <InsightLi
              tone="warn"
              text={`Longest absence streak: ${longestAbsence.name} · ${longestAbsence.total - longestAbsence.present} sessions missed`}
            />
          )}
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// FINANCE
// ============================================================

function FinanceReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const pr = useMemo(() => prevRange(range), [range]);
  const q = useQuery({
    queryKey: rqk.billing(tenantId, range),
    queryFn: () => fetchBillingReport(tenantId, range),
  });
  const pq = useQuery({
    queryKey: rqk.billing(tenantId, pr),
    queryFn: () => fetchBillingReport(tenantId, pr),
  });
  const d = q.data;
  const topMonth = topBy(d?.byMonth ?? [], "amount");
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile
          label="Collected"
          value={inr(d?.revenue ?? 0)}
          trend={pctChange(d?.revenue ?? 0, pq.data?.revenue ?? 0)}
          hint={`${d?.paymentsCount ?? 0} payments`}
        />
        <KpiTile
          label="Pending"
          value={inr(d?.pendingApprox ?? 0)}
          hint={`${d?.pendingStudents ?? 0} students`}
          tone={d && d.pendingStudents > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="Collection %"
          value={`${d?.collectionRate ?? 100}%`}
          trend={pctChange(d?.collectionRate ?? 0, pq.data?.collectionRate ?? 0)}
        />
        <KpiTile
          label="Avg Payment"
          value={inr(d?.avgPayment ?? 0)}
          trend={pctChange(d?.avgPayment ?? 0, pq.data?.avgPayment ?? 0)}
        />
        <KpiTile label="Outstanding" value={String(d?.pendingStudents ?? 0)} hint="students" />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts
          view="finance"
          data={{ revenueByMonth: d?.byMonth ?? [], byMethod: d?.byMethod ?? [] }}
        />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel
          title="By payment method"
          rows={(d?.byMethod ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))}
        />
        <ListPanel
          title="By fee type"
          rows={(d?.byType ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))}
        />
      </div>
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {topMonth && (
            <InsightLi
              tone="good"
              text={`Highest revenue month: ${topMonth.label} · ${inr(topMonth.amount)}`}
            />
          )}
          <InsightLi
            tone={d && d.collectionRate >= 80 ? "good" : "warn"}
            text={`Collection rate at ${d?.collectionRate ?? 0}%`}
          />
          {typeof pq.data?.revenue === "number" && (
            <InsightLi
              tone={(d?.revenue ?? 0) >= pq.data.revenue ? "good" : "warn"}
              text={`Revenue ${(d?.revenue ?? 0) >= pq.data.revenue ? "up" : "down"} vs previous period`}
            />
          )}
          {(d?.pendingStudents ?? 0) > 0 && (
            <InsightLi tone="warn" text={`${d?.pendingStudents} students carry pending balances`} />
          )}
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// ADMISSIONS
// ============================================================

function AdmissionsReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const pr = useMemo(() => prevRange(range), [range]);
  const q = useQuery({
    queryKey: rqk.admissions(tenantId, range),
    queryFn: () => fetchAdmissionsReport(tenantId, range),
  });
  const pq = useQuery({
    queryKey: rqk.admissions(tenantId, pr),
    queryFn: () => fetchAdmissionsReport(tenantId, pr),
  });
  const d = q.data;
  const best = d?.bySource?.[0];
  const worst = d?.bySource ? [...d.bySource].sort((a, b) => a.count - b.count)[0] : undefined;
  const pending = (d?.byStage ?? []).find((s) => s.stage === "new")?.count ?? 0;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile
          label="Leads"
          value={String(d?.totalLeads ?? 0)}
          trend={pctChange(d?.totalLeads ?? 0, pq.data?.totalLeads ?? 0)}
        />
        <KpiTile
          label="Trials"
          value={String(d?.trials ?? 0)}
          trend={pctChange(d?.trials ?? 0, pq.data?.trials ?? 0)}
        />
        <KpiTile
          label="Admissions"
          value={String(d?.converted ?? 0)}
          trend={pctChange(d?.converted ?? 0, pq.data?.converted ?? 0)}
        />
        <KpiTile
          label="Conversion %"
          value={`${d?.conversion ?? 0}%`}
          trend={pctChange(d?.conversion ?? 0, pq.data?.conversion ?? 0)}
        />
        <KpiTile
          label="Avg Convert"
          value={d?.avgConversionDays == null ? "—" : `${d.avgConversionDays}d`}
        />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts
          view="admissions"
          data={{ admissionsByStage: d?.byStage ?? [], bySource: d?.bySource ?? [] }}
        />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel
          title="Best sources"
          rows={(d?.bySource ?? [])
            .slice(0, 6)
            .map((r) => ({ label: r.label, value: String(r.count) }))}
        />
        <ListPanel
          title="Pipeline stage"
          rows={(d?.byStage ?? []).map((r) => ({ label: r.stage, value: String(r.count) }))}
        />
      </div>
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {best && (
            <InsightLi tone="good" text={`Best source: ${best.label} · ${best.count} leads`} />
          )}
          {worst && worst.label !== best?.label && (
            <InsightLi tone="warn" text={`Weakest source: ${worst.label} · ${worst.count} leads`} />
          )}
          {pending > 0 && (
            <InsightLi tone="warn" text={`${pending} new leads awaiting follow-up`} />
          )}
          <InsightLi
            tone={(d?.conversion ?? 0) >= 20 ? "good" : "warn"}
            text={`Conversion rate at ${d?.conversion ?? 0}%`}
          />
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// STUDENTS
// ============================================================

function StudentsReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.players(tenantId, range),
    queryFn: () => fetchPlayersReport(tenantId, range),
  });
  const attQ = useQuery({
    queryKey: rqk.attendance(tenantId, range),
    queryFn: () => fetchAttendanceReport(tenantId, range),
  });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile
          label="Students"
          value={String((d?.active ?? 0) + (d?.inactive ?? 0) + (d?.graduated ?? 0))}
        />
        <KpiTile label="Active" value={String(d?.active ?? 0)} />
        <KpiTile
          label="Inactive"
          value={String(d?.inactive ?? 0)}
          tone={d && d.inactive > 0 ? "warn" : "ok"}
        />
        <KpiTile label="New" value={String(d?.newInRange ?? 0)} />
        <KpiTile label="Retention %" value={`${d?.retention ?? 0}%`} />
      </KpiGrid>
      <div className="grid gap-3 md:grid-cols-3">
        <ListPanel
          title="By batch"
          rows={(d?.byBatch ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
        />
        <ListPanel
          title="By age group"
          rows={(d?.byAgeGroup ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
        />
        <ListPanel
          title="By role"
          rows={(d?.byRole ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
        />
      </div>
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {d?.byBatch?.[0] && (
            <InsightLi
              tone="good"
              text={`Fastest growing batch: ${d.byBatch[0].label} · ${d.byBatch[0].count} students`}
            />
          )}
          <InsightLi
            tone={(d?.inactive ?? 0) > 0 ? "warn" : "good"}
            text={`${d?.inactive ?? 0} inactive students`}
          />
          <InsightLi
            tone={
              (attQ.data?.lowStudents ?? []).filter((s) => s.percent < 60).length ? "warn" : "good"
            }
            text={`${(attQ.data?.lowStudents ?? []).filter((s) => s.percent < 60).length} students at attendance risk`}
          />
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// CRICKET
// ============================================================

function CricketReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.matches(tenantId, range),
    queryFn: () => fetchMatchesReport(tenantId, range),
  });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Matches" value={String(d?.total ?? 0)} />
        <KpiTile label="Completed" value={String(d?.completed ?? 0)} />
        <KpiTile label="Live" value={String(d?.live ?? 0)} />
        <KpiTile label="Upcoming" value={String(d?.upcoming ?? 0)} />
      </KpiGrid>
      <ListPanel
        title="By result / status"
        rows={(d?.byResult ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
      />
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {d?.byResult?.[0] && (
            <InsightLi
              tone="good"
              text={`Most active status: ${d.byResult[0].label} · ${d.byResult[0].count} matches`}
            />
          )}
          {(d?.live ?? 0) > 0 && (
            <InsightLi tone="good" text={`${d?.live} matches currently live`} />
          )}
          {(d?.upcoming ?? 0) > 0 && (
            <InsightLi tone="warn" text={`${d?.upcoming} upcoming matches to prepare`} />
          )}
        </ul>
      </Panel>
      <p className="text-xs text-muted-foreground">
        Detailed match analytics:{" "}
        <a href="/match-center/dashboard" className="underline">
          open Match Center
        </a>
        .
      </p>
    </div>
  );
}

// ============================================================
// COMMUNICATION
// ============================================================

function CommunicationReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.comms(tenantId, range),
    queryFn: () => fetchCommsReport(tenantId, range),
  });
  const d = q.data;
  const rate = d && d.sent > 0 ? Math.round((d.delivered / d.sent) * 100) : 0;
  const best = d?.byCategory?.[0];
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Broadcasts" value={String(d?.campaigns ?? 0)} />
        <KpiTile label="Sent" value={String(d?.sent ?? 0)} />
        <KpiTile label="Delivered" value={String(d?.delivered ?? 0)} hint={`${rate}%`} />
        <KpiTile
          label="Failed"
          value={String(d?.failed ?? 0)}
          tone={d && d.failed > 0 ? "warn" : "ok"}
        />
      </KpiGrid>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel
          title="By category"
          rows={(d?.byCategory ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
        />
        <ListPanel
          title="By status"
          rows={(d?.byStatus ?? []).map((r) => ({ label: r.label, value: String(r.count) }))}
        />
      </div>
      <Panel title="Insights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          {best && (
            <InsightLi
              tone="good"
              text={`Best performing category: ${best.label} · ${best.count} messages`}
            />
          )}
          <InsightLi tone={rate >= 90 ? "good" : "warn"} text={`Delivery rate at ${rate}%`} />
          {(d?.failed ?? 0) > 0 && (
            <InsightLi tone="warn" text={`${d?.failed} messages failed to deliver`} />
          )}
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// Shared UI
// ============================================================

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">{children}</div>;
}

function KpiTile({
  label,
  value,
  hint,
  trend,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  tone?: "ok" | "warn";
}) {
  const trendIcon =
    trend === undefined ? null : trend > 0 ? (
      <ArrowUp className="size-3" />
    ) : trend < 0 ? (
      <ArrowDown className="size-3" />
    ) : (
      <Minus className="size-3" />
    );
  const trendCls =
    trend === undefined
      ? ""
      : trend > 0
        ? "text-emerald-600"
        : trend < 0
          ? "text-rose-600"
          : "text-muted-foreground";
  return (
    <Card
      className={cn(
        "px-3 py-2.5 min-h-[88px] flex flex-col justify-between rounded-2xl border border-border/60",
        tone === "warn" && "border-amber-200/70 dark:border-amber-800/40",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <div
          className={cn(
            "text-xl sm:text-[22px] font-semibold tabular-nums leading-tight truncate",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
          )}
        >
          {value}
        </div>
        {trendIcon && (
          <span
            className={cn(
              "text-[11px] font-medium inline-flex items-center gap-0.5 shrink-0",
              trendCls,
            )}
          >
            {trendIcon}
            {Math.abs(trend!)}%
          </span>
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{hint}</div>}
    </Card>
  );
}

function Panel({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-4 rounded-2xl border border-border/60",
        tone === "warn" &&
          "border-amber-200/70 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10",
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function ListPanel({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { label: string; value: string; sub?: string; warn?: boolean }[];
  tone?: "warn";
}) {
  return (
    <Card
      className={cn(
        "p-4 rounded-2xl border border-border/60",
        tone === "warn" && "border-amber-200/70 dark:border-amber-800/40",
      )}
    >
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="divide-y divide-border/60">
        {rows.length === 0 && (
          <div className="py-3 text-sm text-muted-foreground">No data yet.</div>
        )}
        {rows.slice(0, 8).map((r, i) => (
          <div key={r.label + i} className="py-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground truncate min-w-0">{r.label}</span>
            <span className="flex items-center gap-2 shrink-0">
              {r.warn && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  low
                </Badge>
              )}
              <span className="font-medium tabular-nums">{r.value}</span>
              {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon} <span className="truncate">{label}</span>
      </div>
      <div className="text-sm font-semibold truncate mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function InsightLi({ tone, text }: { tone: "good" | "warn"; text: string }) {
  return (
    <li className="flex items-start gap-2">
      {tone === "good" ? (
        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
      )}
      <span className="min-w-0">{text}</span>
    </li>
  );
}

function ChartSkeleton() {
  return <div className="h-56 rounded-2xl bg-muted/40 animate-pulse" />;
}

// ============================================================
// Helpers
// ============================================================

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function rangeLabel(r: Range): string {
  const f = new Date(r.from),
    t = new Date(r.to);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(f)} — ${fmt(t)}`;
}

function topBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): T | undefined {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0))[0];
}

function buildHighlights(x: {
  curr: {
    att?: AttendanceReport;
    bill?: BillingReport;
    adm?: AdmissionsReport;
    ply?: PlayersReport;
  };
  prev: { att?: AttendanceReport; bill?: BillingReport; adm?: AdmissionsReport };
}): { text: string; tone: "good" | "warn" }[] {
  const out: { text: string; tone: "good" | "warn" }[] = [];
  const revC = pctChange(x.curr.bill?.revenue ?? 0, x.prev.bill?.revenue ?? 0);
  if (revC !== undefined && x.curr.bill) {
    out.push({
      text: `Revenue ${revC >= 0 ? "increased" : "decreased"} ${Math.abs(revC)}% vs previous period`,
      tone: revC >= 0 ? "good" : "warn",
    });
  }
  const attC = pctChange(x.curr.att?.percent ?? 0, x.prev.att?.percent ?? 0);
  if (attC !== undefined && x.curr.att) {
    out.push({
      text: `Attendance ${attC >= 0 ? "improved" : "dropped"} ${Math.abs(attC)}% this period`,
      tone: attC >= 0 ? "good" : "warn",
    });
  }
  if ((x.curr.bill?.pendingApprox ?? 0) > 0) {
    out.push({
      text: `Pending fees at ${inr(x.curr.bill!.pendingApprox)} across ${x.curr.bill!.pendingStudents} students`,
      tone: "warn",
    });
  }
  const convC = pctChange(x.curr.adm?.conversion ?? 0, x.prev.adm?.conversion ?? 0);
  if (
    convC !== undefined &&
    x.curr.adm &&
    (x.curr.adm.totalLeads > 0 || (x.prev.adm?.totalLeads ?? 0) > 0)
  ) {
    out.push({
      text: `Trial conversion ${convC >= 0 ? "up" : "down"} ${Math.abs(convC)}% vs previous`,
      tone: convC >= 0 ? "good" : "warn",
    });
  }
  const topBatch = x.curr.att?.perBatch?.[0];
  if (topBatch)
    out.push({ text: `${topBatch.batch} leads attendance at ${topBatch.percent}%`, tone: "good" });
  if ((x.curr.adm?.converted ?? 0) > 0) {
    out.push({ text: `${x.curr.adm!.converted} new admissions this period`, tone: "good" });
  }
  return out.slice(0, 6);
}

function buildAiSummary(x: {
  revenueTrend?: number;
  attendanceTrend?: number;
  conversion?: number;
  pendingStudents?: number;
  topBatch?: string;
}): { text: string; tone: "good" | "warn" }[] {
  const out: { text: string; tone: "good" | "warn" }[] = [];
  if (x.revenueTrend !== undefined) {
    out.push({
      text:
        x.revenueTrend >= 0
          ? "Revenue is growing steadily this period."
          : "Revenue is soft compared to the prior period.",
      tone: x.revenueTrend >= 0 ? "good" : "warn",
    });
  }
  if (x.attendanceTrend !== undefined) {
    out.push({
      text:
        x.attendanceTrend >= 0
          ? "Attendance is trending upward."
          : "Attendance is dipping — usually Mondays and evenings.",
      tone: x.attendanceTrend >= 0 ? "good" : "warn",
    });
  }
  if (x.topBatch)
    out.push({ text: `${x.topBatch} is currently your strongest batch.`, tone: "good" });
  if (typeof x.conversion === "number") {
    out.push({
      text:
        x.conversion >= 20
          ? "Admission funnel is converting well."
          : "Conversion rate has room to grow — trial follow-up matters.",
      tone: x.conversion >= 20 ? "good" : "warn",
    });
  }
  if ((x.pendingStudents ?? 0) > 0)
    out.push({ text: "Several students still carry pending balances.", tone: "warn" });
  return out;
}

function buildRecommendations(x: {
  pendingStudents: number;
  lowAttendance: number;
  newLeads: number;
}): string[] {
  const out: string[] = [];
  if (x.pendingStudents > 0)
    out.push(`Send fee reminders to ${x.pendingStudents} students with pending balances.`);
  if (x.lowAttendance > 0)
    out.push(`Schedule a check-in with the ${x.lowAttendance} students below 60% attendance.`);
  if (x.newLeads > 0) out.push(`Follow up with ${x.newLeads} unanswered enquiries this week.`);
  out.push("Run a weekend trial camp to lift conversion.");
  return out.slice(0, 5);
}
