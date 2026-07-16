import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, qk } from "@/lib/dashboard-queries";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CoachAssignmentsDialog } from "@/components/staff/CoachAssignmentsDialog";


export const Route = createFileRoute("/dashboard/batches")({
  component: BatchesPage,
});

type BatchForm = { id?: string; name: string; timing: string; active: boolean };

function BatchesPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BatchForm | null>(null);
  const [coachBatch, setCoachBatch] = useState<{ id: string; name: string } | null>(null);


  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batch deleted");
      qc.invalidateQueries({ queryKey: qk.batches(tenant.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Batches</h1>
          <p className="text-sm text-muted-foreground">Groups your students train with.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button
              style={{ backgroundColor: "var(--brand)", color: "white" }}
              onClick={() => setEditing({ name: "", timing: "", active: true })}
            >
              <Plus className="size-4 mr-1" /> New batch
            </Button>
          </DialogTrigger>
          {editing && (
            <BatchDialog
              initial={editing}
              onClose={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          )}
        </Dialog>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {(batches.data ?? []).map((b) => {
          const count = (b as any).students?.[0]?.count ?? 0;
          return (
            <Card key={b.id} className="p-4 flex items-start justify-between">
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.timing || "No timing set"}</div>
                <div className="text-xs mt-1">
                  {count} student{count === 1 ? "" : "s"}
                  {b.active ? "" : " · inactive"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Manage coaches"
                  onClick={() => setCoachBatch({ id: b.id, name: b.name })}
                >
                  <ShieldCheck className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit batch ${b.name}`}
                  onClick={() => {
                    setEditing({
                      id: b.id,
                      name: b.name,
                      timing: b.timing ?? "",
                      active: b.active,
                    });
                    setOpen(true);
                  }}
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-rose-600"
                  onClick={() => confirm(`Delete batch "${b.name}"?`) && del.mutate(b.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

            </Card>
          );
        })}
        {batches.data?.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
            No batches yet.
          </Card>
        )}
      </div>

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


function BatchDialog({ initial, onClose }: { initial: BatchForm; onClose: () => void }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant.id,
        name: form.name,
        timing: form.timing || null,
        active: form.active,
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
      toast.success(form.id ? "Batch updated" : "Batch created");
      qc.invalidateQueries({ queryKey: qk.batches(tenant.id) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{form.id ? "Edit batch" : "New batch"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Timing</Label>
          <Input
            placeholder="e.g. Mon–Sat 6–8 AM"
            value={form.timing}
            onChange={(e) => setForm({ ...form, timing: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />{" "}
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
  );
}
