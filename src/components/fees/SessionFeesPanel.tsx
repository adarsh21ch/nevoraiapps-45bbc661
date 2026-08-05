/**
 * Sessions & Fees — the single source of truth for what an academy charges.
 *
 * A "fee plan" is not a separate thing an owner manages any more: every training
 * session (batch) owns its own monthly fee, and the academy has ONE one-time
 * admission fee. `fee_plans` rows still exist underneath (billing + the public
 * /fees page read them) but they are created / renamed / priced automatically
 * from the session they belong to, so the two can never drift apart.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchFeePlans, qk } from "@/lib/dashboard-queries";
import { findAdmissionPlan, type FeePlanLite } from "@/lib/billing-enrollment";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ShieldCheck, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { CoachAssignmentsDialog } from "@/components/staff/CoachAssignmentsDialog";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type SessionForm = {
  id?: string;
  name: string;
  timing: string;
  active: boolean;
  /** Monthly fee as typed by the owner — "" means this session has no fee yet. */
  amount: string;
  description: string;
  feePlanId: string | null;
};

export function SessionFeesPanel({ showCoaches = true }: { showCoaches?: boolean }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const batches = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const plans = useQuery({ queryKey: qk.feePlans(tenant.id), queryFn: () => fetchFeePlans(tenant.id) });

  const planList = (plans.data ?? []) as unknown as FeePlanLite[];
  const planById = new Map(planList.map((p) => [p.id, p]));
  const admission = findAdmissionPlan(planList);

  const [editing, setEditing] = useState<SessionForm | null>(null);
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [coachBatch, setCoachBatch] = useState<{ id: string; name: string } | null>(null);

  const del = useMutation({
    mutationFn: async (b: { id: string; fee_plan_id?: string | null }) => {
      const { error } = await supabase.from("batches").delete().eq("id", b.id);
      if (error) throw error;
      if (b.fee_plan_id) await supabase.from("fee_plans").delete().eq("id", b.fee_plan_id);
    },
    onSuccess: () => {
      toast.success("Session deleted");
      qc.invalidateQueries({ queryKey: qk.batches(tenant.id) });
      qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (batches.data ?? []) as any[];
  const linkedPlanIds = new Set(rows.map((b) => b.fee_plan_id).filter(Boolean));
  const orphans = planList.filter(
    (p) => p.id !== admission?.id && !linkedPlanIds.has(p.id),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Sessions &amp; fees</h2>
          <p className="text-sm text-muted-foreground">
            Each session carries its own monthly fee. This is what players are billed and what your
            public /fees page shows.
          </p>
        </div>
        <Button
          style={{ backgroundColor: "var(--brand)", color: "white" }}
          onClick={() =>
            setEditing({ name: "", timing: "", active: true, amount: "", description: "", feePlanId: null })
          }
        >
          <Plus className="size-4 mr-1" /> New session
        </Button>
      </header>

      {/* One-time admission fee — academy-wide, charged on a player's first invoice. */}
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <IndianRupee className="size-4 text-muted-foreground" />
            One-time admission fee
          </div>
          <p className="text-xs text-muted-foreground">
            Charged once, on a new player's first invoice — on top of their session fee.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-bold">
            {admission ? inr(Number(admission.amount ?? 0)) : "Not set"}
          </span>
          <Button size="icon" variant="ghost" aria-label="Edit admission fee" onClick={() => setAdmissionOpen(true)}>
            <Edit className="size-4" />
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((b) => {
          const count = b.students?.[0]?.count ?? 0;
          const plan = b.fee_plan_id ? planById.get(b.fee_plan_id) : null;
          return (
            <Card key={b.id} className="flex items-start justify-between p-4">
              <div className="min-w-0">
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.timing || "No timing set"}</div>
                <div className="mt-1 text-xs">
                  {count} player{count === 1 ? "" : "s"}
                  {b.active ? "" : " · inactive"}
                </div>
                <div className="mt-2">
                  {plan ? (
                    <span className="text-lg font-bold">{inr(Number(plan.amount ?? 0))}</span>
                  ) : (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      No fee set
                    </span>
                  )}
                  {plan && <span className="ml-1 text-xs text-muted-foreground">/ month</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {showCoaches && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Manage coaches"
                    aria-label={`Manage coaches for ${b.name}`}
                    onClick={() => setCoachBatch({ id: b.id, name: b.name })}
                  >
                    <ShieldCheck className="size-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit session ${b.name}`}
                  onClick={() =>
                    setEditing({
                      id: b.id,
                      name: b.name,
                      timing: b.timing ?? "",
                      active: b.active,
                      amount: plan?.amount != null ? String(plan.amount) : "",
                      description: (plan as any)?.description ?? "",
                      feePlanId: b.fee_plan_id ?? null,
                    })
                  }
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-rose-600"
                  aria-label={`Delete session ${b.name}`}
                  onClick={() =>
                    confirm(`Delete session "${b.name}" and its fee?`) &&
                    del.mutate({ id: b.id, fee_plan_id: b.fee_plan_id })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No sessions yet — create one and set its monthly fee.
          </Card>
        )}
      </div>

      {orphans.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Other fees</h3>
          <p className="text-xs text-muted-foreground">
            Older plans not attached to any session. Attach the amount to a session above, or remove them.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {orphans.map((p) => (
              <Card key={p.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{inr(Number(p.amount ?? 0))}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-rose-600"
                  aria-label={`Delete ${p.name}`}
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}"?`)) return;
                    const { error } = await supabase.from("fee_plans").delete().eq("id", p.id);
                    if (error) return toast.error(error.message);
                    toast.success("Removed");
                    qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <SessionDialog initial={editing} onClose={() => setEditing(null)} />
      )}
      {admissionOpen && (
        <AdmissionDialog
          plan={admission}
          onClose={() => setAdmissionOpen(false)}
        />
      )}
      {coachBatch && (
        <CoachAssignmentsDialog
          open={!!coachBatch}
          onOpenChange={(v) => !v && setCoachBatch(null)}
          tenantId={tenant.id}
          batchId={coachBatch.id}
          batchName={coachBatch.name}
        />
      )}
    </div>
  );
}

/** Create / edit one session AND the fee plan it owns, in a single transaction-ish save. */
function SessionDialog({ initial, onClose }: { initial: SessionForm; onClose: () => void }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);

  const save = useMutation({
    mutationFn: async () => {
      const amount = form.amount.trim() === "" ? null : Number(form.amount);
      if (amount != null && (!Number.isFinite(amount) || amount < 0)) throw new Error("Enter a valid fee");

      // 1. The fee plan mirrors the session: same name, same active state.
      let feePlanId = form.feePlanId;
      if (amount != null) {
        const planPayload = {
          tenant_id: tenant.id,
          name: form.name,
          description: form.description || null,
          amount,
          type: "monthly",
          active: form.active,
        };
        if (feePlanId) {
          const { error } = await supabase.from("fee_plans").update(planPayload).eq("id", feePlanId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("fee_plans")
            .insert(planPayload)
            .select("id")
            .single();
          if (error) throw error;
          feePlanId = data.id;
        }
      } else if (feePlanId) {
        // Fee cleared → hide the plan from the public page but keep history intact.
        await supabase.from("fee_plans").update({ active: false }).eq("id", feePlanId);
        feePlanId = null;
      }

      // 2. The session itself.
      const payload = {
        tenant_id: tenant.id,
        name: form.name,
        timing: form.timing || null,
        active: form.active,
        fee_plan_id: feePlanId,
      };
      if (form.id) {
        const { error } = await supabase.from("batches").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("batches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Session updated" : "Session created");
      qc.invalidateQueries({ queryKey: qk.batches(tenant.id) });
      qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit session" : "New session"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Session name</Label>
            <Input
              required
              placeholder="e.g. Morning Session"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timing</Label>
            <Input
              placeholder="e.g. 6:00 AM – 10:00 AM"
              value={form.timing}
              onChange={(e) => setForm({ ...form, timing: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly fee ₹</Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="e.g. 1500"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Every player in this session is billed this amount each month. Leave blank for a free
              session.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Public description</Label>
            <Input
              placeholder="Shown on your /fees page"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label>Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdmissionDialog({ plan, onClose }: { plan: FeePlanLite | null; onClose: () => void }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(plan?.amount != null ? String(plan.amount) : "");

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid amount");
      const payload = {
        tenant_id: tenant.id,
        name: plan?.name || "Registration Fee",
        description: "One-time joining fee",
        amount: value,
        type: "registration",
        active: true,
      };
      if (plan) {
        const { error } = await supabase.from("fee_plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Admission fee saved");
      qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>One-time admission fee</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Amount ₹</Label>
            <Input
              required
              type="number"
              min={0}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Added once to a new player's first invoice, alongside their session fee.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
