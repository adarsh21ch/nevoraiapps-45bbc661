import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, IndianRupee, Plus, ArrowRight, TrendingUp, ChevronRight } from "lucide-react";
import { niche } from "@/lib/niche";
import { getFeatures } from "@/lib/tenant";
import { candidatePeriods, periodKey, studentDue, tenantFeeCycle } from "@/lib/fees";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { tenant } = useDashboard();
  const n = niche(tenant.niche);
  const features = getFeatures(tenant);
  const { data, isLoading } = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant),
  });

  const empty =
    !isLoading && (data?.activeStudents ?? 0) === 0 && (data?.newRegsThisWeek ?? 0) === 0;
  const collected = data?.collectionThisMonth ?? 0;
  const pending = data?.pendingFeeCount ?? 0;
  const active = data?.activeStudents ?? 0;

  const cycle = tenantFeeCycle(tenant);
  const now = new Date();
  const pendingList = useQuery({
    enabled: features.fee_tracking !== false,
    queryKey: ["d", "pending-fees-list", tenant.id],
    queryFn: async () => {
      const periods = cycle === "joining_date" ? candidatePeriods(now) : [periodKey(now)];
      const [studentsRes, paidRes] = await Promise.all([
        supabase
          .from("students")
          .select("id, name, joined_at, fee_plans!inner(name, amount, type)")
          .eq("tenant_id", tenant.id)
          .eq("status", "active")
          .eq("fee_plans.type", "monthly")
          .order("name"),
        supabase
          .from("payments")
          .select("student_id, period")
          .eq("tenant_id", tenant.id)
          .in("period", periods),
      ]);
      const paidByStudent = new Map<string, Set<string>>();
      for (const p of paidRes.data ?? []) {
        if (!p.student_id || !p.period) continue;
        const s = paidByStudent.get(p.student_id) ?? new Set<string>();
        s.add(p.period);
        paidByStudent.set(p.student_id, s);
      }
      return (studentsRes.data ?? [])
        .map((s) => {
          const due = studentDue({
            cycle,
            joinedAt: s.joined_at,
            selectedMonth: now,
            paidPeriods: paidByStudent.get(s.id) ?? new Set(),
            today: now,
          });
          return { student: s, due };
        })
        .filter((x) => x.due.state === "pending")
        .sort((a, b) => {
          const ao = a.due.state === "pending" ? a.due.overdueDays : 0;
          const bo = b.due.state === "pending" ? b.due.overdueDays : 0;
          return bo - ao;
        });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{tenant.name} · at a glance</p>
      </header>

      {features.fee_tracking !== false ? (
        <Card
          className="relative overflow-hidden border-0 p-6 md:p-7 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, var(--brand, #0ea5e9), var(--brand-ink, #0369a1))`,
          }}
        >
          <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-white/80">
              <TrendingUp className="size-3.5" /> This month
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              {isLoading ? (
                <Skeleton className="h-10 w-40 bg-white/20" />
              ) : (
                <div className="text-4xl md:text-5xl font-bold tracking-tight">
                  ₹{collected.toLocaleString("en-IN")}
                </div>
              )}
              <span className="text-sm text-white/80">collected</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 max-w-md">
              <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 border border-white/15">
                <div className="text-[11px] uppercase tracking-wider text-white/70">Pending</div>
                <div className="mt-1 text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-6 w-10 bg-white/20" /> : pending}
                </div>
                <div className="text-[11px] text-white/70">{n.students.toLowerCase()}</div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3 border border-white/15">
                <div className="text-[11px] uppercase tracking-wider text-white/70">Active</div>
                <div className="mt-1 text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-6 w-10 bg-white/20" /> : active}
                </div>
                <div className="text-[11px] text-white/70">{n.students.toLowerCase()}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/dashboard/fees"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm hover:scale-[1.02] transition-transform"
              >
                <IndianRupee className="size-4" /> Manage fees
                <ArrowRight className="size-3.5" />
              </Link>
              {pending > 0 ? (
                <Link
                  to="/dashboard/reminders"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Send reminders
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Pending fees list — scannable, tap to collect */}
      {features.fee_tracking !== false ? (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3 md:px-5">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pending fees</div>
              <div className="text-sm font-semibold">
                {pendingList.isLoading ? "Loading…" : `${pendingList.data?.length ?? 0} ${n.students.toLowerCase()} to follow up`}
              </div>
            </div>
            <Link to="/dashboard/fees" className="text-xs font-medium inline-flex items-center gap-1" style={{ color: "var(--brand)" }}>
              Open register <ArrowRight className="size-3" />
            </Link>
          </div>
          <ul className="divide-y">
            {(pendingList.data ?? []).slice(0, 6).map((row, i) => {
              const overdue = row.due.state === "pending" ? row.due.overdueDays : 0;
              const amount = row.student.fee_plans?.amount ?? 0;
              return (
                <li key={row.student.id}>
                  <Link
                    to="/dashboard/students/$id"
                    params={{ id: row.student.id }}
                    className="flex items-center gap-3 px-4 py-3 md:px-5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{row.student.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.student.fee_plans?.name ?? "Monthly"} · {overdue > 0 ? `${overdue}d overdue` : "due"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">₹{Number(amount).toLocaleString("en-IN")}</div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-rose-600">Pending</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
            {!pendingList.isLoading && (pendingList.data?.length ?? 0) === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                All caught up — no pending fees this cycle.
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {empty ? (
        <Card className="p-8 text-center">
          <div
            className="mx-auto grid size-12 place-items-center rounded-full"
            style={{ backgroundColor: "color-mix(in oklab, var(--brand) 15%, transparent)" }}
          >
            <Users className="size-6" style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No {n.students.toLowerCase()} yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first {n.student.toLowerCase()} to get started.
          </p>
          <Link
            to="/dashboard/students"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <Plus className="size-4" /> Add your first {n.student.toLowerCase()}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
