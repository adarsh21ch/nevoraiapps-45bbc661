import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { importedStudentsQuery, importBatchesQuery } from "@/lib/admissions/queries";
import { sendActivations, rollbackImport } from "@/lib/admissions/admissions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, QrCode, MessageCircle, Mail, Send, RefreshCw } from "lucide-react";
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
  const { tenant } = useDashboard();
  const tenantId = tenant.id!;
  const { data: students } = useSuspenseQuery(importedStudentsQuery(tenantId));
  const { data: batches } = useSuspenseQuery(importBatchesQuery(tenantId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [qrFor, setQrFor] = useState<{ name: string; token: string } | null>(null);
  const qc = useQueryClient();

  const send = useServerFn(sendActivations);
  const rollback = useServerFn(rollbackImport);

  const sendMut = useMutation({
    mutationFn: (studentIds: string[]) => send({ data: { tenantId, studentIds } }),
    onSuccess: (res: any) => {
      toast.success(`Sent ${res.results.length} activations`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rollbackMut = useMutation({
    mutationFn: (batchId: string) => rollback({ data: { batchId, tenantId } }),
    onSuccess: () => {
      toast.success("Import rolled back");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Rollback failed"),
  });

  const isExpired = (s: any) => {
    if (!s.activation_sent_at) return false;
    if (["activated", "profile_completed"].includes(s.lifecycle_status)) return false;
    const ageMs = Date.now() - new Date(s.activation_sent_at).getTime();
    return ageMs > 30 * 24 * 60 * 60 * 1000;
  };

  const filtered = students.filter((s: any) => {
    if (statusFilter === "expired") {
      if (!isExpired(s)) return false;
    } else if (statusFilter !== "all" && s.lifecycle_status !== statusFilter) {
      return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.email?.toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s: any) => s.id)));
  };

  const fetchToken = async (studentId: string) => {
    const { data } = await supabase
      .from("students")
      .select("activation_token, name, phone, email")
      .eq("id", studentId)
      .maybeSingle();
    return data as { activation_token: string | null; name: string; phone: string | null; email: string | null } | null;
  };

  const linkFor = (token: string) => `${window.location.origin}/activate/${token}`;

  const copyLink = async (studentId: string) => {
    const s = await fetchToken(studentId);
    if (!s?.activation_token) { toast.error("No active token — send activation first"); return; }
    await navigator.clipboard.writeText(linkFor(s.activation_token));
    toast.success("Activation link copied");
  };

  const shareWhatsApp = async (studentId: string) => {
    const s = await fetchToken(studentId);
    if (!s?.activation_token) { toast.error("No active token — send activation first"); return; }
    const msg = `Hi ${s.name}, activate your academy account here: ${linkFor(s.activation_token)}`;
    const phone = (s.phone ?? "").replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  const shareSMS = async (studentId: string) => {
    const s = await fetchToken(studentId);
    if (!s?.activation_token) { toast.error("No active token — send activation first"); return; }
    const msg = `Activate your academy account: ${linkFor(s.activation_token)}`;
    const phone = (s.phone ?? "").replace(/\s+/g, "");
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(msg)}`;
  };

  const shareEmail = async (studentId: string) => {
    const s = await fetchToken(studentId);
    if (!s?.activation_token) { toast.error("No active token — send activation first"); return; }
    const subject = "Activate your academy account";
    const body = `Hi ${s.name},\n\nActivate your account: ${linkFor(s.activation_token)}\n\nSee you on the field!`;
    window.location.href = `mailto:${s.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const showQr = async (studentId: string) => {
    const s = await fetchToken(studentId);
    if (!s?.activation_token) { toast.error("No active token — send activation first"); return; }
    setQrFor({ name: s.name, token: s.activation_token });
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
        <p className="text-sm text-muted-foreground">Send activation invites, copy links, and track progress.</p>
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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-56" />
            <Button
              size="sm"
              disabled={selected.size === 0 || sendMut.isPending}
              onClick={() => sendMut.mutate([...selected])}
            >
              {sendMut.isPending ? "Sending…" : `Send Activation (${selected.size})`}
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
                    <th className="pb-2 text-right">Actions</th>
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
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Copy link" onClick={() => copyLink(s.id)}>
                            <Copy className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" title="QR" onClick={() => showQr(s.id)}>
                            <QrCode className="size-3.5" />
                          </Button>
                        </div>
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
          <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
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

      <QrDialog data={qrFor} onClose={() => setQrFor(null)} />
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

function QrDialog({ data, onClose }: { data: { name: string; token: string } | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data) { setDataUrl(null); return; }
    (async () => {
      const { default: QRCode } = await import("qrcode");
      const link = `${window.location.origin}/activate/${data.token}`;
      const url = await QRCode.toDataURL(link, { width: 320, margin: 1 });
      setDataUrl(url);
    })();
  }, [data]);
  return (
    <Dialog open={Boolean(data)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Activation QR — {data?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {dataUrl ? (
            <img src={dataUrl} alt="Activation QR" className="rounded border" />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded bg-muted" />
          )}
          <p className="text-xs text-muted-foreground text-center">
            Scan to activate the student account.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

