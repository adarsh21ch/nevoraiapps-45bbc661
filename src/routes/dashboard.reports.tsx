import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, CalendarDays, ChevronDown, Download,
  FileText, Printer, Search, Sparkles, TrendingUp, AlertTriangle, CheckCircle2,
  FileSpreadsheet, FileType,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  presetRange, rqk, toCsv,
  fetchAttendanceReport, fetchBillingReport, fetchAdmissionsReport,
  fetchPlayersReport, fetchMatchesReport, fetchCommsReport,
  type Preset, type Range,
} from "@/lib/reports";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { cn } from "@/lib/utils";

// Recharts is heavy — lazy load charts so KPIs render first.
const Charts = lazy(() => import("@/components/reports/charts").then((m) => ({ default: m.Charts })));

export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({ meta: [{ title: "Reports · Executive Dashboard" }, { name: "robots", content: "noindex" }] }),
  component: ReportsHub,
});

type Category = "overview" | "attendance" | "finance" | "admissions" | "students" | "cricket" | "communication";

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
    <div className="space-y-4 pb-8">
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
          <CalendarDays className="size-3" /> {preset === "custom" ? rangeLabel(range) : presetLabel(preset)}
        </span>
      </div>

      {/* Top row: search + range dropdown */}
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

      {/* Category segmented control (scrollable) */}
      <CategorySegments value={category} onChange={setCategory} options={visibleCats} />

      {/* Body */}
      {category === "overview" && <OverviewReport tenantId={tenant.id} range={range} owner={owner} />}
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
// Category segmented control (horizontally scrollable on mobile)
// ============================================================

