import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Inbox, IndianRupee, AlertCircle, Plus, ArrowRight } from "lucide-react";
import { niche } from "@/lib/niche";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { tenant } = useDashboard();
  const n = niche(tenant.niche);
  const { data, isLoading } = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant),
  });

  const kpis = [
    { label: `Active ${n.students.toLowerCase()}`, value: data?.activeStudents ?? 0, icon: Users, tone: "text-emerald-600" },
    { label: "New registrations (7d)", value: data?.newRegsThisWeek ?? 0, icon: Inbox, tone: "text-blue-600" },
    { label: "This month's collection", value: `₹${(data?.collectionThisMonth ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee, tone: "text-amber-600" },
    { label: "Pending monthly fees", value: data?.pendingFeeCount ?? 0, icon: AlertCircle, tone: "text-rose-600" },
  ];

  const empty = !isLoading && (data?.activeStudents ?? 0) === 0 && (data?.newRegsThisWeek ?? 0) === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{tenant.name} · at a glance</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <Icon className={`size-4 ${k.tone}`} />
              </div>
              <div className="mt-2 text-2xl font-bold">
                {isLoading ? <Skeleton className="h-7 w-16" /> : k.value}
              </div>
            </Card>
          );
        })}
      </div>

      {empty ? (
        <Card className="p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full" style={{ backgroundColor: "color-mix(in oklab, var(--brand) 15%, transparent)" }}>
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
      ) : (
        <Card className="p-5">
          <h2 className="font-semibold mb-2">Getting started</h2>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-center gap-2">
              <ArrowRight className="size-3.5 text-muted-foreground" />
              Check the <Link to="/dashboard/registrations" className="font-medium text-foreground underline-offset-2 hover:underline">Registrations</Link> inbox for new sign-ups.
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="size-3.5 text-muted-foreground" />
              Manage {n.students.toLowerCase()}, {n.batches.toLowerCase()} and fee plans from the sidebar.
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="size-3.5 text-muted-foreground" />
              Update your public website in <Link to="/dashboard/site" className="font-medium text-foreground underline-offset-2 hover:underline">Site editor</Link>.
            </li>
          </ul>
        </Card>
      )}
    </div>
  );
}
