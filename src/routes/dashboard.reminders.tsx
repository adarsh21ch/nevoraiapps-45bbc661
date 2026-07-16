import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageCircle, Check, RefreshCw, Play } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { periodLabel } from "@/lib/fees";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/shared/FilterTabs";

type ReminderStatus = "queued" | "sent" | "dismissed";
type Reminder = {
  id: string;
  tenant_id: string;
  student_id: string;
  period: string;
  channel: string;
  message: string | null;
  whatsapp_url: string | null;
  phone: string | null;
  amount: number | null;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  students: { name: string; guardian_name: string | null } | null;
};

export const Route = createFileRoute("/dashboard/reminders")({
  head: () => ({ meta: [{ title: "Fee reminders · Academy dashboard" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();

  const {
    data = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["d", "reminders", tenant.id],
    queryFn: async (): Promise<Reminder[]> => {
      const { data, error } = await supabase
        .from("reminder_logs" as never)
        .select("*, students(name, guardian_name)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Reminder[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["d", "reminders", tenant.id] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReminderStatus }) => {
      const patch =
        status === "sent"
          ? { status, sent_at: new Date().toISOString() }
          : { status, sent_at: null };
      const { error } = await supabase
        .from("reminder_logs" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/hooks/fee-reminders", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ queued: number; skipped: number }>;
    },
    onSuccess: (r) => {
      toast.success(`Queued ${r.queued} reminders (${r.skipped} skipped)`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g: Record<ReminderStatus, Reminder[]> = { queued: [], sent: [], dismissed: [] };
    for (const r of data) g[r.status].push(r);
    return g;
  }, [data]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee reminders</h1>
          <p className="text-sm text-muted-foreground">
            Auto-generated daily at 9:00 IST for overdue monthly fees. Tap to send on WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
            <Play className="size-4 mr-1" /> Run now
          </Button>
        </div>
      </header>

      <Tabs defaultValue="queued">
        <TabsList>
          <TabsTrigger value="queued">Queue ({grouped.queued.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({grouped.sent.length})</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed ({grouped.dismissed.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && data.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No reminders yet. The daily cron will queue overdue students automatically — or hit "Run
          now" to trigger it.
        </Card>
      )}

      <div className="space-y-3">
        {data.map((r) => (
          <Card key={r.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">
                  {r.students?.name ?? "Unknown student"}
                  {r.amount != null && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ₹{Number(r.amount).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {periodLabel(r.period)} · queued {format(new Date(r.created_at), "d MMM h:mma")}
                  {r.sent_at && ` · sent ${format(new Date(r.sent_at), "d MMM h:mma")}`}
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.message && (
              <p className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm">{r.message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {r.whatsapp_url && (
                <a
                  href={r.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    r.status === "queued" && setStatus.mutate({ id: r.id, status: "sent" })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                >
                  <MessageCircle className="size-3.5" fill="currentColor" /> Send on WhatsApp
                </a>
              )}
              {r.status !== "sent" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ id: r.id, status: "sent" })}
                >
                  <Check className="size-3.5 mr-1" /> Mark sent
                </Button>
              )}
              {r.status !== "dismissed" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatus.mutate({ id: r.id, status: "dismissed" })}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ReminderStatus }) {
  const styles: Record<ReminderStatus, string> = {
    queued: "bg-blue-100 text-blue-700",
    sent: "bg-emerald-100 text-emerald-700",
    dismissed: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      {status}
    </span>
  );
}
