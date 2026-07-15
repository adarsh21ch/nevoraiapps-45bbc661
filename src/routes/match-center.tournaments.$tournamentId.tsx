import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Award,
  Settings as SettingsIcon,
  Loader2,
  PlusCircle,
  Trash2,
  Zap,
  ClipboardList,
  Medal,
  MapPin,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard-context";
import {
  getTournament,
  updateTournament,
  deleteTournament,
  listTournamentTeams,
  registerTeams,
  removeTeam,
  listFixtures,
  generateRoundRobin,
  generateKnockout,
  persistFixtures,
} from "@/lib/mc-tournaments";
import {
  rebuildTournamentStandings,
  computeOrangeCap,
  computePurpleCap,
  computeTournamentRecords,
} from "@/lib/mc-tournament-engine";
import { listTeams } from "@/lib/mc-teams";
import { useDemoData, useDemoEntity } from "@/lib/mc-demo/store";
import { DemoTournamentDetail } from "@/components/match-center/demo-tournament-detail";
import {
  SetupProgress,
  GroupsTab,
  VenuesTab,
  OfficialsTab,
} from "@/components/match-center/tournament-setup";


export const Route = createFileRoute("/match-center/tournaments/$tournamentId")({
  head: () => ({
    meta: [
      { title: "Tournament · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TournamentDetailPage,
});

const TABS = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "teams", label: "Teams", icon: Users },
  { id: "groups", label: "Groups", icon: Users },
  { id: "venues", label: "Venues", icon: MapPin },
  { id: "officials", label: "Officials", icon: UserCog },
  { id: "fixtures", label: "Fixtures", icon: Calendar },
  { id: "standings", label: "Points Table", icon: BarChart3 },
  { id: "results", label: "Results", icon: Trophy },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "orange", label: "Orange Cap", icon: Award },
  { id: "purple", label: "Purple Cap", icon: Medal },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];

function TournamentDetailPage() {
  const { tournamentId } = Route.useParams();
  const { tenant } = useDashboard();
  const [tab, setTab] = useState<TabId>("overview");
  const demoEntity = useDemoEntity(tenant.id, tournamentId);
  const demoData = useDemoData(tenant.id);

  const tQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-tournament", tournamentId],
    queryFn: () => getTournament(tournamentId),
  });

  if (demoEntity && demoEntity.kind === "tournament" && demoData) {
    return <DemoTournamentDetail demo={demoData} tournament={demoEntity.tournament} />;
  }

  if (tQ.isLoading) return <LoadingSkeleton />;
  if (!tQ.data)
    return (
      <EmptyState
        icon={Trophy}
        title="Tournament not found"
        description="This tournament may have been deleted."
      />
    );
  const t = tQ.data;

  return (
    <div>
      <PageHeader
        title={t.name}
        description={
          [t.season, t.age_group, t.format, `${t.overs} overs`]
            .filter(Boolean)
            .join(" · ")
        }
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Tournaments", to: "/match-center/tournaments" },
          { label: t.name },
        ]}
        actions={
          <Link to="/match-center/tournaments">
            <Button variant="ghost">
              <ArrowLeft className="size-4 mr-1.5" /> Back
            </Button>
          </Link>
        }
      />

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((x) => {
          const Icon = x.icon;
          const active = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {x.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab tournamentId={tournamentId} tenantId={tenant.id} hasGroups={t.has_groups} />}
      {tab === "teams" && <TeamsTab tournamentId={tournamentId} tenantId={tenant.id} />}
      {tab === "groups" && <GroupsTab tournamentId={tournamentId} tenantId={tenant.id} />}
      {tab === "venues" && <VenuesTab tournamentId={tournamentId} tenantId={tenant.id} />}
      {tab === "officials" && <OfficialsTab tournamentId={tournamentId} tenantId={tenant.id} />}
      {tab === "fixtures" && <FixturesTab tournament={t} tenantId={tenant.id} />}
      {tab === "standings" && <StandingsTab tournamentId={tournamentId} />}
      {tab === "results" && <ResultsTab tournamentId={tournamentId} />}
      {tab === "stats" && <RecordsTab tournamentId={tournamentId} />}
      {tab === "orange" && <OrangeCapTab tournamentId={tournamentId} />}
      {tab === "purple" && <PurpleCapTab tournamentId={tournamentId} />}
      {tab === "settings" && <SettingsTab tournament={t} />}
    </div>
  );
}

/* ==================== OVERVIEW ==================== */
function OverviewTab({ tournamentId, tenantId: _tenantId, hasGroups }: { tournamentId: string; tenantId: string; hasGroups: boolean }) {
  const teamsQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const fixturesQ = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });
  const teamCount = teamsQ.data?.length ?? 0;
  const total = fixturesQ.data?.length ?? 0;
  const completed = fixturesQ.data?.filter((m) => m.match_locked).length ?? 0;

  const card = (label: string, value: string | number) => (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <SetupProgress tournamentId={tournamentId} hasGroups={hasGroups} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {card("Teams", teamCount)}
        {card("Fixtures", total)}
        {card("Completed", completed)}
        {card("Remaining", total - completed)}
      </div>
    </div>
  );
}

