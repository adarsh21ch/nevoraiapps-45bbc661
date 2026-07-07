import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Inbox, IndianRupee, AlertCircle, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { niche } from "@/lib/niche";
import { getFeatures } from "@/lib/tenant";

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

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Active {n.students.toLowerCase()}</div>
            <Users className="size-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {isLoading ? <Skeleton className="h-7 w-16" /> : active}
          </div>
          <Link to="/dashboard/students" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            View all <ArrowRight className="size-3" />
          </Link>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">New registrations (7d)</div>
            <Inbox className="size-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {isLoading ? <Skeleton className="h-7 w-16" /> : data?.newRegsThisWeek ?? 0}
          </div>
          <Link to="/dashboard/registrations" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            Review <ArrowRight className="size-3" />
          </Link>
        </Card>
        <Card className="p-4 md:p-5 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Pending fees</div>
            <AlertCircle className="size-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {isLoading ? <Skeleton className="h-7 w-16" /> : pending}
          </div>
          <Link to="/dashboard/fees" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            Follow up <ArrowRight className="size-3" />
          </Link>
        </Card>
      </div>

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
