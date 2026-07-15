/**
 * Coach Assignments dialog — assign multiple coaches to one batch.
 * Reused inside the batches management page.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  assignCoachToBatch,
  removeCoachAssignment,
} from "@/lib/staff/staff.functions";
import { fetchStaffMembers, ROLE_LABELS, staffKeys } from "@/lib/staff/queries";
import { emitEvent } from "@/lib/automation/emit-client";
import { AUTOMATION_EVENTS } from "@/lib/automation/types";
import type { Database } from "@/integrations/supabase/types";

type CoachRole = "head_coach" | "coach" | "assistant_coach";
type Assignment = {
  id: string;
  coach_user_id: string;
  coach_role: Database["public"]["Enums"]["app_role"];
  assigned_at: string;
};

export function CoachAssignmentsDialog({
  open,
  onOpenChange,
  tenantId,
  batchId,
  batchName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  batchId: string;
  batchName: string;
}) {
  const qc = useQueryClient();
  const assignFn = useServerFn(assignCoachToBatch);
  const removeFn = useServerFn(removeCoachAssignment);

  const assignmentsQ = useQuery({
    queryKey: ["batch", batchId, "assignments"],
    enabled: open,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase
        .from("coach_assignments")
        .select("id, coach_user_id, coach_role, assigned_at")
        .eq("tenant_id", tenantId)
        .eq("batch_id", batchId)
        .eq("active", true)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const staffQ = useQuery({
    queryKey: staffKeys.members(tenantId),
    enabled: open,
    queryFn: () => fetchStaffMembers(tenantId),
  });

  const coaches = (staffQ.data ?? []).filter((m) =>
    m.all_roles.some((r) => r === "coach" || r === "head_coach" || r === "assistant_coach"),
  );

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<CoachRole>("coach");

  const assigned = new Set((assignmentsQ.data ?? []).map((a) => a.coach_user_id));

  const assignM = useMutation({
    mutationFn: () =>
      assignFn({
        data: {
          tenantId,
          batchId,
          coachUserId: selectedUser,
          coachRole: selectedRole,
        },
      }),
    onSuccess: (r) => {
      toast.success(r.updated ? "Assignment updated" : "Coach assigned");
      emitEvent({
        tenantId,
        eventType: r.updated
          ? AUTOMATION_EVENTS.StaffAssignmentUpdated
          : AUTOMATION_EVENTS.StaffAssignmentCreated,
        sourceModule: "staff",
        sourceId: r.id,
        payload: { batch_id: batchId, batch_name: batchName, coach_user_id: selectedUser, coach_role: selectedRole },
      });
      setSelectedUser("");
      qc.invalidateQueries({ queryKey: ["batch", batchId, "assignments"] });
      qc.invalidateQueries({ queryKey: staffKeys.members(tenantId) });
      qc.invalidateQueries({ queryKey: staffKeys.assignments(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { tenantId, id } }),
    onSuccess: (_r, id) => {
      toast.success("Assignment removed");
      emitEvent({
        tenantId,
        eventType: AUTOMATION_EVENTS.StaffAssignmentRemoved,
        sourceModule: "staff",
        sourceId: id,
        payload: { batch_id: batchId, batch_name: batchName },
      });
      qc.invalidateQueries({ queryKey: ["batch", batchId, "assignments"] });
      qc.invalidateQueries({ queryKey: staffKeys.members(tenantId) });
      qc.invalidateQueries({ queryKey: staffKeys.assignments(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eligible = coaches.filter((c) => !assigned.has(c.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Coaches — {batchName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
              Assigned coaches
            </div>
            {assignmentsQ.isLoading ? (
              <div className="text-sm text-muted-foreground py-4 grid place-items-center">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (assignmentsQ.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-3">No coaches assigned yet.</div>
            ) : (
              <div className="space-y-1.5">
                {(assignmentsQ.data ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <ShieldCheck className="size-4 text-muted-foreground" />
                    <span className="font-mono text-xs">{a.coach_user_id.slice(0, 8)}…</span>
                    <Badge variant="secondary">{ROLE_LABELS[a.coach_role] ?? a.coach_role}</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(a.assigned_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeM.mutate(a.id)}
                      disabled={removeM.isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2.5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Assign a coach
            </div>
            {eligible.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                All coaches are already assigned to this batch. Invite more from Staff Management.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose coach" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((c) => (
                      <SelectItem key={c.user_id} value={c.user_id}>
                        {c.user_id.slice(0, 8)}… · {ROLE_LABELS[c.primary_role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedRole}
                  onValueChange={(v) => setSelectedRole(v as CoachRole)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head_coach">Head Coach</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="assistant_coach">Assistant</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => assignM.mutate()}
                  disabled={!selectedUser || assignM.isPending}
                >
                  <UserPlus className="size-4 mr-1.5" /> Assign
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
