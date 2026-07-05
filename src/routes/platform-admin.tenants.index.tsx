import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { StatusChip, SubChip } from "./platform-admin.index";
import { niche, nicheOptions } from "@/lib/niche";
import { ChevronRight, Search } from "lucide-react";

export const Route = createFileRoute("/platform-admin/tenants/")({
  component: List,
});

function List() {
  const { data = [], isLoading } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const [q, setQ] = useState("");
  const [nicheF, setNicheF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [subF, setSubF] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((t) => {
      if (needle && !`${t.name} ${t.slug}`.toLowerCase().includes(needle)) return false;
      if (nicheF !== "all" && t.niche !== nicheF) return false;
      if (statusF !== "all" && t.status !== statusF) return false;
      if (subF !== "all" && t.subscription_status !== subF) return false;
      return true;
    });
  }, [data, q, nicheF, statusF, subF]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-neutral-400">Click a tenant to manage branding, features, pricing and domain.</p>
        </div>
        <div className="text-xs text-neutral-500">{filtered.length} of {data.length}</div>
      </header>

      <Card className="bg-neutral-900 border-white/10 text-neutral-100 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_160px_160px_160px]">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or slug…"
              className="pl-8 bg-neutral-950 border-white/10 text-white"
            />
          </div>
          <FilterSelect value={nicheF} onChange={setNicheF} label="Niche"
            options={[{ value: "all", label: "All niches" }, ...nicheOptions.map((n) => ({ value: n.value, label: n.label }))]} />
          <FilterSelect value={statusF} onChange={setStatusF} label="Status"
            options={[{ value: "all", label: "All status" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "trial", label: "Trial" }]} />
          <FilterSelect value={subF} onChange={setSubF} label="Subscription"
            options={[{ value: "all", label: "All subs" }, { value: "paid", label: "Paid" }, { value: "due", label: "Due" }, { value: "overdue", label: "Overdue" }]} />
        </div>
      </Card>

      <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
        {isLoading && (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 bg-white/5" />)}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-neutral-400">
            {data.length === 0 ? (
              <>No tenants yet. <Link to="/platform-admin/new" className="underline">Onboard your first client</Link>.</>
            ) : (
              <>No tenants match those filters.</>
            )}
          </div>
        )}
        {!isLoading && filtered.map((t) => (
          <Link
            key={t.id}
            to="/platform-admin/tenants/$id"
            params={{ id: t.id }}
            className="group flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
          >
            <div
              className="size-10 rounded-md shrink-0 grid place-items-center text-white text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${t.primary_color}, ${t.secondary_color})` }}
            >
              {t.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap">
                <span className="truncate">{t.name}</span>
                <StatusChip status={t.status} />
                <SubChip sub={t.subscription_status} />
                <span className="text-xs text-neutral-500 capitalize">· {niche(t.niche).label}</span>
              </div>
              <div className="text-xs text-neutral-400 truncate mt-0.5">
                /{t.slug} · {t.student_count ?? 0} students · created {new Date(t.created_at).toLocaleDateString("en-IN")}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">₹{(t.monthly_price ?? 0).toLocaleString("en-IN")}<span className="text-xs text-neutral-400">/mo</span></div>
            </div>
            <ChevronRight className="size-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </Card>
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-neutral-950 border-white/10 text-white" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
