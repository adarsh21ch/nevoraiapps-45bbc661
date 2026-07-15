import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useDashboard } from "@/lib/dashboard-context";
import { importedStudentsQuery, importBatchesQuery } from "@/lib/admissions/queries";
import { sendActivations, rollbackImport } from "@/lib/admissions/admissions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LIFECYCLE_LABEL, LIFECYCLE_TONE, type LifecycleStatus } from "@/lib/admissions/lifecycle";

export const Route = createFileRoute("/dashboard/activation")({
  head: () => ({ meta: [{ title: "Activation Center" }] }),
  component: () => (
    <DashboardShell>
      <ActivationCenter />
    </DashboardShell>
  ),
});

function ActivationCenter() {
  const { tenantId } = useDashboard();
  const { data: students } = useSuspenseQuery(importedStudentsQuery(tenantId!));
  const { data: batches } = useSuspenseQuery(importBatchesQuery(tenantId!));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const qc = useQueryClient();

  const send = useServerFn(sendActivations);
  const rollback = useServerFn(rollbackImport);

  const sendMut = useMutation({
    mutationFn: (studentIds: string[]) => send({ data: { tenantId: tenantId!, studentIds } }),
    onSuccess: (res: any) => {
      toast.success(`Sent ${res.results.length} activations`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rollbackMut = useMutation({
    mutationFn: (batchId: string) => rollback({ data: { batchId, tenantId: tenantId! } }),
    onSuccess: () => {
      toast.success("Import rolled back");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Rollback failed"),
  });

  const filtered = students.filter((s: any) => {
    if (statusFilter !== "all" && s.lifecycle_status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.email?.toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s: any) => s.id)));
  };

  const counts = {
    imported: students.filter((s: any) => s.lifecycle_status === "imported").length,
    invitation_sent: students.filter((s: any) => s.lifecycle_status === "invitation_sent").length,
    activated: students.filter((s: any) => s.lifecycle_status === "activated" || s.lifecycle_status === "profile_completed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activation Center</h1>
        <p className="text-sm text-muted-foreground">Send activation invites to imported students and track progress.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Imported" value={students.length} onClick={() => setStatusFilter("all")} />
        <StatCard label="Pending" value={counts.imported} onClick={() => setStatusFilter("imported")} />
        <StatCard label="Invited" value={counts.invitation_sent} onClick={() => setStatusFilter("invitation_sent")} />
        <StatCard label="Activated" value={counts.activated} onClick={() => setStatusFilter("activated")} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">
            Students {statusFilter !== "all" && <Badge variant="outline">{statusFilter}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-56"
            />
            <Button
              size="sm"
              disabled={selected.size === 0 || sendMut.isPending}
              onClick={() => sendMut.mutate([...selected])}
            >
              Send Activation ({selected.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No students match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 pb-2">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Phone</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2">
                        <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                      </td>
                      <td className="py-2">{s.name}</td>
                      <td className="py-2 text-muted-foreground">{s.phone}</td>
                      <td className="py-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${LIFECYCLE_TONE[s.lifecycle_status as LifecycleStatus] ?? ""}`}>
                          {LIFECYCLE_LABEL[s.lifecycle_status as LifecycleStatus] ?? s.lifecycle_status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {s.activation_sent_at ? new Date(s.activation_sent_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {batches.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div>
                  <div className="font-medium">{b.file_name ?? "Import"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString()} · {b.success_count}/{b.row_count} imported · status: {b.status}
                  </div>
                </div>
                {!b.rolled_back_at && b.status !== "rolled_back" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rollbackMut.isPending}
                    onClick={() => {
                      if (confirm("Roll back this import? Only imported/invited students will be removed.")) {
                        rollbackMut.mutate(b.id);
                      }
                    }}
                  >
                    Rollback
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border bg-card p-4 text-left hover:bg-accent">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}
