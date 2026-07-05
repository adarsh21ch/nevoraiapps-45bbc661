import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { Card } from "@/components/ui/card";
import { Users, Inbox, IndianRupee, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { tenant } = useDashboard();
  const { data, isLoading } = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant.id),
  });

  const kpis = [
    { label: "Active students", value: data?.activeStudents ?? 0, icon: Users, tone: "text-emerald-600" },
    { label: "New registrations (7d)", value: data?.newRegsThisWeek ?? 0, icon: Inbox, tone: "text-blue-600" },
    {
      label: "This month's collection",
      value: `₹${(data?.collectionThisMonth ?? 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      tone: "text-amber-600",
    },
    { label: "Pending monthly fees", value: data?.pendingFeeCount ?? 0, icon: AlertCircle, tone: "text-rose-600" },
  ];

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
                {isLoading ? <span className="text-muted-foreground">—</span> : k.value}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-1">Getting started</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Check the <strong>Registrations</strong> inbox for new sign-ups.</li>
          <li>Manage students, batches and fee plans from the sidebar.</li>
          <li>Update your public website in <strong>Site editor</strong>.</li>
        </ul>
      </Card>
    </div>
  );
}
