import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditKeys, fetchAuditLog } from "@/lib/platform-audit";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/platform-admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: auditKeys.list(null),
    queryFn: () => fetchAuditLog(null, 500),
  });
  const { data: tenants = [] } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });

  const tenantMap = useMemo(() => Object.fromEntries(tenants.map((t) => [t.id, t.name])), [tenants]);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");

  const rows = useMemo(() => {
    return data.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${r.action} ${r.target_type} ${r.target_id ?? ""} ${tenantMap[r.tenant_id ?? ""] ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, q, action, tenantMap]);

  const actions = Array.from(new Set(data.map((r) => r.action)));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="size-6" /> Audit log
        </h1>
        <p className="text-sm text-neutral-400">Every platform-admin action. Immutable.</p>
      </header>

      <Card className="p-3 bg-neutral-900 border-white/10 grid gap-2 md:grid-cols-[1fr_200px]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, target, tenant…"
          className="bg-neutral-950 border-white/10 text-white" />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="bg-neutral-950 border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-neutral-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">No audit events match.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="p-3 grid grid-cols-1 md:grid-cols-[120px_1fr_140px_180px] gap-2 text-xs">
              <span className="font-mono text-neutral-200">{r.action}</span>
              <span className="text-neutral-400 truncate">
                {r.target_type}{r.target_id ? ` · ${r.target_id}` : ""}
              </span>
              <span className="text-neutral-400 truncate">{r.tenant_id ? tenantMap[r.tenant_id] ?? r.tenant_id.slice(0, 8) : "—"}</span>
              <span className="text-neutral-500">{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
