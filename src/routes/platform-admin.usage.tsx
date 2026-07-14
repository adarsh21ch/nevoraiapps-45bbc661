import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { analyticsKeys, fetchTenantUsage, type TenantUsage } from "@/lib/platform-analytics";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/platform-admin/usage")({
  component: Usage,
});

function Usage() {
  const { data: tenants = [], isLoading } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="size-6" /> Usage analytics
        </h1>
        <p className="text-sm text-neutral-400">Per-academy activity signals — students, admins, comms.</p>
      </header>

      {isLoading ? (
        <Skeleton className="h-40 bg-white/5" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tenants.map((t) => <UsageCard key={t.id} tenantId={t.id} name={t.name} slug={t.slug} />)}
        </div>
      )}
    </div>
  );
}

function UsageCard({ tenantId, name, slug }: { tenantId: string; name: string; slug: string }) {
  const { data } = useQuery<TenantUsage>({
    queryKey: analyticsKeys.tenantUsage(tenantId),
    queryFn: () => fetchTenantUsage(tenantId),
  });
  return (
    <Link to="/platform-admin/tenants/$id" params={{ id: tenantId }}>
      <Card className="p-4 bg-neutral-900 border-white/10 hover:border-white/30 text-neutral-100 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{name}</div>
            <div className="text-xs text-neutral-500">/{slug}</div>
          </div>
          <ChevronRight className="size-4 text-neutral-500" />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
          <Metric label="Students" value={data?.students} />
          <Metric label="Admins" value={data?.admins} />
          <Metric label="Parents" value={data?.parents} />
          <Metric label="Notif 30d" value={data?.notifications_30d} />
          <Metric label="Campaigns" value={data?.campaigns} />
        </div>
      </Card>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <div className="text-lg font-bold">{value ?? "—"}</div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

// Keep supabase import used in case tree-shaking removes it — no-op reference
void supabase;