/* ==================== TEAMS ==================== */
function TeamsTab({ tournamentId, tenantId }: { tournamentId: string; tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const regQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const allTeamsQ = useQuery({
    queryKey: ["mc-teams", tenantId],
    queryFn: () => listTeams(tenantId),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const registeredIds = new Set((regQ.data ?? []).map((r) => r.team_id));
  const available = (allTeamsQ.data ?? []).filter((t) => !registeredIds.has(t.id));

  const add = useMutation({
    mutationFn: async () => {
      await registerTeams(tenantId, tournamentId, Array.from(selected));
    },
    onSuccess: () => {
      toast.success("Teams registered");
      setSelected(new Set());
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["mc-tournament-teams", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (teamId: string) => removeTeam(tournamentId, teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-tournament-teams", tournamentId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <PlusCircle className="size-4 mr-1.5" /> Register team
        </Button>
      </div>
      {regQ.isLoading ? (
        <LoadingSkeleton />
      ) : (regQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams registered"
          description="Register academy or external teams to build the fixture list."
        />
      ) : (
        <div className="space-y-2">
          {(regQ.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div className="text-sm font-medium">
                {r.team?.name ?? "Team"}
                {r.team?.is_external ? (
                  <span className="ml-2 text-xs text-muted-foreground">External</span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove team from tournament"
                onClick={() => del.mutate(r.team_id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register teams</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {available.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                All teams are registered.
              </div>
            ) : (
              available.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(t.id);
                      else next.delete(t.id);
                      setSelected(next);
                    }}
                  />
                  <span className="text-sm">{t.name}</span>
                  {t.is_external ? (
                    <span className="text-xs text-muted-foreground">· External</span>
                  ) : null}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={selected.size === 0 || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Register {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== FIXTURES ==================== */
function FixturesTab({
  tournamentId,
  tenantId,
  overs,
  format,
}: {
  tournamentId: string;
  tenantId: string;
  overs: number;
  format: string;
}) {
  const qc = useQueryClient();
  const { session } = useDashboard();
  const teamsQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const fxQ = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });

  const generate = useMutation({
    mutationFn: async (kind: "round_robin" | "knockout") => {
      const teamIds = (teamsQ.data ?? []).map((r) => r.team_id);
      if (teamIds.length < 2) throw new Error("Register at least 2 teams first");
      const fixtures =
        kind === "round_robin" ? generateRoundRobin(teamIds) : generateKnockout(teamIds);
      await persistFixtures({
        tenantId,
        tournamentId,
        overs,
        matchFormat: format,
        fixtures,
        createdBy: session?.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Fixtures generated");
      qc.invalidateQueries({ queryKey: ["mc-tournament-fixtures", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate.mutate("round_robin")}
          disabled={generate.isPending}
        >
          <Zap className="size-4 mr-1.5" /> Generate round robin
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generate.mutate("knockout")}
          disabled={generate.isPending}
        >
          <Zap className="size-4 mr-1.5" /> Generate knockout
        </Button>
      </div>

      {fxQ.isLoading ? (
        <LoadingSkeleton />
      ) : (fxQ.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fixtures yet"
          description="Register teams and generate a fixture list, or create matches manually."
        />
      ) : (
        <div className="space-y-2">
          {(fxQ.data ?? []).map((m) => (
            <Link
              key={m.id}
              to="/scorer/$matchId"
              params={{ matchId: m.id }}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/30"
            >
              <div>
                <div className="text-sm font-medium">
                  {m.team_a?.name} vs {m.team_b?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.scheduled_date ?? "TBD"} {m.scheduled_time ?? ""}
                </div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {m.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== STANDINGS ==================== */
function StandingsTab({ tournamentId }: { tournamentId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const rebuild = useMutation({
    mutationFn: () => rebuildTournamentStandings(tournamentId),
    onSuccess: () => {
      toast.success("Standings rebuilt");
      qc.invalidateQueries({ queryKey: ["mc-tournament-teams", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = useMemo(
    () =>
      (q.data ?? []).slice().sort((a, b) => {
        return (
          Number(b.points) - Number(a.points) ||
          Number(b.net_run_rate) - Number(a.net_run_rate) ||
          b.won - a.won
        );
      }),
    [q.data],
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
        >
          {rebuild.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Rebuild standings
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No standings yet"
          description="Standings populate automatically after finalized matches."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-right">P</th>
                <th className="px-3 py-2 text-right">W</th>
                <th className="px-3 py-2 text-right">L</th>
                <th className="px-3 py-2 text-right">T</th>
                <th className="px-3 py-2 text-right">NR</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-right">NRR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.team?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.played}</td>
                  <td className="px-3 py-2 text-right">{r.won}</td>
                  <td className="px-3 py-2 text-right">{r.lost}</td>
                  <td className="px-3 py-2 text-right">{r.tied}</td>
                  <td className="px-3 py-2 text-right">{r.no_result}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.points}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(r.net_run_rate).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==================== RESULTS ==================== */
function ResultsTab({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });
  const finalized = (q.data ?? []).filter((m) => m.match_locked);
  if (q.isLoading) return <LoadingSkeleton />;
  if (finalized.length === 0)
    return (
      <EmptyState
        icon={Trophy}
        title="No results yet"
        description="Results appear after matches are finalized."
      />
    );
  return (
    <div className="space-y-2">
      {finalized.map((m) => (
        <div
          key={m.id}
          className="rounded-xl border border-border bg-card p-3"
        >
          <div className="text-sm font-medium">
            {m.team_a?.name} vs {m.team_b?.name}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{m.result ?? ""}</div>
        </div>
      ))}
    </div>
  );
}

/* ==================== ORANGE / PURPLE CAP ==================== */
function OrangeCapTab({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-orange", tournamentId],
    queryFn: () => computeOrangeCap(tournamentId),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  const list = q.data ?? [];
  if (list.length === 0)
    return <EmptyState icon={Award} title="No runs recorded" description="Finalized matches will populate the Orange Cap." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">M</th>
            <th className="px-3 py-2 text-right">Runs</th>
            <th className="px-3 py-2 text-right">Avg</th>
            <th className="px-3 py-2 text-right">SR</th>
            <th className="px-3 py-2 text-right">4s / 6s</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 20).map((r, i) => (
            <tr key={r.athleteId ?? r.name ?? i} className="border-t border-border">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name ?? "—"}</td>
              <td className="px-3 py-2 text-right">{r.matches}</td>
              <td className="px-3 py-2 text-right font-semibold">{r.runs}</td>
              <td className="px-3 py-2 text-right">{r.average.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{r.strikeRate.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">
                {r.fours} / {r.sixes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurpleCapTab({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-purple", tournamentId],
    queryFn: () => computePurpleCap(tournamentId),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  const list = q.data ?? [];
  if (list.length === 0)
    return <EmptyState icon={Medal} title="No wickets recorded" description="Finalized matches will populate the Purple Cap." />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">M</th>
            <th className="px-3 py-2 text-right">Wkts</th>
            <th className="px-3 py-2 text-right">Econ</th>
            <th className="px-3 py-2 text-right">Avg</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 20).map((r, i) => (
            <tr key={r.athleteId ?? r.name ?? i} className="border-t border-border">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name ?? "—"}</td>
              <td className="px-3 py-2 text-right">{r.matches}</td>
              <td className="px-3 py-2 text-right font-semibold">{r.wickets}</td>
              <td className="px-3 py-2 text-right">{r.economy.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{r.average.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==================== RECORDS ==================== */
function RecordsTab({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-records", tournamentId],
    queryFn: () => computeTournamentRecords(tournamentId),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  const r = q.data;
  if (!r)
    return (
      <EmptyState icon={BarChart3} title="No records yet" description="Records appear after finalized matches." />
    );
  const item = (label: string, value: string) => (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {item(
        "Highest Team Score",
        r.highestTeamScore ? `${r.highestTeamScore.runs}/${r.highestTeamScore.wickets}` : "—",
      )}
      {item(
        "Lowest Team Score",
        r.lowestTeamScore ? `${r.lowestTeamScore.runs}/${r.lowestTeamScore.wickets}` : "—",
      )}
      {item(
        "Best Bowling",
        r.bestBowling ? `${r.bestBowling.name ?? "—"} · ${r.bestBowling.wickets}/${r.bestBowling.runs}` : "—",
      )}
      {item(
        "Highest Partnership",
        r.highestPartnership
          ? `${r.highestPartnership.runs} · ${r.highestPartnership.a ?? "—"} & ${r.highestPartnership.b ?? "—"}`
          : "—",
      )}
      {item(
        "Most Sixes",
        r.mostSixes ? `${r.mostSixes.name ?? "—"} · ${r.mostSixes.sixes}` : "—",
      )}
      {item(
        "Most Fours",
        r.mostFours ? `${r.mostFours.name ?? "—"} · ${r.mostFours.fours}` : "—",
      )}
    </div>
  );
}

/* ==================== SETTINGS ==================== */
function SettingsTab({
  tournament,
}: {
  tournament: Awaited<ReturnType<typeof getTournament>>;
}) {
  const qc = useQueryClient();
  const t = tournament!;
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [status, setStatus] = useState(t.status);
  const save = useMutation({
    mutationFn: () =>
      updateTournament(t.id, {
        name: name.trim(),
        description: description.trim() || null,
        status,
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["mc-tournament", t.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const del = useMutation({
    mutationFn: () => deleteTournament(t.id),
    onSuccess: () => {
      toast.success("Deleted");
      window.location.href = "/match-center/tournaments";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="max-w-xl space-y-3">
      <div>
        <Label className="text-xs">Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["upcoming", "ongoing", "completed", "cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-between pt-3">
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this tournament? This cannot be undone.")) del.mutate();
          }}
          disabled={del.isPending}
        >
          Delete tournament
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
