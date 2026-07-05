import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTenants, pqk, type TenantRow } from "@/lib/platform-queries";
import { SubChip, StatusChip } from "./platform-admin.index";
import { CheckCircle2, MessageCircle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/platform-admin/subscriptions")({
  component: Subs,
});

function Subs() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const active = data.filter((t) => t.status === "active");
  const mrr = active.reduce((s, t) => s + (t.monthly_price ?? 0), 0);
  const dueOrOverdue = active.filter((t) => t.subscription_status !== "paid");

  const grouped = {
    overdue: active.filter((t) => t.subscription_status === "overdue"),
    due: active.filter((t) => t.subscription_status === "due"),
    paid: active.filter((t) => t.subscription_status === "paid"),
  };

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("tenants")
        .update({ subscription_status: "paid", last_paid_date: today })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked paid");
      qc.invalidateQueries({ queryKey: pqk.tenants });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-neutral-400">Manual tracking. Collect via UPI and mark payments here.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="flex items-center gap-2 text-xs text-neutral-400"><TrendingUp className="size-4" /> MRR</div>
          <div className="mt-2 text-2xl font-bold">₹{mrr.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-neutral-500">{active.length} active tenants</div>
        </Card>
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="text-xs text-neutral-400">Collected this cycle</div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">₹{grouped.paid.reduce((s, t) => s + (t.monthly_price ?? 0), 0).toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-neutral-500">{grouped.paid.length} tenants paid</div>
        </Card>
        <Card className="p-4 bg-neutral-900 border-white/10 text-neutral-100">
          <div className="text-xs text-neutral-400">Outstanding</div>
          <div className="mt-2 text-2xl font-bold text-rose-300">₹{dueOrOverdue.reduce((s, t) => s + (t.monthly_price ?? 0), 0).toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-neutral-500">{grouped.overdue.length} overdue · {grouped.due.length} due</div>
        </Card>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5" />)}
        </div>
      )}

      {!isLoading && (["overdue", "due", "paid"] as const).map((k) => (
        <div key={k} className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-neutral-500">{k} · {grouped[k].length}</div>
          <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
            {grouped[k].length === 0 && <div className="p-4 text-xs text-neutral-500">Nothing here — nice.</div>}
            {grouped[k].map((t) => (
              <Row
                key={t.id}
                t={t}
                onMarkPaid={() => markPaid.mutate(t.id)}
                busy={markPaid.isPending && markPaid.variables === t.id}
              />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function Row({ t, onMarkPaid, busy }: { t: TenantRow; onMarkPaid: () => void; busy: boolean }) {
  const amount = t.monthly_price ?? 0;
  const phone = (t.whatsapp || t.phone || "").replace(/[^\d]/g, "");
  const waMsg = encodeURIComponent(
    `Hi ${t.name} team 👋\n\nGentle reminder — your Academy OS subscription of ₹${amount.toLocaleString("en-IN")} for this month is pending.\n\nPlease pay via UPI when convenient and reply here once done. Thank you!`,
  );
  const waHref = phone ? `https://wa.me/${phone.length === 10 ? "91" + phone : phone}?text=${waMsg}` : null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <Link
        to="/platform-admin/tenants/$id"
        params={{ id: t.id }}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80"
      >
        <div className="size-9 rounded-md shrink-0" style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }} />
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
      </Link>
      <div className="text-right">
        <div className="text-sm font-semibold">₹{amount.toLocaleString("en-IN")}<span className="text-xs text-neutral-400">/mo</span></div>
      </div>
      <div className="flex gap-1.5">
        {waHref && t.subscription_status !== "paid" && (
          <Button asChild size="sm" variant="ghost" className="text-emerald-300 hover:text-emerald-200 hover:bg-white/5">
            <a href={waHref} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4 mr-1" /> Chase
            </a>
          </Button>
        )}
        {t.subscription_status !== "paid" && (
          <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-400" onClick={onMarkPaid} disabled={busy}>
            <CheckCircle2 className="size-4 mr-1" /> {busy ? "…" : "Mark paid"}
          </Button>
        )}
      </div>
    </div>
  );
}