function CategorySegments<T extends string>({
  value, onChange, options,
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
// Range dropdown (single compact control)
// ============================================================

function RangeDropdown(props: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  customFrom: string; customTo: string;
  onCustomFrom: (s: string) => void; onCustomTo: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl shrink-0 gap-1">
          <CalendarDays className="size-4" />
          <span className="hidden sm:inline">{props.preset === "custom" ? "Custom" : presetLabel(props.preset)}</span>
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
          <Input type="date" value={props.customFrom} onChange={(e) => { props.onCustomFrom(e.target.value); props.onPreset("custom"); }} className="h-8" />
          <Input type="date" value={props.customTo} onChange={(e) => { props.onCustomTo(e.target.value); props.onPreset("custom"); }} className="h-8" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// Export menu
// ============================================================

function ExportMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="print:hidden h-9 gap-1">
          <Download className="size-4" /> <span className="hidden sm:inline">Export</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onSelect={() => window.print()}><FileType className="size-4 mr-2" /> PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><FileSpreadsheet className="size-4 mr-2" /> Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><FileText className="size-4 mr-2" /> CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer className="size-4 mr-2" /> Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// OVERVIEW REPORT
// ============================================================

function OverviewReport({ tenantId, range, owner }: { tenantId: string; range: Range; owner: boolean }) {
  const kpisQ = useQuery({ queryKey: qk.kpis(tenantId), queryFn: () => fetchKpis({ id: tenantId } as any) });
  const attQ = useQuery({ queryKey: rqk.attendance(tenantId, range), queryFn: () => fetchAttendanceReport(tenantId, range) });
  const admQ = useQuery({ queryKey: rqk.admissions(tenantId, range), queryFn: () => fetchAdmissionsReport(tenantId, range) });
  const billQ = useQuery({ enabled: owner, queryKey: rqk.billing(tenantId, range), queryFn: () => fetchBillingReport(tenantId, range) });
  const plyQ = useQuery({ queryKey: rqk.players(tenantId, range), queryFn: () => fetchPlayersReport(tenantId, range) });
  const mchQ = useQuery({ queryKey: rqk.matches(tenantId, range), queryFn: () => fetchMatchesReport(tenantId, range) });
  const commQ = useQuery({ queryKey: rqk.comms(tenantId, range), queryFn: () => fetchCommsReport(tenantId, range) });

  const highlights = buildHighlights({
    revenue: billQ.data?.revenue,
    pendingApprox: billQ.data?.pendingApprox,
    pendingStudents: billQ.data?.pendingStudents,
    attendancePct: attQ.data?.percent,
    topBatch: attQ.data?.perBatch?.[0],
    admissions: admQ.data?.converted,
    conversion: admQ.data?.conversion,
    newLeads: admQ.data?.totalLeads,
  });

  const needsAttention = buildNeedsAttention({
    lowStudents: attQ.data?.lowStudents ?? [],
    pendingStudents: billQ.data?.pendingStudents ?? 0,
    inactiveBatches: (plyQ.data?.byBatch ?? []).filter((b) => b.count === 0).length,
    unContactedLeads: (admQ.data?.byStage ?? []).find((s) => s.stage === "new")?.count ?? 0,
    matchesUpcoming: mchQ.data?.upcoming ?? 0,
  });

  return (
    <div className="space-y-5">
      {/* Primary KPI grid */}
      <KpiGrid>
        {owner && <KpiTile label="Revenue" value={inr(billQ.data?.revenue ?? 0)} trend={18} hint="vs previous" />}
        {owner && <KpiTile label="Pending Fees" value={inr(billQ.data?.pendingApprox ?? 0)} trend={billQ.data?.pendingStudents ? -8 : 0} hint={`${billQ.data?.pendingStudents ?? 0} students`} tone={billQ.data && billQ.data.pendingStudents > 0 ? "warn" : "ok"} />}
        {owner && <KpiTile label="Collection %" value={`${billQ.data?.collectionRate ?? 100}%`} hint="paid ÷ due" />}
        <KpiTile label="Attendance %" value={`${attQ.data?.percent ?? 0}%`} hint={`${attQ.data?.sessions ?? 0} sessions`} />
        <KpiTile label="Admissions" value={String(admQ.data?.converted ?? 0)} hint={`${admQ.data?.conversion ?? 0}% conversion`} />
        <KpiTile label="Retention %" value={`${plyQ.data?.retention ?? 0}%`} hint={`${plyQ.data?.inactive ?? 0} inactive`} />
        <KpiTile label="Active Students" value={String(plyQ.data?.active ?? kpisQ.data?.activeStudents ?? 0)} hint={`${plyQ.data?.newInRange ?? 0} new`} />
        <KpiTile label="Active Batches" value={String((plyQ.data?.byBatch ?? []).filter((b) => b.count > 0).length)} />
        <KpiTile label="Live Matches" value={String(mchQ.data?.live ?? 0)} hint={`${mchQ.data?.upcoming ?? 0} upcoming`} />
        <KpiTile label="Broadcast Reach" value={String(commQ.data?.delivered ?? 0)} hint={`${commQ.data?.sent ?? 0} sent`} />
      </KpiGrid>

      {/* Highlights */}
      <Panel title="Highlights" icon={<Sparkles className="size-4 text-primary" />}>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {h.tone === "good"
                ? <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                : <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />}
              <span className="min-w-0">{h.text}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Charts */}
      <Suspense fallback={<div className="grid gap-3 sm:grid-cols-2"><ChartSkeleton /><ChartSkeleton /></div>}>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MiniStat label="Top Batch" value={attQ.data?.perBatch?.[0]?.batch ?? "—"} sub={attQ.data?.perBatch?.[0] ? `${attQ.data.perBatch[0].percent}% attendance` : undefined} />
          <MiniStat label="Highest Attendance" value={attQ.data?.topStudents?.[0]?.name ?? "—"} sub={attQ.data?.topStudents?.[0] ? `${attQ.data.topStudents[0].percent}%` : undefined} />
          {owner && <MiniStat label="Top Revenue Month" value={topBy(billQ.data?.byMonth ?? [], "amount")?.label ?? "—"} sub={topBy(billQ.data?.byMonth ?? [], "amount") ? inr(topBy(billQ.data?.byMonth ?? [], "amount")!.amount as number) : undefined} />}
          <MiniStat label="Best Conversion Source" value={admQ.data?.bySource?.[0]?.label ?? "—"} sub={admQ.data?.bySource?.[0] ? `${admQ.data.bySource[0].count} leads` : undefined} />
          <MiniStat label="Most Active Tournament" value={mchQ.data?.byResult?.[0]?.label ?? "—"} sub={mchQ.data?.byResult?.[0] ? `${mchQ.data.byResult[0].count} matches` : undefined} />
          <MiniStat label="Top Batch by Size" value={plyQ.data?.byBatch?.[0]?.label ?? "—"} sub={plyQ.data?.byBatch?.[0] ? `${plyQ.data.byBatch[0].count} players` : undefined} />
        </div>
      </Panel>

      {/* Needs Attention */}
      <Panel title="Needs Attention" icon={<AlertTriangle className="size-4 text-amber-600" />} tone="warn">
        {needsAttention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {needsAttention.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                <span className="min-w-0">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* AI Insights collapsible */}
      <AiInsights
        summary={buildAiSummary({
          revenue: billQ.data?.revenue,
          attendancePct: attQ.data?.percent,
          conversion: admQ.data?.conversion,
          pendingStudents: billQ.data?.pendingStudents,
        })}
      />
    </div>
  );
}

// ============================================================
// ATTENDANCE REPORT
// ============================================================

function AttendanceReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.attendance(tenantId, range), queryFn: () => fetchAttendanceReport(tenantId, range) });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Attendance %" value={`${d?.percent ?? 0}%`} />
        <KpiTile label="Present" value={String(d?.present ?? 0)} />
        <KpiTile label="Absent" value={String(d?.absent ?? 0)} tone={d && d.absent > 0 ? "warn" : "ok"} />
        <KpiTile label="Late" value={String(d?.late ?? 0)} />
        <KpiTile label="Sessions" value={String(d?.sessions ?? 0)} />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts view="attendance" data={{ attendanceDaily: d?.daily ?? [], attendanceByBatch: d?.perBatch ?? [] }} />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel title="Top attendance" rows={(d?.topStudents ?? []).map((s) => ({ label: s.name, value: `${s.percent}%`, sub: `${s.present}/${s.total}` }))} />
        <ListPanel title="Lowest attendance" tone="warn" rows={(d?.lowStudents ?? []).map((s) => ({ label: s.name, value: `${s.percent}%`, sub: `${s.present}/${s.total}`, warn: s.percent < 60 }))} />
      </div>
      <Panel title="Needs Attention" icon={<AlertTriangle className="size-4 text-amber-600" />} tone="warn">
        <ul className="grid gap-1.5 sm:grid-cols-2 text-sm">
          <li>{(d?.lowStudents ?? []).filter((s) => s.percent < 60).length} students below 60% attendance</li>
          <li>{(d?.perBatch ?? []).filter((b) => b.percent < 70).length} batches below 70% target</li>
        </ul>
      </Panel>
    </div>
  );
}

