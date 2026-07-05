import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchFeePlans, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/fee-plans")({
  component: FeePlansPage,
});

type PlanForm = { id?: string; name: string; description: string; amount: string; type: string; active: boolean };

function FeePlansPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: qk.feePlans(tenant.id), queryFn: () => fetchFeePlans(tenant.id) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanForm | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fee_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee plan deleted");
      qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee plans</h1>
          <p className="text-sm text-muted-foreground">These show on your public /fees page.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: "var(--brand)", color: "white" }} onClick={() => setEditing({ name: "", description: "", amount: "", type: "monthly", active: true })}>
              <Plus className="size-4 mr-1" /> New plan
            </Button>
          </DialogTrigger>
          {editing && <PlanDialog initial={editing} onClose={() => { setOpen(false); setEditing(null); }} />}
        </Dialog>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {(plans.data ?? []).map((p) => (
          <Card key={p.id} className="p-4 flex items-start justify-between">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{p.type.replace("_", " ")}</div>
              {p.description && <div className="text-xs mt-1">{p.description}</div>}
              <div className="mt-2 text-lg font-bold">₹{Number(p.amount).toLocaleString("en-IN")}</div>
              {!p.active && <div className="text-xs mt-1 text-amber-600">Inactive (hidden from public site)</div>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing({ id: p.id, name: p.name, description: p.description ?? "", amount: String(p.amount), type: p.type, active: p.active }); setOpen(true); }}>
                <Edit className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => confirm(`Delete "${p.name}"?`) && del.mutate(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
        {plans.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">No fee plans yet.</Card>
        )}
      </div>
    </div>
  );
}

function PlanDialog({ initial, onClose }: { initial: PlanForm; onClose: () => void }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant.id,
        name: form.name,
        description: form.description || null,
        amount: Number(form.amount),
        type: form.type,
        active: form.active,
      };
      if (form.id) {
        const { error } = await supabase.from("fee_plans").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Fee plan updated" : "Fee plan created");
      qc.invalidateQueries({ queryKey: qk.feePlans(tenant.id) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>{form.id ? "Edit fee plan" : "New fee plan"}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>Amount ₹</Label><Input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> <Label>Active</Label></div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
