import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users2,
  PlusCircle,
  Trash2,
  Save,
  BarChart3,
  History,
  Swords,
  Settings as SettingsIcon,
  LayoutDashboard,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { TeamHeader, PlayerGrid, CaptainBadge } from "@/components/match-center/team-ui";
import { PlayerSelector } from "@/components/match-center/PlayerSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard-context";
import {
  addPlayersToTeam,
  AGE_GROUPS,
  deleteTeam,
  getTeam,
  listStudents,
  listTeamPlayers,
  removePlayerFromTeam,
  setCaptaincy,
  TEAM_STATUSES,
  updateTeam,
} from "@/lib/mc-teams";
import { toast } from "sonner";
import { useDemoData, useDemoEntity } from "@/lib/mc-demo/store";
import { DemoTeamProfile } from "@/components/match-center/demo-team-profile";


export const Route = createFileRoute("/match-center/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: TeamProfilePage,
});

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "players", label: "Players", icon: Users2 },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "matches", label: "Matches", icon: Swords },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TeamProfilePage() {
  const { teamId } = Route.useParams();
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const demoEntity = useDemoEntity(tenant.id, teamId);

  const teamQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-team", tenant.id, teamId],
    queryFn: () => getTeam(tenant.id, teamId),
  });
  const playersQ = useQuery({
    queryKey: ["mc-team-players", teamId],
    queryFn: () => listTeamPlayers(teamId),
  });
  const studentsQ = useQuery({
    queryKey: ["mc-students", tenant.id],
    queryFn: () => listStudents(tenant.id),
  });

  const team = teamQ.data;
  const rosterRows = playersQ.data ?? [];
  const students = studentsQ.data ?? [];
  const studentsById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  const rosterView = useMemo(
    () =>
      rosterRows
        .map((r) => {
          const s = studentsById[r.student_id];
          if (!s) return null;
          return {
            id: s.id,
            name: s.name,
            photo_url: s.photo_url,
            dob: s.dob,
            player_id: s.player_id,
            role: r.role,
            batting_style: r.batting_style,
            bowling_style: r.bowling_style,
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        photo_url: string | null;
        dob: string | null;
        player_id: string | null;
        role: string | null;
        batting_style: string | null;
        bowling_style: string | null;
      }>,
    [rosterRows, studentsById],
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["mc-team", tenant.id, teamId] });
    qc.invalidateQueries({ queryKey: ["mc-team-players", teamId] });
    qc.invalidateQueries({ queryKey: ["mc-teams", tenant.id] });
  };

  const addPlayersM = useMutation({
    mutationFn: (ids: string[]) => addPlayersToTeam(tenant.id, teamId, ids),
    onSuccess: () => {
      toast.success("Players added");
      setAddOpen(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePlayerM = useMutation({
    mutationFn: (studentId: string) => removePlayerFromTeam(teamId, studentId),
    onSuccess: () => {
      toast.success("Player removed");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const captainM = useMutation({
    mutationFn: ({
      field,
      studentId,
    }: {
      field: "captain_student_id" | "vice_captain_student_id" | "keeper_student_id";
      studentId: string | null;
    }) => setCaptaincy(teamId, field, studentId),
    onSuccess: () => {
      toast.success("Updated");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (demoEntity && demoEntity.kind === "team") {
    return <DemoTeamWrapper tenantId={tenant.id} teamId={demoEntity.team.id} />;
  }
  if (demoEntity) {
    // Non-team demo entity landed on a team route — send them back.
    return (
      <EmptyState
        icon={Users2}
        title="Not a team"
        description="This demo entity is not a team."
      />
    );
  }



  if (teamQ.isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading team…</div>
    );
  }

  if (!team) {
    return (
      <div>
        <PageHeader
          title="Team not found"
          breadcrumbs={[
            { label: "Match Center", to: "/match-center/dashboard" },
            { label: "Teams", to: "/match-center/teams" },
          ]}
        />
        <EmptyState
          icon={Users2}
          title="This team no longer exists"
          description="It may have been deleted. Head back to the team list."
          actionLabel="Back to teams"
          actionTo="/match-center/teams"
        />
      </div>
    );
  }

  const excludeIds = rosterRows.map((r) => r.student_id);

  return (
    <div>
      <PageHeader
        title={team.name}
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Teams", to: "/match-center/teams" },
          { label: team.name },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/match-center/teams">
              <ArrowLeft className="size-4 mr-1.5" /> All teams
            </Link>
          </Button>
        }
      />

      <TeamHeader team={{ ...team, player_count: rosterRows.length }} onEdit={() => setTab("settings")} />

      {/* Tabs */}
      <div className="mb-6 -mx-1 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
              {active && (
                <span
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OverviewTab
          team={team}
          rosterCount={rosterRows.length}
          captainName={studentsById[team.captain_student_id ?? ""]?.name}
          viceCaptainName={studentsById[team.vice_captain_student_id ?? ""]?.name}
          keeperName={studentsById[team.keeper_student_id ?? ""]?.name}
        />
      )}

      {tab === "players" && (
        <PlayersTab
          rosterView={rosterView}
          team={team}
          onAdd={() => setAddOpen(true)}
          onRemove={(id) => {
            if (confirm("Remove player from squad?")) removePlayerM.mutate(id);
          }}
          onSetCaptain={(id) =>
            captainM.mutate({
              field: "captain_student_id",
              studentId: team.captain_student_id === id ? null : id,
            })
          }
          onSetVice={(id) =>
            captainM.mutate({
              field: "vice_captain_student_id",
              studentId: team.vice_captain_student_id === id ? null : id,
            })
          }
          onSetKeeper={(id) =>
            captainM.mutate({
              field: "keeper_student_id",
              studentId: team.keeper_student_id === id ? null : id,
            })
          }
        />
      )}

      {tab === "stats" && (
        <EmptyState
          icon={BarChart3}
          title="Statistics coming soon"
          description="Batting, bowling and fielding numbers will roll up here once matches are played."
        />
      )}

      {tab === "matches" && (
        <EmptyState
          icon={Swords}
          title="No matches yet"
          description="This team hasn't played any matches. Create one from Match Center."
        />
      )}

      {tab === "history" && (
        <EmptyState
          icon={History}
          title="No history yet"
          description="Season-over-season records and roster history will appear here."
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          team={team}
          onSaved={() => invalidateAll()}
          onDeleted={() => navigate({ to: "/match-center/teams" })}
        />
      )}

      {/* Add players dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add players to squad</DialogTitle>
          </DialogHeader>
          <AddPlayersDialogBody
            students={students}
            excludeIds={excludeIds}
            loading={studentsQ.isLoading}
            onSubmit={(ids) => addPlayersM.mutate(ids)}
            submitting={addPlayersM.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewTab({
  team,
  rosterCount,
  captainName,
  viceCaptainName,
  keeperName,
}: {
  team: NonNullable<Awaited<ReturnType<typeof getTeam>>>;
  rosterCount: number;
  captainName?: string;
  viceCaptainName?: string;
  keeperName?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Info label="Coach" value={team.coach_name || "—"} />
      <Info label="Assistant coach" value={team.assistant_coach_name || "—"} />
      <Info label="Season" value={team.season || "—"} />
      <Info label="Age group" value={team.age_group === "Custom" ? team.age_group_custom || "Custom" : team.age_group || "—"} />
      <Info label="Players" value={String(rosterCount)} />
      <Info label="Created" value={new Date(team.created_at).toLocaleDateString()} />
      <Info
        label="Captain"
        value={captainName || "Not set"}
        badge={captainName ? <CaptainBadge kind="captain" /> : undefined}
      />
      <Info
        label="Vice captain"
        value={viceCaptainName || "Not set"}
        badge={viceCaptainName ? <CaptainBadge kind="vice" /> : undefined}
      />
      <Info
        label="Wicket keeper"
        value={keeperName || "Not set"}
        badge={keeperName ? <CaptainBadge kind="keeper" /> : undefined}
      />
    </div>
  );
}

function Info({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        <span>{label}</span>
        {badge}
      </div>
      <div className="mt-2 text-base font-semibold truncate">{value}</div>
    </div>
  );
}

/* ---------------- Players tab ---------------- */

function PlayersTab({
  rosterView,
  team,
  onAdd,
  onRemove,
  onSetCaptain,
  onSetVice,
  onSetKeeper,
}: {
  rosterView: Array<{
    id: string;
    name: string;
    photo_url: string | null;
    dob: string | null;
    player_id: string | null;
    role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
  }>;
  team: NonNullable<Awaited<ReturnType<typeof getTeam>>>;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onSetVice: (id: string) => void;
  onSetKeeper: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState<"name" | "role">("name");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let rows = rosterView.filter((p) => {
      if (query && !p.name.toLowerCase().includes(query)) return false;
      if (role !== "all" && p.role !== role) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (a.role ?? "z").localeCompare(b.role ?? "z");
    });
    return rows;
  }, [rosterView, q, role, sort]);

  if (rosterView.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No players in this squad yet"
        description="Pick players from your academy roster. You can always change them later."
        actionLabel="Add players"
        onAction={onAdd}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search squad…"
          className="max-w-xs h-9"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All roles</option>
          <option value="batter">Batter</option>
          <option value="bowler">Bowler</option>
          <option value="all_rounder">All-rounder</option>
          <option value="wicket_keeper">Wicket keeper</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "role")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="name">Sort: Name</option>
          <option value="role">Sort: Role</option>
        </select>
        <Button onClick={onAdd} className="ml-auto">
          <PlusCircle className="size-4 mr-1.5" /> Add players
        </Button>
      </div>

      <PlayerGrid
        players={filtered}
        captainId={team.captain_student_id}
        viceCaptainId={team.vice_captain_student_id}
        keeperId={team.keeper_student_id}
        onAction={(action, id) => {
          if (action === "remove") onRemove(id);
          else if (action === "captain") onSetCaptain(id);
          else if (action === "vice") onSetVice(id);
          else if (action === "keeper") onSetKeeper(id);
        }}
      />
    </div>
  );
}

/* ---------------- Settings tab ---------------- */

function SettingsTab({
  team,
  onSaved,
  onDeleted,
}: {
  team: NonNullable<Awaited<ReturnType<typeof getTeam>>>;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: team.name,
    short_name: team.short_name ?? "",
    age_group: team.age_group ?? "U16",
    age_group_custom: team.age_group_custom ?? "",
    coach_name: team.coach_name ?? "",
    assistant_coach_name: team.assistant_coach_name ?? "",
    team_color: team.team_color ?? "#E8873C",
    season: team.season ?? "",
    description: team.description ?? "",
    status: (team.status ?? "active") as (typeof TEAM_STATUSES)[number],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        name: form.name.trim(),
        short_name: form.short_name || null,
        age_group: form.age_group || null,
        age_group_custom: form.age_group === "Custom" ? form.age_group_custom || null : null,
        coach_name: form.coach_name || null,
        assistant_coach_name: form.assistant_coach_name || null,
        team_color: form.team_color || null,
        season: form.season || null,
        description: form.description || null,
        status: form.status,
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteTeam(team.id),
    onSuccess: () => {
      toast.success("Team deleted");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Team details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SField label="Team name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
            </SField>
            <SField label="Short name">
              <Input value={form.short_name} onChange={(e) => set("short_name", e.target.value)} maxLength={12} />
            </SField>
            <SField label="Age group">
              <select
                value={form.age_group}
                onChange={(e) => set("age_group", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {AGE_GROUPS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </SField>
            {form.age_group === "Custom" && (
              <SField label="Custom age group">
                <Input value={form.age_group_custom} onChange={(e) => set("age_group_custom", e.target.value)} maxLength={40} />
              </SField>
            )}
            <SField label="Season">
              <Input value={form.season} onChange={(e) => set("season", e.target.value)} maxLength={40} />
            </SField>
            <SField label="Status">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as (typeof TEAM_STATUSES)[number])}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TEAM_STATUSES.map((s) => (
                  <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </SField>
            <SField label="Coach">
              <Input value={form.coach_name} onChange={(e) => set("coach_name", e.target.value)} maxLength={80} />
            </SField>
            <SField label="Assistant coach">
              <Input value={form.assistant_coach_name} onChange={(e) => set("assistant_coach_name", e.target.value)} maxLength={80} />
            </SField>
            <SField label="Team color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.team_color}
                  onChange={(e) => set("team_color", e.target.value)}
                  className="h-10 w-14 rounded-md border border-border cursor-pointer"
                />
                <Input value={form.team_color} onChange={(e) => set("team_color", e.target.value)} className="flex-1" maxLength={20} />
              </div>
            </SField>
            <SField label="Description" wide>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={600} />
            </SField>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4 mr-1.5" />
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-destructive/40 bg-card p-5">
          <h3 className="text-sm font-semibold text-destructive mb-1">Danger zone</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Deleting a team removes its squad entries. This does not affect academy students.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`Delete "${team.name}"? This cannot be undone.`)) del.mutate();
            }}
            disabled={del.isPending}
          >
            <Trash2 className="size-4 mr-1.5" />
            {del.isPending ? "Deleting…" : "Delete team"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/* ---------------- Add players dialog body ---------------- */

function AddPlayersDialogBody({
  students,
  excludeIds,
  loading,
  onSubmit,
  submitting,
}: {
  students: Awaited<ReturnType<typeof listStudents>>;
  excludeIds: string[];
  loading: boolean;
  onSubmit: (ids: string[]) => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading roster…</div>
      ) : (
        <PlayerSelector
          students={students}
          selectedIds={selected}
          onChange={setSelected}
          excludeIds={excludeIds}
          maxHeight={360}
        />
      )}
      <DialogFooter className="mt-4">
        <Button
          onClick={() => onSubmit(selected)}
          disabled={submitting || selected.length === 0}
        >
          {submitting
            ? "Adding…"
            : selected.length
              ? `Add ${selected.length} player${selected.length > 1 ? "s" : ""}`
              : "Select players"}
        </Button>
      </DialogFooter>
    </>
  );
}

function DemoTeamWrapper({ tenantId, teamId }: { tenantId: string; teamId: string }) {
  const demo = useDemoData(tenantId);
  if (!demo) return null;
  const team = demo.teams.find((t) => t.id === teamId);
  if (!team) return null;
  return <DemoTeamProfile demo={demo} team={team} />;
}
