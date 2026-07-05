import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchRegistrations, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, CheckCheck, X, Phone } from "lucide-react";

export const Route = createFileRoute("/dashboard/registrations")({
  component: RegistrationsInbox,
});

function RegistrationsInbox() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: qk.regs(tenant.id),
    queryFn: () => fetchRegistrations(tenant.id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.regs(tenant.id) });
    qc.invalidateQueries({ queryKey: ["d", "regs-new-count", tenant.id] });
    qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
  };

  const verify = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registrations")
        .update({ payment_status: "verified" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment verified");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("approve_registration" as never, {
        _registration_id: id,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Approved — student added");
      invalidate();
      qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("registrations")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration rejected");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Registrations</h1>
        <p className="text-sm text-muted-foreground">Verify payments, approve or reject new sign-ups.</p>
      </header>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && data.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No registrations yet.
        </Card>
      )}

      <div className="space-y-3">
        {data.map((r) => {
          const isNew = r.status === "new";
          const rej = r.status === "rejected";
          const approved = r.status === "approved";
          return (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{r.name}</div>
                    <StatusBadge status={r.status} />
                    <PayBadge pay={r.payment_status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <a href={`tel:${r.phone}`} className="hover:underline inline-flex items-center gap-1">
                      <Phone className="size-3" /> {r.phone}
                    </a>
                    {r.guardian_name ? <> · Guardian: {r.guardian_name}</> : null}
                    {" · "}
                    {new Date(r.created_at).toLocaleString("en-IN")}
                  </div>
                  <div className="text-xs mt-1">
                    Batch: <span className="font-medium">{(r as any).batches?.name ?? "—"}</span>
                    {" · "}
                    Fee plan:{" "}
                    <span className="font-medium">
                      {(r as any).fee_plans?.name ?? "—"}
                      {(r as any).fee_plans?.amount ? ` · ₹${(r as any).fee_plans.amount}` : ""}
                    </span>
                  </div>
                  {r.payment_ref && (
                    <div className="text-xs text-muted-foreground mt-1">Payment ref: {r.payment_ref}</div>
                  )}
                </div>
              </div>
              {!approved && !rej && (
                <div className="flex flex-wrap gap-2">
                  {r.payment_status !== "verified" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verify.mutate(r.id)}
                      disabled={verify.isPending}
                    >
                      <Check className="size-4 mr-1" /> Verify payment
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => approve.mutate(r.id)}
                    disabled={approve.isPending || !isNew}
                    style={{ backgroundColor: "var(--brand)", color: "white" }}
                  >
                    <CheckCheck className="size-4 mr-1" /> Approve → Student
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => reject.mutate(r.id)}
                    disabled={reject.isPending}
                  >
                    <X className="size-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  return <Badge className={`${map[status] ?? ""} border-0 capitalize`} variant="secondary">{status}</Badge>;
}

function PayBadge({ pay }: { pay: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    verified: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
  };
  return (
    <Badge className={`${map[pay] ?? ""} border-0 capitalize`} variant="secondary">
      {pay}
    </Badge>
  );
}
