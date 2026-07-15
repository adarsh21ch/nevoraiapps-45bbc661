import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart,
} from "recharts";
import { Download, Printer, Search } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  presetRange, rqk, toCsv,
  fetchAttendanceReport, fetchBillingReport, fetchAdmissionsReport,
  fetchPlayersReport, fetchMatchesReport, fetchCommsReport, fetchWebsiteReport,
  type Preset, type Range,
} from "@/lib/reports";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { ModuleHeader } from "@/components/shared/ModuleHeader";


export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({ meta: [{ title: "Reports · Decision Center" }, { name: "robots", content: "noindex" }] }),
  component: ReportsHub,
});

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
];

function ReportsHub() {
  const { tenant, profile } = useDashboard();
  const owner = isOwner(profile);
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");

  const range: Range = useMemo(() => {
    if (preset === "custom" && customFrom && customTo) {
      return {
        from: new Date(customFrom).toISOString(),
        to: new Date(new Date(customTo).setHours(23, 59, 59, 999)).toISOString(),
      };
    }
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decision Center</h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel(range)} · {tenant.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search reports…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-56"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
            <Printer className="size-4 mr-1" /> Print
          </Button>
        </div>
      </header>

      <FilterBar
        preset={preset}
        onPreset={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
      />

      <OverviewCards tenantId={tenant.id} range={range} owner={owner} />

      <Tabs defaultValue="attendance" className="space-y-3">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {visibleTabs(owner)
            .filter((t) => !search || t.label.toLowerCase().includes(search.toLowerCase()))
            .map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
        </TabsList>

        <TabsContent value="attendance"><AttendanceTab tenantId={tenant.id} range={range} /></TabsContent>
        <TabsContent value="admissions"><AdmissionsTab tenantId={tenant.id} range={range} /></TabsContent>
        {owner && <TabsContent value="billing"><BillingTab tenantId={tenant.id} range={range} /></TabsContent>}
        <TabsContent value="players"><PlayersTab tenantId={tenant.id} range={range} /></TabsContent>
        <TabsContent value="matches"><MatchesTab tenantId={tenant.id} range={range} /></TabsContent>
        <TabsContent value="communications"><CommsTab tenantId={tenant.id} range={range} /></TabsContent>
        <TabsContent value="website"><WebsiteTab tenantId={tenant.id} range={range} /></TabsContent>
      </Tabs>
    </div>
  );
}

function visibleTabs(owner: boolean) {
  const t = [
    { value: "attendance",    label: "Attendance" },
    { value: "admissions",    label: "Admissions" },
    { value: "billing",       label: "Fees",   ownerOnly: true },
    { value: "players",       label: "Players" },
    { value: "matches",       label: "Matches" },
    { value: "communications", label: "Communications" },
    { value: "website",       label: "Website" },
  ];
  return t.filter((x) => (x.ownerOnly ? owner : true));
}

function FilterBar(props: {
  preset: Preset;
  onPreset: (p: Preset) => void;
  customFrom: string; customTo: string;
  onCustomFrom: (s: string) => void; onCustomTo: (s: string) => void;
}) {
  return (
    <Card className="p-2 flex flex-wrap items-center gap-1 print:hidden">
      {PRESETS.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant={props.preset === p.key ? "default" : "ghost"}
          onClick={() => props.onPreset(p.key)}
        >{p.label}</Button>
      ))}
      <Button
        size="sm"
        variant={props.preset === "custom" ? "default" : "ghost"}
        onClick={() => props.onPreset("custom")}
      >Custom</Button>
      {props.preset === "custom" && (
        <div className="flex items-center gap-1 ml-2">
          <Input type="date" value={props.customFrom} onChange={(e) => props.onCustomFrom(e.target.value)} className="h-8 w-36" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={props.customTo} onChange={(e) => props.onCustomTo(e.target.value)} className="h-8 w-36" />
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Overview / Decision Center
// ============================================================

function OverviewCards({ tenantId, range, owner }: { tenantId: string; range: Range; owner: boolean }) {
  const kpisQ = useQuery({
    queryKey: qk.kpis(tenantId),
    queryFn: () => fetchKpis({ id: tenantId } as any),
  });
  const attQ = useQuery({
    queryKey: rqk.attendance(tenantId, range),
    queryFn: () => fetchAttendanceReport(tenantId, range),
  });
  const admQ = useQuery({
    queryKey: rqk.admissions(tenantId, range),
    queryFn: () => fetchAdmissionsReport(tenantId, range),
  });
  const billQ = useQuery({
    enabled: owner,
    queryKey: rqk.billing(tenantId, range),
    queryFn: () => fetchBillingReport(tenantId, range),
  });
  const plyQ = useQuery({
    queryKey: rqk.players(tenantId, range),
    queryFn: () => fetchPlayersReport(tenantId, range),
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {owner && <Kpi label="Revenue" value={inr(billQ.data?.revenue ?? 0)} hint={`${billQ.data?.paymentsCount ?? 0} payments`} />}
      {owner && <Kpi label="Pending" value={inr(billQ.data?.pendingApprox ?? 0)} hint={`${billQ.data?.pendingStudents ?? 0} students`} tone={billQ.data && billQ.data.pendingStudents > 0 ? "warn" : "ok"} />}
      {owner && <Kpi label="Collection" value={`${billQ.data?.collectionRate ?? 100}%`} hint="paid ÷ due" />}
      <Kpi label="Attendance" value={`${attQ.data?.percent ?? 0}%`} hint={`${attQ.data?.sessions ?? 0} sessions`} />
      <Kpi label="New leads"  value={String(admQ.data?.totalLeads ?? 0)} hint={`${admQ.data?.trials ?? 0} in trial`} />
      <Kpi label="Conversion" value={`${admQ.data?.conversion ?? 0}%`} hint={`${admQ.data?.converted ?? 0} enrolled`} />
      <Kpi label="Active players" value={String(plyQ.data?.active ?? kpisQ.data?.activeStudents ?? 0)} hint={`${plyQ.data?.newInRange ?? 0} new`} />
      <Kpi label="Retention" value={`${plyQ.data?.retention ?? 0}%`} hint={`${plyQ.data?.inactive ?? 0} inactive`} />
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

// ============================================================
// Attendance
// ============================================================

function AttendanceTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.attendance(tenantId, range),
    queryFn: () => fetchAttendanceReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section
      title="Attendance"
      onExport={() => d && toCsv(d.daily.map((x) => ({ Date: x.date, Present: x.present, Absent: x.absent, Percent: x.percent })), "attendance.csv")}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Overall" value={`${d?.percent ?? 0}%`} hint={`${d?.present ?? 0} present`} />
        <Kpi label="Sessions" value={String(d?.sessions ?? 0)} />
        <Kpi label="Total marks" value={String(d?.totalMarks ?? 0)} />
        <Kpi label="Late" value={String(d?.late ?? 0)} tone={d && d.late > 5 ? "warn" : undefined} />
      </div>
      <ChartCard title="Daily attendance %">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={d?.daily ?? []}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
            <Tooltip />
            <Line type="monotone" dataKey="percent" stroke="var(--brand, #1d4ed8)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="grid md:grid-cols-2 gap-3">
        <BreakdownCard title="By batch" rows={(d?.perBatch ?? []).map((b) => ({ label: b.batch, value: `${b.percent}%`, sub: `${b.present}/${b.total}` }))} />
        <div className="grid grid-cols-1 gap-3">
          <ListCard title="Top attendance" rows={(d?.topStudents ?? []).map((s) => ({ label: s.name, value: `${s.percent}%`, sub: `${s.present}/${s.total}` }))} />
          <ListCard title="Needs attention" rows={(d?.lowStudents ?? []).map((s) => ({ label: s.name, value: `${s.percent}%`, sub: `${s.present}/${s.total}`, warn: s.percent < 60 }))} />
        </div>
      </div>
    </Section>
  );
}

// ============================================================
// Billing (owner only)
// ============================================================

function BillingTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.billing(tenantId, range),
    queryFn: () => fetchBillingReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section title="Fees & Collections" onExport={() => d && toCsv(d.byMonth.map((m) => ({ Month: m.label, Amount: m.amount })), "fees.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Fees collected" value={inr(d?.revenue ?? 0)} hint={`${d?.paymentsCount ?? 0} collections`} />
        <Kpi label="Avg collection" value={inr(d?.avgPayment ?? 0)} />
        <Kpi label="Pending fees" value={inr(d?.pendingApprox ?? 0)} hint={`${d?.pendingStudents ?? 0} students`} tone={d && d.pendingStudents > 0 ? "warn" : undefined} />
        <Kpi label="Collection rate" value={`${d?.collectionRate ?? 100}%`} />
      </div>
      <ChartCard title="Fees collected by month">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d?.byMonth ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
            <Tooltip formatter={(v: number) => [inr(Number(v)), "Fees collected"]} />
            <Bar dataKey="amount" fill="var(--brand, #1d4ed8)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="grid md:grid-cols-2 gap-3">
        <BreakdownCard title="By collection mode" rows={(d?.byMethod ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))} />
        <BreakdownCard title="By fee type"     rows={(d?.byType   ?? []).map((r) => ({ label: r.label, value: inr(r.amount) }))} />
      </div>
    </Section>
  );
}

// ============================================================
// Admissions
// ============================================================

function AdmissionsTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.admissions(tenantId, range),
    queryFn: () => fetchAdmissionsReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section title="Admissions & Leads" onExport={() => d && toCsv(d.byStage.map((s) => ({ Stage: s.stage, Count: s.count })), "admissions.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Leads" value={String(d?.totalLeads ?? 0)} />
        <Kpi label="Trials+" value={String(d?.trials ?? 0)} />
        <Kpi label="Converted" value={String(d?.converted ?? 0)} hint={`${d?.conversion ?? 0}%`} />
        <Kpi label="Avg convert" value={d?.avgConversionDays == null ? "—" : `${d.avgConversionDays}d`} />
      </div>
      <ChartCard title="Pipeline funnel">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d?.byStage ?? []} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="stage" fontSize={11} tickLine={false} axisLine={false} width={90} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--brand, #1d4ed8)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <BreakdownCard title="By source" rows={(d?.bySource ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
    </Section>
  );
}

// ============================================================
// Players
// ============================================================

function PlayersTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.players(tenantId, range),
    queryFn: () => fetchPlayersReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section title="Players" onExport={() => d && toCsv(d.byBatch.map((b) => ({ Batch: b.label, Count: b.count })), "players.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active" value={String(d?.active ?? 0)} />
        <Kpi label="Inactive" value={String(d?.inactive ?? 0)} tone={d && d.inactive > 0 ? "warn" : undefined} />
        <Kpi label="Graduated" value={String(d?.graduated ?? 0)} />
        <Kpi label="New in range" value={String(d?.newInRange ?? 0)} />
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <BreakdownCard title="By batch"     rows={(d?.byBatch    ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <BreakdownCard title="By age group" rows={(d?.byAgeGroup ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <BreakdownCard title="By role"      rows={(d?.byRole     ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      </div>
    </Section>
  );
}

// ============================================================
// Matches
// ============================================================

function MatchesTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.matches(tenantId, range),
    queryFn: () => fetchMatchesReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section title="Matches" onExport={() => d && toCsv(d.byResult.map((r) => ({ Result: r.label, Count: r.count })), "matches.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total" value={String(d?.total ?? 0)} />
        <Kpi label="Completed" value={String(d?.completed ?? 0)} />
        <Kpi label="Live" value={String(d?.live ?? 0)} />
        <Kpi label="Upcoming" value={String(d?.upcoming ?? 0)} />
      </div>
      <BreakdownCard title="By result / status" rows={(d?.byResult ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      <p className="text-xs text-muted-foreground px-1">
        Detailed match analytics: <a href="/match-center/dashboard" className="underline">open Match Center</a>.
      </p>
    </Section>
  );
}

// ============================================================
// Communications
// ============================================================

function CommsTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.comms(tenantId, range),
    queryFn: () => fetchCommsReport(tenantId, range),
  });
  const d = q.data;
  const rate = d && d.sent > 0 ? Math.round(((d.delivered) / d.sent) * 100) : 0;
  return (
    <Section title="Communications" onExport={() => d && toCsv(d.byCategory.map((c) => ({ Category: c.label, Count: c.count })), "comms.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Campaigns" value={String(d?.campaigns ?? 0)} />
        <Kpi label="Sent" value={String(d?.sent ?? 0)} />
        <Kpi label="Delivered" value={String(d?.delivered ?? 0)} hint={`${rate}%`} />
        <Kpi label="Failed" value={String(d?.failed ?? 0)} tone={d && d.failed > 0 ? "warn" : undefined} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <BreakdownCard title="By category" rows={(d?.byCategory ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
        <BreakdownCard title="By status"   rows={(d?.byStatus   ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
      </div>
    </Section>
  );
}

// ============================================================
// Website
// ============================================================

function WebsiteTab({ tenantId, range }: { tenantId: string; range: Range }) {
  const q = useQuery({
    queryKey: rqk.website(tenantId, range),
    queryFn: () => fetchWebsiteReport(tenantId, range),
  });
  const d = q.data;
  return (
    <Section title="Website" onExport={() => d && toCsv(d.bySource.map((s) => ({ Source: s.label, Count: s.count })), "website.csv")}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Registrations" value={String(d?.webRegistrations ?? 0)} />
        <Kpi label="Leads" value={String(d?.webLeads ?? 0)} />
        <Kpi label="Sources" value={String(d?.bySource.length ?? 0)} />
      </div>
      <BreakdownCard title="Leads by source" rows={(d?.bySource ?? []).map((r) => ({ label: r.label, value: String(r.count) }))} />
    </Section>
  );
}

// ============================================================
// Shared UI pieces
// ============================================================

function Section({ title, onExport, children }: { title: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} className="print:hidden">
            <Download className="size-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="h-56">{children}</div>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: string; sub?: string }[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="divide-y">
        {rows.length === 0 && <div className="py-3 text-sm text-muted-foreground">No data yet.</div>}
        {rows.map((r) => (
          <div key={r.label} className="py-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums">
              {r.value}{r.sub && <span className="text-xs text-muted-foreground ml-2">{r.sub}</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ListCard({ title, rows }: { title: string; rows: { label: string; value: string; sub?: string; warn?: boolean }[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="divide-y">
        {rows.length === 0 && <div className="py-3 text-sm text-muted-foreground">No data yet.</div>}
        {rows.map((r, i) => (
          <div key={r.label + i} className="py-2 flex items-center justify-between text-sm">
            <span className="text-foreground">{r.label}</span>
            <span className="flex items-center gap-2">
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

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function rangeLabel(r: Range): string {
  const f = new Date(r.from), t = new Date(r.to);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(f)} — ${fmt(t)}`;
}
