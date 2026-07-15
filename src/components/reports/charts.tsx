import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Line, LineChart, Area, AreaChart,
} from "recharts";
import { Card } from "@/components/ui/card";

type AttendanceDaily = { date: string; present: number; absent: number; percent: number };
type MonthPoint = { label: string; amount: number };
type StagePoint = { stage: string; count: number };
type BatchPoint = { batch: string; present: number; total: number; percent: number };
type LabelCount = { label: string; count: number };
type LabelAmount = { label: string; amount: number };

export type ChartsData = {
  attendanceDaily?: AttendanceDaily[];
  revenueByMonth?: MonthPoint[];
  admissionsByStage?: StagePoint[];
  attendanceByBatch?: BatchPoint[];
  bySource?: LabelCount[];
  byMethod?: LabelAmount[];
};

export type ChartsView =
  | "overview"
  | "attendance"
  | "finance"
  | "admissions";

const BRAND = "var(--brand, #1d4ed8)";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 rounded-2xl border border-border/60">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="h-48 sm:h-56">{children}</div>
    </Card>
  );
}

export function Charts({ view, data }: { view: ChartsView; data: ChartsData }) {
  if (view === "overview") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Attendance trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.attendanceDaily ?? []}>
              <defs>
                <linearGradient id="attG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip />
              <Area type="monotone" dataKey="percent" stroke={BRAND} strokeWidth={2} fill="url(#attG)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue trend">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.revenueByMonth ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => [inr(Number(v)), "Revenue"]} />
              <Bar dataKey="amount" fill={BRAND} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Admissions funnel">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.admissionsByStage ?? []} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="stage" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill={BRAND} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Attendance by batch">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.attendanceByBatch ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="batch" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip />
              <Bar dataKey="percent" fill={BRAND} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  if (view === "attendance") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Daily attendance %">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.attendanceDaily ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="percent" stroke={BRAND} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By batch">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.attendanceByBatch ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="batch" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip />
              <Bar dataKey="percent" fill={BRAND} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  if (view === "finance") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Revenue by month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.revenueByMonth ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => [inr(Number(v)), "Amount"]} />
              <Bar dataKey="amount" fill={BRAND} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By payment method">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byMethod ?? []} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <YAxis type="category" dataKey="label" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip formatter={(v: number) => [inr(Number(v)), "Amount"]} />
              <Bar dataKey="amount" fill={BRAND} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  if (view === "admissions") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard title="Pipeline funnel">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.admissionsByStage ?? []} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="stage" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill={BRAND} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By source">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bySource ?? []} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" fontSize={11} tickLine={false} axisLine={false} width={90} />
              <Tooltip />
              <Bar dataKey="count" fill={BRAND} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  return null;
}
