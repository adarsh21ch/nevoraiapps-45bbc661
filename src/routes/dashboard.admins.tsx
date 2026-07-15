import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ds/Card";
import { useDashboard } from "@/lib/dashboard-context";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { DangerZone } from "@/components/shared/DangerZone";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { removeMember } from "@/lib/removal";

export const Route = createFileRoute("/dashboard/admins")({
  head: () => ({ meta: [{ title: "Team & Access · Academy" }, { name: "robots", content: "noindex" }] }),
  component: AdminsEntry,
});

type MemberRow = { id: string; user_id: string; role: string; created_at: string };

function AdminsEntry() {
  const { tenant, session } = useDashboard();
  const navigate = useNavigate();
  const { isOwner: owner } = usePermissions();

  useEffect(() => {
    if (!owner) navigate({ to: "/dashboard/academy", replace: true });
  }, [owner, navigate]);

  if (!owner) {
    return (
      <div className="grid place-items-center py-16 text-center text-muted-foreground">
        <Lock className="size-5 mb-2" />
        <p className="text-sm">Owner-only area</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Manage
      </Link>
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl grid place-items-center" style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)", color: "var(--brand)" }}>
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Team & Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage coaches, admins and staff for this academy.
            </p>
          </div>
        </div>
      </Card>

      <MembersList tenantId={tenant.id} currentUserId={session?.user?.id ?? null} />
    </div>
  );
}

function MembersList({ tenantId, currentUserId }: { tenantId: string; currentUserId: string | null }) {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["d", "members", tenantId],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, role, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const removable = useMemo(
    () => members.filter((m) => m.user_id !== currentUserId && m.role !== "owner"),
    [members, currentUserId],
  );

  const [target, setTarget] = useState<MemberRow | null>(null);

  if (isLoading) {
    return <Card className="p-4 text-sm text-muted-foreground">Loading members…</Card>;
  }
  if (removable.length === 0) {
    return <Card className="p-4 text-sm text-muted-foreground">No coaches, admins or staff yet.</Card>;
  }

  return (
    <>
      <DangerZone
        title="Coaches, admins & staff"
        description="Removing a member instantly revokes their access to this academy."
        actions={removable.map((m) => ({
          label: `Remove ${roleLabel(m.role)}`,
          description: `Member ID ${m.user_id.slice(0, 8)}… · joined ${new Date(m.created_at).toLocaleDateString()}`,
          onClick: () => setTarget(m),
        }))}
      />

      <ConfirmDeleteDialog
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        title="Remove member"
        description={`This removes this ${target ? roleLabel(target.role) : "member"} from the academy immediately. They will lose all access.`}
        confirmLabel="Remove member"
        onConfirm={async () => {
          if (!target) return;
          try {
            await removeMember(target.id);
            toast.success("Member removed");
            qc.invalidateQueries({ queryKey: ["d", "members", tenantId] });
          } catch (e: any) {
            toast.error(e.message ?? "Failed to remove member");
            throw e;
          }
        }}
      />
    </>
  );
}

function roleLabel(role: string) {
  if (role === "coach") return "coach";
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  if (role === "owner") return "owner";
  return role;
}
