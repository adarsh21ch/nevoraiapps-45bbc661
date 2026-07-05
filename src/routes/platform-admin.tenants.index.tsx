import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { StatusChip, SubChip } from "./platform-admin.index";

export const Route = createFileRoute("/platform-admin/tenants")({
  component: List,
});

function List() {
  const { data = [] } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-sm text-neutral-400">Click a tenant to edit branding, features, pricing and domain.</p>
      </header>
      <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
        {data.map((t) => (
          <Link
            key={t.id}
            to="/platform-admin/tenants/$id"
            params={{ id: t.id }}
            className="flex items-center gap-3 p-4 hover:bg-white/5"
          >
            <div className="size-9 rounded-md" style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                <span className="truncate">{t.name}</span>
                <StatusChip status={t.status} />
                <SubChip sub={t.subscription_status} />
              </div>
              <div className="text-xs text-neutral-400 truncate">/{t.slug} · {t.student_count ?? 0} students · ₹{(t.monthly_price ?? 0).toLocaleString("en-IN")}/mo</div>
            </div>
            <Badge variant="outline" className="capitalize border-white/10 text-neutral-300">{t.niche}</Badge>
          </Link>
        ))}
        {data.length === 0 && <div className="p-6 text-sm text-neutral-400">No tenants yet.</div>}
      </Card>
    </div>
  );
}
