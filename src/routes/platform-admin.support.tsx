import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSupportNote,
  listSupportNotes,
  resolveSupportNote,
  supportKeys,
  type SupportNote,
} from "@/lib/platform-support";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/platform-admin/support")({
  component: Support,
});

function Support() {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });
  const { data: notes = [] } = useQuery({
    queryKey: supportKeys.all,
    queryFn: () => listSupportNotes(),
  });

  const [tenantId, setTenantId] = useState<string>("");
  const [priority, setPriority] = useState<SupportNote["priority"]>("normal");
  const [body, setBody] = useState("");

  const add = useMutation({
    mutationFn: () => addSupportNote({ tenantId, body, priority }),
    onSuccess: () => {
      toast.success("Note added");
      setBody("");
      qc.invalidateQueries({ queryKey: supportKeys.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (n: SupportNote) => resolveSupportNote(n.id, n.tenant_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: supportKeys.all }),
  });

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <LifeBuoy className="size-6" /> Support notes
        </h1>
        <p className="text-sm text-neutral-400">Internal, per-academy. All notes are audited.</p>
      </header>

      <Card className="p-4 bg-neutral-900 border-white/10 space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="bg-neutral-950 border-white/10 text-white">
              <SelectValue placeholder="Select academy" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as SupportNote["priority"])}>
            <SelectTrigger className="bg-neutral-950 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Note (visible only to platform admins)…"
          className="bg-neutral-950 border-white/10 text-white min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button
            onClick={() => add.mutate()}
            disabled={!tenantId || !body.trim() || add.isPending}
            className="bg-white text-neutral-900 hover:bg-neutral-100"
          >
            Add note
          </Button>
        </div>
      </Card>

      <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
        {notes.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">No notes yet.</div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="p-3 flex items-start gap-3">
              <PriorityBadge priority={n.priority} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{n.body}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  <Link
                    to="/platform-admin/tenants/$id"
                    params={{ id: n.tenant_id }}
                    className="underline"
                  >
                    {tenantMap[n.tenant_id] ?? n.tenant_id.slice(0, 8)}
                  </Link>
                  {" · "}
                  {new Date(n.created_at).toLocaleString()}
                  {n.status === "resolved" && (
                    <>
                      {" "}
                      · <span className="text-emerald-400">Resolved</span>
                    </>
                  )}
                </div>
              </div>
              {n.status === "open" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolve.mutate(n)}
                  className="text-neutral-300 hover:text-white hover:bg-white/10"
                >
                  Resolve
                </Button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: SupportNote["priority"] }) {
  const map: Record<SupportNote["priority"], string> = {
    low: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30",
    normal: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    urgent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  return (
    <Badge variant="outline" className={`capitalize shrink-0 ${map[priority]}`}>
      {priority}
    </Badge>
  );
}