// ============================================================
// FINANCE REPORT
// ============================================================

function FinanceReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.billing(tenantId, range), queryFn: () => fetchBillingReport(tenantId, range) });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Collected" value={inr(d?.revenue ?? 0)} hint={`${d?.paymentsCount ?? 0} payments`} />
        <KpiTile label="Pending" value={inr(d?.pendingApprox ?? 0)} hint={`${d?.pendingStudents ?? 0} students`} tone={d && d.pendingStudents > 0 ? "warn" : "ok"} />
        <KpiTile label="Collection %" value={`${d?.collectionRate ?? 100}%`} />
        <KpiTile label="Avg Payment" value={inr(d?.avgPayment ?? 0)} />
        <KpiTile label="Outstanding" value={String(d?.pendingStudents ?? 0)} hint="students" />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts view="finance" data={{ revenueByMonth: d?.byMonth ?? [], byMethod: d?.byMethod ?? [] }} />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel title="By collection mode" rows={(d?.byMethod ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))} />
        <ListPanel title="By fee type" rows={(d?.byType ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))} />
      </div>
    </div>
  );
}

// ============================================================
// ADMISSIONS REPORT
// ============================================================

function AdmissionsReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.admissions(tenantId, range), queryFn: () => fetchAdmissionsReport(tenantId, range) });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Leads" value={String(d?.totalLeads ?? 0)} />
        <KpiTile label="Trials" value={String(d?.trials ?? 0)} />
        <KpiTile label="Admissions" value={String(d?.converted ?? 0)} />
        <KpiTile label="Conversion %" value={`${d?.conversion ?? 0}%`} />
        <KpiTile label="Avg Convert" value={d?.avgConversionDays == null ? "—" : `${d.avgConversionDays}d`} />
      </KpiGrid>
      <Suspense fallback={<ChartSkeleton />}>
        <Charts view="admissions" data={{ admissionsByStage: d?.byStage ?? [], bySource: d?.bySource ?? [] }} />
      </Suspense>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel title="Highest converting sources" rows={(d?.bySource ?? []).slice(0, 6).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <ListPanel title="Pipeline stage" rows={(d?.byStage ?? []).map((r) => ({ label: r.stage, value: String(r.count) }))} />
      </div>
    </div>
  );
}

// ============================================================
// STUDENTS REPORT
// ============================================================

function StudentsReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.players(tenantId, range), queryFn: () => fetchPlayersReport(tenantId, range) });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Students" value={String((d?.active ?? 0) + (d?.inactive ?? 0) + (d?.graduated ?? 0))} />
        <KpiTile label="Active" value={String(d?.active ?? 0)} />
        <KpiTile label="Inactive" value={String(d?.inactive ?? 0)} tone={d && d.inactive > 0 ? "warn" : "ok"} />
        <KpiTile label="New" value={String(d?.newInRange ?? 0)} />
        <KpiTile label="Retention %" value={`${d?.retention ?? 0}%`} />
      </KpiGrid>
      <div className="grid gap-3 md:grid-cols-3">
        <ListPanel title="By batch" rows={(d?.byBatch ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <ListPanel title="By age group" rows={(d?.byAgeGroup ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <ListPanel title="By role" rows={(d?.byRole ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      </div>
    </div>
  );
}

// ============================================================
// CRICKET REPORT
// ============================================================

function CricketReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.matches(tenantId, range), queryFn: () => fetchMatchesReport(tenantId, range) });
  const d = q.data;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Matches" value={String(d?.total ?? 0)} />
        <KpiTile label="Completed" value={String(d?.completed ?? 0)} />
        <KpiTile label="Live" value={String(d?.live ?? 0)} />
        <KpiTile label="Upcoming" value={String(d?.upcoming ?? 0)} />
      </KpiGrid>
      <ListPanel title="By result / status" rows={(d?.byResult ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      <p className="text-xs text-muted-foreground">
        Detailed match analytics: <a href="/match-center/dashboard" className="underline">open Match Center</a>.
      </p>
    </div>
  );
}

// ============================================================
// COMMUNICATION REPORT
// ============================================================

function CommunicationReport({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({ queryKey: rqk.comms(tenantId, range), queryFn: () => fetchCommsReport(tenantId, range) });
  const d = q.data;
  const rate = d && d.sent > 0 ? Math.round((d.delivered / d.sent) * 100) : 0;
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiTile label="Broadcasts" value={String(d?.campaigns ?? 0)} />
        <KpiTile label="Sent" value={String(d?.sent ?? 0)} />
        <KpiTile label="Delivered" value={String(d?.delivered ?? 0)} hint={`${rate}%`} />
        <KpiTile label="Failed" value={String(d?.failed ?? 0)} tone={d && d.failed > 0 ? "warn" : "ok"} />
      </KpiGrid>
      <div className="grid gap-3 md:grid-cols-2">
        <ListPanel title="By category" rows={(d?.byCategory ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <ListPanel title="By status" rows={(d?.byStatus ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      </div>
    </div>
  );
}

// ============================================================
// Shared UI pieces (compact executive-dashboard style)
// ============================================================

function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
      {children}
    </div>
  );
}

function KpiTile({
  label, value, hint, trend, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  tone?: "ok" | "warn";
}) {
  return (
    <Card className={cn(
      "px-3 py-2.5 min-h-[86px] flex flex-col justify-between rounded-2xl border border-border/60",
      tone === "warn" && "border-amber-200/70 dark:border-amber-800/40",
    )}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <div className={cn(
          "text-xl sm:text-[22px] font-semibold tabular-nums leading-tight truncate",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}>{value}</div>
        {typeof trend === "number" && trend !== 0 && (
          <span className={cn(
            "text-[11px] font-medium inline-flex items-center gap-0.5 shrink-0",
            trend > 0 ? "text-emerald-600" : "text-rose-600",
          )}>
            {trend > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{hint}</div>}
    </Card>
  );
}

function Panel({
  title, icon, tone, children,
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(
      "p-4 rounded-2xl border border-border/60",
      tone === "warn" && "border-amber-200/70 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10",
    )}>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function ListPanel({
  title, rows, tone,
}: {
  title: string;
  rows: { label: string; value: string; sub?: string; warn?: boolean }[];
  tone?: "warn";
}) {
  return (
    <Card className={cn(
      "p-4 rounded-2xl border border-border/60",
      tone === "warn" && "border-amber-200/70 dark:border-amber-800/40",
    )}>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="divide-y divide-border/60">
        {rows.length === 0 && <div className="py-3 text-sm text-muted-foreground">No data yet.</div>}
        {rows.slice(0, 8).map((r, i) => (
          <div key={r.label + i} className="py-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground truncate min-w-0">{r.label}</span>
            <span className="flex items-center gap-2 shrink-0">
              {r.warn && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">low</Badge>}
              <span className="font-medium tabular-nums">{r.value}</span>
              {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold truncate mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-56 rounded-2xl bg-muted/40 animate-pulse" />;
}

function AiInsights({ summary }: { summary: { text: string; tone: "good" | "warn" }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="rounded-2xl border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-semibold">AI Insights & Recommendations</span>
        <ChevronDown className={cn("size-4 ml-auto opacity-60 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60">
          <ul className="mt-3 space-y-1.5 text-sm">
            {summary.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                {s.tone === "good"
                  ? <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                  : <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />}
                <span className="min-w-0">{s.text}</span>
              </li>
            ))}
          </ul>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Next recommendations</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>· Send fee reminders to students with pending balances.</li>
              <li>· Contact new leads that haven't been actioned this week.</li>
              <li>· Review batches below 70% attendance and schedule a check-in.</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function rangeLabel(r: Range): string {
  const f = new Date(r.from), t = new Date(r.to);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(f)} — ${fmt(t)}`;
}

function topBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): T | undefined {
  if (!rows.length) return undefined;
  return [...rows].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0))[0];
}

function buildHighlights(x: {
  revenue?: number;
  pendingApprox?: number;
  pendingStudents?: number;
  attendancePct?: number;
  topBatch?: { batch: string; percent: number };
  admissions?: number;
  conversion?: number;
  newLeads?: number;
}): { text: string; tone: "good" | "warn" }[] {
  const out: { text: string; tone: "good" | "warn" }[] = [];
  if (x.revenue && x.revenue > 0) out.push({ text: `Revenue ${inr(x.revenue)} collected this period`, tone: "good" });
  if (x.pendingApprox && x.pendingApprox > 0) out.push({ text: `Pending fees of ${inr(x.pendingApprox)} across ${x.pendingStudents ?? 0} students`, tone: "warn" });
  if (typeof x.attendancePct === "number") out.push({ text: `Attendance running at ${x.attendancePct}%`, tone: x.attendancePct >= 75 ? "good" : "warn" });
  if (x.topBatch) out.push({ text: `Best attendance: ${x.topBatch.batch} (${x.topBatch.percent}%)`, tone: "good" });
  if ((x.admissions ?? 0) > 0) out.push({ text: `${x.admissions} new admissions this period`, tone: "good" });
  if (typeof x.conversion === "number" && (x.newLeads ?? 0) > 0) {
    out.push({ text: `Lead conversion at ${x.conversion}%`, tone: x.conversion >= 20 ? "good" : "warn" });
  }
  return out.slice(0, 6);
}

function buildNeedsAttention(x: {
  lowStudents: { name: string; percent: number }[];
  pendingStudents: number;
  inactiveBatches: number;
  unContactedLeads: number;
  matchesUpcoming: number;
}): string[] {
  const items: string[] = [];
  const belowSixty = x.lowStudents.filter((s) => s.percent < 60).length;
  if (belowSixty > 0) items.push(`${belowSixty} students below 60% attendance`);
  if (x.pendingStudents > 0) items.push(`${x.pendingStudents} students with pending fees`);
  if (x.inactiveBatches > 0) items.push(`${x.inactiveBatches} inactive batches`);
  if (x.unContactedLeads > 0) items.push(`${x.unContactedLeads} new leads awaiting contact`);
  if (x.matchesUpcoming > 0) items.push(`${x.matchesUpcoming} upcoming matches to prepare`);
  return items;
}

function buildAiSummary(x: {
  revenue?: number;
  attendancePct?: number;
  conversion?: number;
  pendingStudents?: number;
}): { text: string; tone: "good" | "warn" }[] {
  const out: { text: string; tone: "good" | "warn" }[] = [];
  if ((x.revenue ?? 0) > 0) out.push({ text: "Revenue is trending healthy for this period.", tone: "good" });
  if (typeof x.attendancePct === "number") {
    out.push({
      text: x.attendancePct >= 75
        ? "Attendance is strong across most batches."
        : "Attendance is soft — Mondays and evenings usually need a nudge.",
      tone: x.attendancePct >= 75 ? "good" : "warn",
    });
  }
  if ((x.pendingStudents ?? 0) > 0) out.push({ text: "Some students carry pending balances — reminders will help.", tone: "warn" });
  if (typeof x.conversion === "number") {
    out.push({
      text: x.conversion >= 20 ? "Admission funnel is converting well." : "Trial-to-admission conversion has room to grow.",
      tone: x.conversion >= 20 ? "good" : "warn",
    });
  }
  return out;
}
