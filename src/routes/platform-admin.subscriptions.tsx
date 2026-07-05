import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { SubChip, StatusChip } from "./platform-admin.index";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/platform-admin/subscriptions")({
  component: Subs,
});

function Subs() {
  const { data = [] } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const active = data.filter((t) => t.status === "active");
  const mrr = active.reduce((s, t) => s + (t.monthly_price ?? 0), 0);
  const dueOrOverdue = active.filter((t) => t.subscription_status !== "paid");

  const grouped = {
    overdue: active.filter((t) => t.subscription_status === "overdue"),
    due: active.filter((t) => t.subscription_status === "due"),
    paid: active.filter((t) => t.subscription_status === "paid"),
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-neutral-400">Manual tracking. I collect via UPI and mark payments here.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="flex items-center gap-2 text-xs text-neutral-400"><TrendingUp className="size-4" /> MRR</div>
          <div className="mt-2 text-2xl font-bold">₹{mrr.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-neutral-500">{active.length} active tenants</div>
        </Card>
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="text-xs text-neutral-400">Collected this cycle</div>
          <div className="mt-2 text-2xl font-bold">₹{grouped.paid.reduce((s, t) => s + (t.monthly_price ?? 0), 0).toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-neutral-500">{grouped.paid.length} tenants paid</div>
        </Card>
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="text-xs text-neutral-400">Outstanding</div>
          <div className="mt-2 text-2xl font-bold">₹{dueOrOverdue.reduce((s, t) => s + (t.monthly_price ?? 0), 0).toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-rose-300">{grouped.overdue.length} overdue · {grouped.due.length} due</div>
        </Card>
      </div>

      {(["overdue", "due", "paid"] as const).map((k) => (
        <div key={k} className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-neutral-500">{k}</div>
          <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
            {grouped[k].length === 0 && <div className="p-4 text-xs text-neutral-500">None.</div>}
            {grouped[k].map((t) => (
              <Link
                key={t.id}
                to="/platform-admin/tenants/$id"
                params={{ id: t.id }}
                className="flex items-center gap-3 p-3 hover:bg-white/5 text-neutral-100"
              >
                <div className="size-8 rounded" style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2 flex-wrap">
                    {t.name}
                    <StatusChip status={t.status} />
                    <SubChip sub={t.subscription_status} />
                  </div>
                  <div className="text-xs text-neutral-400">
                    Bill day {t.billing_day ?? 1} · Last paid {t.last_paid_date ? new Date(t.last_paid_date).toLocaleDateString("en-IN") : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">₹{(t.monthly_price ?? 0).toLocaleString("en-IN")}<span className="text-xs text-neutral-400">/mo</span></div>
                </div>
              </Link>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
