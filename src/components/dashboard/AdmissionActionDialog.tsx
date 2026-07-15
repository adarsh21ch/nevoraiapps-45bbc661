import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  approveRegistration,
  requestRegistrationChanges,
} from "@/lib/admissions/admissions.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Props = {
  registrationId: string | null;
  tenantId: string;
  mode: "approve" | "changes" | null;
  onClose: () => void;
};

export function AdmissionActionDialog({ registrationId, tenantId, mode, onClose }: Props) {
  const open = Boolean(registrationId && mode);
  const qc = useQueryClient();
  const approve = useServerFn(approveRegistration);
  const requestChanges = useServerFn(requestRegistrationChanges);

  const [batchId, setBatchId] = useState<string>("");
  const [feePlanId, setFeePlanId] = useState<string>("");
  const [rollNumber, setRollNumber] = useState("");
  const [coachName, setCoachName] = useState("");
  const [admissionDate, setAdmissionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const batches = useQuery({
    queryKey: ["batches", tenantId],
    enabled: open && mode === "approve",
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id, name").eq("tenant_id", tenantId);
      return data ?? [];
    },
  });
  const plans = useQuery({
    queryKey: ["fee-plans", tenantId],
    enabled: open && mode === "approve",
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_plans")
        .select("id, name")
        .eq("tenant_id", tenantId);
      return data ?? [];
    },
  });

  const reset = () => {
    setBatchId(""); setFeePlanId(""); setRollNumber(""); setNotes("");
    onClose();
  };

  const approveMut = useMutation({
    mutationFn: () =>
      approve({
        data: {
          registrationId: registrationId!,
          tenantId,
          batchId: batchId || null,
          feePlanId: feePlanId || null,
          rollNumber: rollNumber || null,
          notes: notes || null,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("Registration approved");
      if (res?.activationToken) {
        const link = `${window.location.origin}/activate/${res.activationToken}`;
        navigator.clipboard?.writeText(link).catch(() => {});
        toast.message("Activation link copied to clipboard");
      }
      qc.invalidateQueries({ queryKey: ["admissions"] });
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to approve"),
  });

  const changesMut = useMutation({
    mutationFn: () =>
      requestChanges({
        data: { registrationId: registrationId!, tenantId, notes },
      }),
    onSuccess: () => {
      toast.success("Change request sent");
      qc.invalidateQueries({ queryKey: ["admissions"] });
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && reset()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "approve" ? "Approve registration" : "Request changes"}
          </DialogTitle>
        </DialogHeader>
        {mode === "approve" ? (
          <div className="space-y-3">
            <div>
              <Label>Assign Batch</Label>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">— none —</option>
                {(batches.data ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Assign Fee Plan</Label>
              <select
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                value={feePlanId}
                onChange={(e) => setFeePlanId(e.target.value)}
              >
                <option value="">— none —</option>
                {(plans.data ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Roll Number (optional)</Label>
              <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Approval creates the student, sets lifecycle to Approved, and generates an activation
              link that will be copied to your clipboard.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>What needs to change?</Label>
            <Textarea
              rows={5}
              placeholder="Describe missing documents or corrections needed…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={reset}>Cancel</Button>
          {mode === "approve" ? (
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              {approveMut.isPending ? "Approving…" : "Approve"}
            </Button>
          ) : (
            <Button
              onClick={() => changesMut.mutate()}
              disabled={changesMut.isPending || notes.trim().length < 3}
            >
              {changesMut.isPending ? "Sending…" : "Send request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
