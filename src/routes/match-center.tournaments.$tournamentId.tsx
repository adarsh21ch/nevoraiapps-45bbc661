import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Award,
  Loader2,
  PlusCircle,
  Trash2,
  Zap,
  Medal,
  Share2,
  ExternalLink,
  Download,
  Radio,
  Play,
} from "lucide-react";
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
  GroupsTab,
  VenuesTab,
  OfficialsTab,
} from "@/components/match-center/tournament-setup";
import { FixtureGeneratorDialog } from "@/components/match-center/fixture-generator";
import {
  TournamentWorkspaceShell,
  TournamentHeader,
  QuickActionButton,
  getWorkspaceSections,
} from "@/components/match-center/tournament-workspace-shell";
import { TournamentDashboard } from "@/components/match-center/tournament-dashboard";
import { PointsTable } from "@/components/match-center/points-table";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/match-center/tournaments/$tournamentId")({
  head: () => ({
    meta: [
      { title: "Tournament · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { tournamentId } = Route.useParams();
  const { tenant } = useDashboard();
  const [section, setSection] = useState<string>("overview");
  const [genOpen, setGenOpen] = useState(false);
  const demoEntity = useDemoEntity(tenant.id, tournamentId);
  const demoData = useDemoData(tenant.id);

  const tQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-tournament", tournamentId],
    queryFn: () => getTournament(tournamentId),
  });
  const teamsQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const fxQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
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
  const matchTotal = fxQ.data?.length ?? 0;
  const matchCompleted = fxQ.data?.filter((m) => m.match_locked).length ?? 0;
  const teamCount = teamsQ.data?.length ?? 0;
  const publicUrl =
    t.published && t.slug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/academy/${tenant.slug ?? tenant.id}/tournaments/${t.slug}`
      : null;

  const currentStage = deriveCurrentStage(fxQ.data ?? []);


  const onShare = () => {
    const url = publicUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  };

  const quickActions = (
    <>
      <QuickActionButton icon={Zap} label="Generate fixtures" onClick={() => setGenOpen(true)} />
      <QuickActionButton icon={Play} label="Manage teams" onClick={() => setSection("teams")} />
      <QuickActionButton icon={Share2} label="Share tournament" onClick={onShare} />
      {publicUrl ? (
        <QuickActionButton icon={ExternalLink} label="Open public site" href={publicUrl} />
      ) : null}
      <QuickActionButton icon={Download} label="Export" onClick={() => toast.info("Export coming soon")} />
    </>
  );

  const header = (
    <TournamentHeader
      tournament={t}
      teamCount={teamCount}
      matchTotal={matchTotal}
      matchCompleted={matchCompleted}
      currentStage={currentStage}
      onShare={onShare}
      publicUrl={publicUrl}
    />
  );

  return (
    <>
      <TournamentWorkspaceShell
        header={header}
        activeSection={section}
        onSectionChange={setSection}
        sections={getWorkspaceSections()}
        quickActions={quickActions}
      >
        {section === "overview" && (
          <TournamentDashboard
            tournament={t}
            onNavigate={setSection}
            onQuickAction={(id) => {
              if (id === "generate") setGenOpen(true);
              else if (id === "create") setSection("fixtures");
              else if (id === "share") onShare();
              else if (id === "export") toast.info("Export coming soon");
            }}
            publicUrl={publicUrl}
          />
        )}
        {section === "fixtures" && <FixturesTab tournament={t} tenantId={tenant.id} />}
        {section === "live" && <LiveMatchesTab tournamentId={tournamentId} />}
        {section === "standings" && <PointsTable tournamentId={tournamentId} />}
        {section === "bracket" && <BracketView tournamentId={tournamentId} />}
        {section === "teams" && <TeamsTab tournamentId={tournamentId} tenantId={tenant.id} />}
        {section === "players" && <PlayersTab tournamentId={tournamentId} />}
        {section === "stats" && <RecordsTab tournamentId={tournamentId} />}
        {section === "records" && <RecordsTab tournamentId={tournamentId} />}
        {section === "awards" && <AwardsTab tournamentId={tournamentId} />}
        {section === "groups" && <GroupsTab tournamentId={tournamentId} tenantId={tenant.id} />}
        {section === "venues" && <VenuesTab tournamentId={tournamentId} tenantId={tenant.id} />}
        {section === "officials" && <OfficialsTab tournamentId={tournamentId} tenantId={tenant.id} />}
        {section === "settings" && <SettingsTab tournament={t} />}
      </TournamentWorkspaceShell>

      <FixtureGeneratorDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        tournament={t}
        tenantId={tenant.id}
        createdBy={null}
      />
    </>
  );
}

function deriveCurrentStage(fixtures: Awaited<ReturnType<typeof listFixtures>>): string | null {
  const live = fixtures.find((m) => m.status === "in_progress");
  if (live?.matchday_no) return `Matchday ${live.matchday_no}`;
  const nextUp = fixtures.find((m) => !m.match_locked);
  if (nextUp?.matchday_no) return `Matchday ${nextUp.matchday_no}`;
  return null;
}

/* ==================== LIVE MATCHES ==================== */
function LiveMatchesTab({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });
  if (q.isLoading) return <LoadingSkeleton />;
  const live = (q.data ?? []).filter((m) => m.status === "in_progress");
  if (live.length === 0)
    return (
      <EmptyState
        icon={Radio}
        title="No live matches"
        description="Matches show here once they go live."
      />
    );
  return (
    <div className="space-y-2">
      {live.map((m) => (
        <Link
          key={m.id}
          to="/scorer/$matchId"
          params={{ matchId: m.id }}
          className="flex items-center justify-between rounded-xl border border-border bg-card p-3 hover:border-foreground/30"
        >
          <div>
            <div className="text-sm font-medium">
              {m.team_a?.name} vs {m.team_b?.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {m.scheduled_date ?? "TBD"} {m.scheduled_time ?? ""}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Live
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ==================== PLAYERS (placeholder linking to awards) ==================== */
function PlayersTab({ tournamentId }: { tournamentId: string }) {
  const orangeQ = useQuery({
    queryKey: ["mc-tournament-orange", tournamentId],
    queryFn: () => computeOrangeCap(tournamentId),
  });
  const purpleQ = useQuery({
    queryKey: ["mc-tournament-purple", tournamentId],
    queryFn: () => computePurpleCap(tournamentId),
  });
  if (orangeQ.isLoading || purpleQ.isLoading) return <LoadingSkeleton />;
  const bat = (orangeQ.data ?? []).slice(0, 10);
  const bowl = (purpleQ.data ?? []).slice(0, 10);
  if (bat.length === 0 && bowl.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="No player data yet"
        description="Player leaderboards populate as matches finalize."
      />
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Top batters
        </div>
        <ul className="divide-y divide-border">
          {bat.map((r, i) => (
            <li key={r.athleteId ?? r.name ?? i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {i + 1}. {r.name ?? "—"}
              </span>
              <span className="font-semibold">{r.runs} runs</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Top bowlers
        </div>
        <ul className="divide-y divide-border">
          {bowl.map((r, i) => (
            <li key={r.athleteId ?? r.name ?? i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {i + 1}. {r.name ?? "—"}
              </span>
              <span className="font-semibold">{r.wickets} wkts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ==================== AWARDS ==================== */
function AwardsTab({ tournamentId }: { tournamentId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Award className="size-4 text-orange-500" /> Orange Cap · Most Runs
        </h3>
        <OrangeCapTab tournamentId={tournamentId} />
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Medal className="size-4 text-purple-500" /> Purple Cap · Most Wickets
        </h3>
        <PurpleCapTab tournamentId={tournamentId} />
      </div>
    </div>
  );
}


/* OverviewTab replaced by TournamentDashboard */

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
  tournament,
  tenantId,
}: {
  tournament: import("@/lib/mc-tournaments").MCTournament;
  tenantId: string;
}) {
  const tournamentId = tournament.id;
  const { session } = useDashboard();
  const [genOpen, setGenOpen] = useState(false);
  const [view, setView] = useState<"list" | "matchday" | "bracket">("matchday");
  const fxQ = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });

  const fixtures = fxQ.data ?? [];
  const byMatchday = useMemo(() => {
    const buckets = new Map<string, typeof fixtures>();
    for (const m of fixtures) {
      const key = m.matchday_no ? `Matchday ${m.matchday_no}` : "Unscheduled";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(m);
    }
    return Array.from(buckets.entries());
  }, [fixtures]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
          {(["matchday", "list", "bracket"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium capitalize",
                view === v ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setGenOpen(true)}>
          <Zap className="size-4 mr-1.5" /> Generate fixtures
        </Button>
      </div>

      <FixtureGeneratorDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        tournament={tournament}
        tenantId={tenantId}
        createdBy={session?.user?.id ?? null}
      />

      {fxQ.isLoading ? (
        <LoadingSkeleton />
      ) : fixtures.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No fixtures yet"
          description="Complete tournament setup then generate fixtures."
        />
      ) : view === "matchday" ? (
        <div className="space-y-4">
          {byMatchday.map(([label, list]) => (
            <div key={label}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="space-y-2">
                {list.map((m) => (
                  <FixtureRow key={m.id} m={m} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : view === "bracket" ? (
        <BracketView tournamentId={tournamentId} />
      ) : (
        <div className="space-y-2">
          {fixtures.map((m) => (
            <FixtureRow key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function FixtureRow({ m }: { m: Awaited<ReturnType<typeof listFixtures>>[number] }) {
  return (
    <Link
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
  );
}

function BracketView({ tournamentId }: { tournamentId: string }) {
  const q = useQuery({
    queryKey: ["mc-tournament-rounds", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_tournament_rounds")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("stage_order", { ascending: true })
        .order("slot_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rounds = q.data ?? [];
  if (rounds.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No bracket"
        description="Generate a knockout tournament to see the bracket."
      />
    );
  }
  const byStage = new Map<string, typeof rounds>();
  for (const r of rounds) {
    if (!byStage.has(r.stage)) byStage.set(r.stage, []);
    byStage.get(r.stage)!.push(r);
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from(byStage.entries()).map(([stage, list]) => (
        <div key={stage} className="min-w-[220px] space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {stage.replace("_", " ")}
          </div>
          {list.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <div className="font-medium">{r.name ?? "TBD"}</div>
              <div className="text-muted-foreground">
                {r.team_a_id ? "Team A" : "TBD"} vs {r.team_b_id ? "Team B" : "TBD"}
              </div>
            </div>
          ))}
        </div>
      ))}
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
