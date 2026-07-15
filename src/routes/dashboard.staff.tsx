import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Search,
  MoreVertical,
  Copy,
  RefreshCw,
  Ban,
  Trash2,
  Shield,
  Loader2,
  ClipboardList,
  ArrowLeft,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  inviteStaff,
  revokeInvitation,
  resendInvitation,
  disableStaff,
  setStaffRole,
} from "@/lib/staff/staff.functions";
import {
  fetchStaffMembers,
  fetchStaffInvitations,
  invitationStatus,
  ROLE_LABELS,
  staffKeys,
  type StaffMember,
  type StaffInvitation,
} from "@/lib/staff/queries";
import { removeMember } from "@/lib/removal";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { emitEvent } from "@/lib/automation/emit-client";
import { AUTOMATION_EVENTS } from "@/lib/automation/types";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ASSIGNABLE_ROLES: AppRole[] = ["head_coach", "coach", "assistant_coach", "admin", "staff"];

export const Route = createFileRoute("/dashboard/staff")({
  head: () => ({
    meta: [{ title: "Staff · Academy" }, { name: "robots", content: "noindex" }],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { tenant } = useDashboard();
  const navigate = useNavigate();
  const { can, isLoading: permLoading } = usePermissions();
  const canManage = can("canManageStaff");

  useEffect(() => {
    if (!permLoading && !canManage) navigate({ to: "/dashboard", replace: true });
  }, [canManage, permLoading, navigate]);

  const qc = useQueryClient();
  const membersQ = useQuery({
    queryKey: staffKeys.members(tenant.id),
    queryFn: () => fetchStaffMembers(tenant.id),
  });
  const invitesQ = useQuery({
    queryKey: staffKeys.invitations(tenant.id),
    queryFn: () => fetchStaffInvitations(tenant.id),
  });

  // Realtime — invalidate on any change in staff_invitations or coach_assignments.
  useEffect(() => {
    const ch = supabase
      .channel(`staff-${tenant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_invitations", filter: `tenant_id=eq.${tenant.id}` },
        () => qc.invalidateQueries({ queryKey: staffKeys.invitations(tenant.id) }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coach_assignments", filter: `tenant_id=eq.${tenant.id}` },
        () => qc.invalidateQueries({ queryKey: staffKeys.members(tenant.id) }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `tenant_id=eq.${tenant.id}` },
        () => qc.invalidateQueries({ queryKey: staffKeys.members(tenant.id) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tenant.id, qc]);

  if (permLoading || !canManage) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Link
        to="/dashboard/academy"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Manage
      </Link>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl grid place-items-center bg-lime-100 text-lime-700">
            <Users className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Staff Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Invite coaches, assign roles, manage batch assignments, and review activity.
            </p>
          </div>
          <InviteDialog tenantId={tenant.id} />
        </div>
      </Card>

      <StaffTabs
        membersCount={membersQ.data?.length ?? 0}
        pendingInvites={(invitesQ.data ?? []).filter((i) => invitationStatus(i) === "pending").length}
      >
        <TabsList className="hidden">
          <TabsTrigger value="directory" />
          <TabsTrigger value="invitations" />
          <TabsTrigger value="activity" />
        </TabsList>

        <TabsContent value="directory" className="mt-4">
          <Directory
            members={membersQ.data ?? []}
            isLoading={membersQ.isLoading}
            isError={membersQ.isError}
            tenantId={tenant.id}
          />
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <Invitations
            invitations={invitesQ.data ?? []}
            isLoading={invitesQ.isLoading}
            isError={invitesQ.isError}
            tenantId={tenant.id}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityFeed tenantId={tenant.id} />
        </TabsContent>
      </StaffTabs>
    </div>
  );
}

function StaffTabs({
  membersCount,
  pendingInvites,
  children,
}: {
  membersCount: number;
  pendingInvites: number;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState<string>("directory");
  return (
    <Tabs value={value} onValueChange={setValue}>
      <FilterTabs
        value={value}
        onChange={setValue}
        items={[
          { key: "directory", label: "Directory", count: membersCount },
          { key: "invitations", label: "Invitations", count: pendingInvites },
          { key: "activity", label: "Activity" },
        ]}
        ariaLabel="Staff sections"
      />
      {children}
    </Tabs>
  );
}

/* -------------------- Invite dialog -------------------- */

function InviteDialog({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteStaff);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("coach");
  const [tempPassword, setTempPassword] = useState("");
  const [lastInvite, setLastInvite] = useState<{ inviteUrl: string; token: string } | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      if (!email.trim() && !phone.trim()) throw new Error("Provide an email or phone number");
      return invite({
        data: {
          tenantId,
          email: email.trim() || null,
          phone: phone.trim() || null,
          invitedRole: role as
            | "coach"
            | "head_coach"
            | "assistant_coach"
            | "admin"
            | "staff",
          tempPassword: tempPassword.trim() || null,
          displayName: displayName.trim() || null,
        },
      });
    },
    onSuccess: (r) => {
      toast.success("Invitation created");
      setLastInvite({ inviteUrl: r.inviteUrl, token: r.token });
      emitEvent({
        tenantId,
        eventType: AUTOMATION_EVENTS.StaffInvited,
        sourceModule: "staff",
        sourceId: r.id,
        payload: { email: r.email, phone: r.phone, role: r.invited_role },
      });
      qc.invalidateQueries({ queryKey: staffKeys.invitations(tenantId) });
      setDisplayName("");
      setEmail("");
      setPhone("");
      setTempPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink() {
    if (!lastInvite) return;
    const full = `${window.location.origin}${lastInvite.inviteUrl}`;
    navigator.clipboard.writeText(full).then(
      () => toast.success("Invitation link copied"),
      () => toast.error("Copy failed — copy manually"),
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setLastInvite(null); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4 mr-1.5" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite staff</DialogTitle>
        </DialogHeader>

        {lastInvite ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/40">
              <div className="text-xs text-muted-foreground mb-1">Share this link with the invitee</div>
              <div className="flex items-center gap-2">
                <code className="text-xs truncate flex-1">
                  {window.location.origin}
                  {lastInvite.inviteUrl}
                </code>
                <Button size="sm" variant="secondary" onClick={copyLink}>
                  <Copy className="size-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The invitee will open this link, create a password, and be assigned the role you selected.
              Invitations expire in 14 days.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setLastInvite(null); setOpen(false); }}>
                Done
              </Button>
              <Button variant="secondary" onClick={() => setLastInvite(null)}>
                Invite another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Full name (optional)</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Rahul Sharma"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@academy.com"
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 90000 00000"
                />
              </div>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Temporary password (optional)</Label>
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Only if you want to preset one"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to let the invitee choose their own on first sign-in.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => m.mutate()} disabled={m.isPending}>
                {m.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Send invitation
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Directory -------------------- */

function Directory({
  members,
  isLoading,
  isError,
  tenantId,
}: {
  members: StaffMember[];
  isLoading: boolean;
  isError: boolean;
  tenantId: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AppRole>("all");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (filter !== "all" && !m.all_roles.includes(filter)) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        m.user_id.toLowerCase().includes(q) ||
        m.primary_role.toLowerCase().includes(q) ||
        m.assignments.some((a) => a.batch_name.toLowerCase().includes(q))
      );
    });
  }, [members, filter, query]);

  if (isLoading) return <SkeletonList />;
  if (isError) {
    return <Card className="p-6 text-sm text-destructive">Failed to load staff.</Card>;
  }
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No staff yet"
        body="Invite your first coach, head coach or admin to get started."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by role, batch…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="sm:w-52">
            <Filter className="size-4 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ASSIGNABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No staff match your filters.
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((m) => (
            <MemberRow key={m.user_id} member={m} tenantId={tenantId} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, tenantId }: { member: StaffMember; tenantId: string }) {
  const qc = useQueryClient();
  const disable = useServerFn(disableStaff);
  const changeRole = useServerFn(setStaffRole);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isOwner = member.all_roles.includes("owner");

  const disableM = useMutation({
    mutationFn: () => disable({ data: { tenantId, userId: member.user_id } }),
    onSuccess: () => {
      toast.success("Access disabled");
      emitEvent({
        tenantId,
        eventType: AUTOMATION_EVENTS.StaffDisabled,
        sourceModule: "staff",
        sourceId: member.user_id,
        payload: { role: member.primary_role },
      });
      qc.invalidateQueries({ queryKey: staffKeys.members(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleM = useMutation({
    mutationFn: (newRole: AppRole) =>
      changeRole({
        data: {
          tenantId,
          userId: member.user_id,
          newRole: newRole as
            | "coach"
            | "head_coach"
            | "assistant_coach"
            | "admin"
            | "staff",
          oldRole: member.primary_role,
        },
      }),
    onSuccess: (_r, vars) => {
      toast.success("Role updated");
      emitEvent({
        tenantId,
        eventType: AUTOMATION_EVENTS.StaffRoleChanged,
        sourceModule: "staff",
        sourceId: member.user_id,
        payload: { old_role: member.primary_role, new_role: vars },
      });
      qc.invalidateQueries({ queryKey: staffKeys.members(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="size-10 rounded-full grid place-items-center bg-muted text-muted-foreground shrink-0">
        <Shield className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {member.user_id.slice(0, 8)}…
          </span>
          <Badge variant={isOwner ? "default" : "secondary"}>
            {ROLE_LABELS[member.primary_role] ?? member.primary_role}
          </Badge>
          {member.all_roles.length > 1 && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              +{member.all_roles.length - 1}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {member.assignments.length === 0
            ? "No batch assignments"
            : `${member.assignments.length} batch${member.assignments.length === 1 ? "" : "es"} · ${member.assignments
                .slice(0, 2)
                .map((a) => a.batch_name)
                .join(", ")}${member.assignments.length > 2 ? "…" : ""}`}
        </div>
      </div>
      {!isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ASSIGNABLE_ROLES.filter((r) => r !== member.primary_role).map((r) => (
              <DropdownMenuItem key={r} onClick={() => roleM.mutate(r)}>
                <Shield className="size-4 mr-2" /> Set as {ROLE_LABELS[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => disableM.mutate()} className="text-amber-700">
              <Ban className="size-4 mr-2" /> Disable access
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmRemove(true)}
              className="text-destructive"
            >
              <Trash2 className="size-4 mr-2" /> Remove from academy
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDeleteDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove staff member"
        description="This removes the member from the academy immediately. They lose all access."
        confirmLabel="Remove"
        onConfirm={async () => {
          // Look up profile id
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", member.user_id)
            .eq("tenant_id", tenantId)
            .maybeSingle();
          if (!prof?.id) throw new Error("Profile not found");
          await removeMember(prof.id);
          toast.success("Member removed");
          qc.invalidateQueries({ queryKey: staffKeys.members(tenantId) });
        }}
      />
    </Card>
  );
}

/* -------------------- Invitations -------------------- */

function Invitations({
  invitations,
  isLoading,
  isError,
  tenantId,
}: {
  invitations: StaffInvitation[];
  isLoading: boolean;
  isError: boolean;
  tenantId: string;
}) {
  if (isLoading) return <SkeletonList />;
  if (isError) return <Card className="p-6 text-sm text-destructive">Failed to load invitations.</Card>;
  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No invitations yet"
        body="Send your first invitation from the button above."
      />
    );
  }

  return (
    <div className="grid gap-2">
      {invitations.map((inv) => (
        <InvitationRow key={inv.id} inv={inv} tenantId={tenantId} />
      ))}
    </div>
  );
}

function InvitationRow({ inv, tenantId }: { inv: StaffInvitation; tenantId: string }) {
  const qc = useQueryClient();
  const status = invitationStatus(inv);
  const resend = useServerFn(resendInvitation);
  const revoke = useServerFn(revokeInvitation);

  const resendM = useMutation({
    mutationFn: () => resend({ data: { id: inv.id, tenantId } }),
    onSuccess: (r) => {
      toast.success("Invitation resent");
      navigator.clipboard.writeText(`${window.location.origin}${r.inviteUrl}`).catch(() => {});
      qc.invalidateQueries({ queryKey: staffKeys.invitations(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: () => revoke({ data: { id: inv.id, tenantId } }),
    onSuccess: () => {
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: staffKeys.invitations(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink() {
    const url = `${window.location.origin}/invite/${inv.token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <Card className="p-3 flex items-center gap-3">
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            {inv.email ?? inv.phone ?? "—"}
          </span>
          <Badge variant="secondary">{ROLE_LABELS[inv.invited_role] ?? inv.invited_role}</Badge>
          <StatusBadge status={status} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {inv.email && <Mail className="size-3 inline mr-1" />}
          {inv.phone && <Phone className="size-3 inline mr-1" />}
          Invited {new Date(inv.created_at).toLocaleDateString()} · expires{" "}
          {new Date(inv.expires_at).toLocaleDateString()}
        </div>
      </div>
      {status === "pending" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyLink}>
              <Copy className="size-4 mr-2" /> Copy invite link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => resendM.mutate()}>
              <RefreshCw className="size-4 mr-2" /> Reset & resend
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => revokeM.mutate()} className="text-destructive">
              <Ban className="size-4 mr-2" /> Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {(status === "expired" || status === "revoked") && (
        <Button size="sm" variant="secondary" onClick={() => resendM.mutate()}>
          <RefreshCw className="size-3.5 mr-1" /> Reissue
        </Button>
      )}
    </Card>
  );
}

function StatusIcon({ status }: { status: ReturnType<typeof invitationStatus> }) {
  const cls = "size-4 shrink-0";
  if (status === "accepted") return <CheckCircle2 className={`${cls} text-emerald-600`} />;
  if (status === "expired") return <Clock className={`${cls} text-amber-600`} />;
  if (status === "revoked") return <XCircle className={`${cls} text-destructive`} />;
  return <Clock className={`${cls} text-blue-600`} />;
}
function StatusBadge({ status }: { status: ReturnType<typeof invitationStatus> }) {
  const map: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    accepted: "bg-emerald-100 text-emerald-700",
    expired: "bg-amber-100 text-amber-700",
    revoked: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

/* -------------------- Activity -------------------- */

function ActivityFeed({ tenantId }: { tenantId: string }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: staffKeys.activity(tenantId),
    queryFn: async () => {
      // Reuse existing platform_audit_log — filter to staff-related actions.
      const { data, error } = await supabase
        .from("platform_audit_log")
        .select("id, actor_id, target_type, target_id, action, created_at")
        .eq("tenant_id", tenantId)
        .in("target_type", ["staff_invitations", "coach_assignments", "user_roles", "profiles"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <SkeletonList />;
  if (isError) return <Card className="p-6 text-sm text-destructive">Failed to load activity.</Card>;
  if (data.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No staff activity yet"
        body="Staff invitations, role changes and batch assignments will appear here."
      />
    );
  }
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {data.map((row) => (
        <div key={row.id} className="p-3 text-xs flex items-center gap-3">
          <ClipboardList className="size-3.5 text-muted-foreground" />
          <span className="font-mono">{row.action}</span>
          <span className="text-muted-foreground">{row.target_type}</span>
          <span className="ml-auto text-muted-foreground">
            {new Date(row.created_at).toLocaleString()}
          </span>
        </div>
      ))}
    </Card>
  );
}

/* -------------------- Shared bits -------------------- */

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-3 flex items-center gap-3">
          <div className="size-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="size-12 mx-auto rounded-full grid place-items-center bg-muted mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{body}</div>
    </Card>
  );
}
