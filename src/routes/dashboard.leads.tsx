import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Phone, Trash2, Check, X, Trophy } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BulkImportLeads } from "@/components/dashboard/BulkImportLeads";

type LeadStatus = "new" | "contacted" | "won" | "lost";

type Lead = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/dashboard/leads")({
  head: () => ({ meta: [{ title: "Leads · Academy dashboard" }] }),
  component: LeadsInbox,
});

const FILTERS: { key: LeadStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

function LeadsInbox() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["d", "leads", tenant.id],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads" as never)
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  const visible = useMemo(
    () => (filter === "all" ? data : data.filter((l) => l.status === filter)),
    [data, filter],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.length, new: 0, contacted: 0, won: 0, lost: 0 };
    data.forEach((l) => { c[l.status]++; });
    return c;
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["d", "leads", tenant.id] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("leads" as never).update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(`Marked ${v.status}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("leads" as never).update({ notes } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notes saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Enquiries from your website. Reply on WhatsApp in one tap and track the outcome.
          </p>
        </div>
        <BulkImportLeads />
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-transparent text-white"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { backgroundColor: "var(--brand)" } : undefined}
            >
              {f.label} <span className="opacity-70">({counts[f.key] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && visible.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No leads {filter === "all" ? "yet" : `in "${filter}"`}. Share your site link — enquiries land here.
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            tenantName={tenant.name}
            onStatus={(status) => setStatus.mutate({ id: l.id, status })}
            onNote={(notes) => saveNote.mutate({ id: l.id, notes })}
            onDelete={() => remove.mutate(l.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LeadCard({
  lead, tenantName, onStatus, onNote, onDelete,
}: {
  lead: Lead;
  tenantName: string;
  onStatus: (s: LeadStatus) => void;
  onNote: (n: string) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [showNotes, setShowNotes] = useState(false);

  const waDigits = lead.phone.replace(/\D/g, "");
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;
  const waText = `Hi ${lead.name}, thanks for reaching out to ${tenantName}. When's a good time to chat?`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  const statusStyles: Record<LeadStatus, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-amber-100 text-amber-700",
    won: "bg-emerald-100 text-emerald-700",
    lost: "bg-rose-100 text-rose-700",
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold truncate">{lead.name}</span>
            <Badge className={`${statusStyles[lead.status]} border-0 capitalize`} variant="secondary">
              {lead.status}
            </Badge>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {lead.source}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:underline">
              <Phone className="size-3" /> {lead.phone}
            </a>
            <span>{new Date(lead.created_at).toLocaleString("en-IN")}</span>
          </div>
          {lead.message && (
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm text-foreground">
              {lead.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => lead.status === "new" && onStatus("contacted")}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
        >
          <MessageCircle className="size-3.5" fill="currentColor" /> Reply on WhatsApp
        </a>
        {lead.status !== "won" && (
          <Button size="sm" variant="outline" onClick={() => onStatus("won")}>
            <Trophy className="size-3.5 mr-1" /> Mark won
          </Button>
        )}
        {lead.status !== "lost" && (
          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => onStatus("lost")}>
            <X className="size-3.5 mr-1" /> Lost
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setShowNotes((s) => !s)}>
          {showNotes ? "Hide notes" : lead.notes ? "Edit notes" : "Add notes"}
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-600 ml-auto" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {showNotes && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes — not visible to the lead."
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { onNote(notes); setShowNotes(false); }}>
              <Check className="size-3.5 mr-1" /> Save notes
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
