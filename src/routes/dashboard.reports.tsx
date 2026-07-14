import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchPaymentsSince, qk } from "@/lib/dashboard-queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/reports")({
  component: Reports,
});

const MONTHS_BACK = 6;

function Reports() {
  const { tenant } = useDashboard();
  const since = useMemo(() => {
    const d = subMonths(new Date(), MONTHS_BACK - 1);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  const paymentsQ = useQuery({
    queryKey: qk.report(tenant.id),
    queryFn: () => fetchPaymentsSince(tenant.id, since),
  });
  const payments = paymentsQ.data ?? [];

  const byMonth = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      buckets.set(format(subMonths(new Date(), i), "yyyy-MM"), 0);
    }
    for (const p of payments) {
      const key = format(new Date(p.created_at), "yyyy-MM");
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(p.amount || 0));
    }
    return [...buckets.entries()].map(([key, total]) => {
      const [y, m] = key.split("-").map(Number);
      return { month: format(new Date(y, m - 1, 1), "MMM"), total };
    });
  }, [payments]);

  const byMethod = groupSum(payments, (p) => (p.method || "other").toUpperCase());
  const byType = groupSum(payments, (p) => prettyType(p.type));
  const grandTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const exportCsv = () => {
    const header = ["Date", "Receipt No", "Student", "Amount", "Type", "Period", "Method", "Note"];
    const lines = payments.map((p: any) =>
      [
        format(new Date(p.created_at), "yyyy-MM-dd"),
        p.receipt_no,
        csvSafe(p.students?.name ?? ""),
        p.amount,
        p.type,
        p.period ?? "",
        p.method,
        csvSafe(p.note ?? ""),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tenant.slug}-collections-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Last {MONTHS_BACK} months · total ₹{grandTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
          <Download className="size-4 mr-1" /> Export CSV
        </Button>
      </header>

      <Card className="p-4 md:p-5">
        <h2 className="text-sm font-semibold mb-3">Monthly collections</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                formatter={(v: number) => [`₹${Number(v).toLocaleString("en-IN")}`, "Collected"]}
              />
              <Bar dataKey="total" fill="var(--brand, #1d4ed8)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <BreakdownCard title="By payment mode" rows={byMethod} />
        <BreakdownCard title="By fee type" rows={byType} />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; total: number }[];
}) {
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <div className="divide-y">
        {rows.length === 0 && (
          <div className="py-3 text-sm text-muted-foreground">No payments yet.</div>
        )}
        {rows.map((r) => (
          <div key={r.label} className="py-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium">₹{r.total.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function groupSum<T>(items: T[], keyFn: (t: T) => string): { label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) ?? 0) + Number((it as any).amount || 0));
  }
  return [...m.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function prettyType(t: string): string {
  if (t === "monthly") return "Monthly fees";
  if (t === "registration") return "Registration";
  if (t === "personal_coaching") return "Personal coaching";
  return "Other";
}

function csvSafe(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
