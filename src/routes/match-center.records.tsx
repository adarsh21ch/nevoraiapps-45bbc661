import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Medal,
  Trophy,
  Star,
  Search,
  RefreshCw,
  Award,
  Users,
  Target,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { SectionTitle, StatCard, EmptyState } from "@/components/match-center/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/lib/dashboard-context";
import {
  computeAcademyOverview,
  listAcademyRecords,
  rebuildAcademyRecords,
  listHallOfFame,
  addHallOfFameEntry,
  deleteHallOfFameEntry,
  leaderboardMostRuns,
  leaderboardMostWickets,
  leaderboardHighestAverage,
  leaderboardHighestStrikeRate,
  leaderboardBestEconomy,
  leaderboardCareer,
  leaderboardBestCaptain,
  computeCaptainRecords,
  globalSearch,
  DEFAULT_RECORD_CONFIG,
  type LeaderboardRow,
  type MCAcademyRecord,
  type MCHallOfFame,
  type SearchHit,
} from "@/lib/mc-academy-records";
import { supabase } from "@/integrations/supabase/client";
import { listAthletes } from "@/lib/mc-athletes";

export const Route = createFileRoute("/match-center/records")({
  head: () => ({
    meta: [
      { title: "Academy Records · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecordsPage,
});

const HOF_CATEGORIES = [
  "batting",
  "bowling",
  "fielding",
  "captaincy",
  "lifetime_achievement",
  "coach_recognition",
] as const;

function RecordsPage() {
  const { tenant } = useDashboard();
  const tenantId = tenant.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const overviewQ = useQuery({
    queryKey: ["mc-academy-overview", tenantId],
    queryFn: () => computeAcademyOverview(tenantId),
  });

  const recordsQ = useQuery({
    queryKey: ["mc-academy-records", tenantId],
    queryFn: () => listAcademyRecords(tenantId),
  });

  const careersQ = useQuery({
    queryKey: ["mc-careers-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_player_careers")
        .select("*, mc_athlete_profiles(id, student_id, students(name))")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return (data ?? []) as unknown as Array<Record<string, unknown>>;
    },
  });

  const hofQ = useQuery({
    queryKey: ["mc-hof", tenantId],
    queryFn: () => listHallOfFame(tenantId),
  });

  const searchQ = useQuery({
    queryKey: ["mc-records-search", tenantId, searchTerm],
    queryFn: () => globalSearch(tenantId, searchTerm),
    enabled: searchTerm.trim().length >= 2,
  });

  const rebuildMut = useMutation({
    mutationFn: () => rebuildAcademyRecords(tenantId, DEFAULT_RECORD_CONFIG),
    onSuccess: (r) => {
      toast.success(
        `Rebuilt ${r.recordsWritten} records from ${r.matchesAnalyzed} matches in ${r.durationMs}ms`,
      );
      queryClient.invalidateQueries({ queryKey: ["mc-academy-overview", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["mc-academy-records", tenantId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Rebuild failed"),
  });

  const careers = careersQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Academy Records"
        description="Automatically aggregated from every finalized match."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Records" },
        ]}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => rebuildMut.mutate()}
            disabled={rebuildMut.isPending}
          >
            <RefreshCw className={`size-4 mr-1.5 ${rebuildMut.isPending ? "animate-spin" : ""}`} />
            Rebuild
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search players, records, hall of fame…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      {searchTerm.trim().length >= 2 && (
        <SearchResults hits={searchQ.data ?? []} loading={searchQ.isLoading} />
      )}

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hall-of-fame">Hall of Fame</TabsTrigger>
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="bowling">Bowling</TabsTrigger>
          <TabsTrigger value="fielding">Fielding</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="captain">Captain</TabsTrigger>
          <TabsTrigger value="awards">Awards</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            overview={overviewQ.data}
            loading={overviewQ.isLoading}
            records={recordsQ.data ?? []}
          />
        </TabsContent>
        <TabsContent value="hall-of-fame" className="mt-4">
          <HallOfFameTab tenantId={tenantId} entries={hofQ.data ?? []} loading={hofQ.isLoading} />
        </TabsContent>
        <TabsContent value="batting" className="mt-4">
          <BattingRecordsTab careers={careers} records={recordsQ.data ?? []} />
        </TabsContent>
        <TabsContent value="bowling" className="mt-4">
          <BowlingRecordsTab careers={careers} records={recordsQ.data ?? []} />
        </TabsContent>
        <TabsContent value="fielding" className="mt-4">
          <FieldingRecordsTab careers={careers} />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <TeamRecordsTab records={recordsQ.data ?? []} />
        </TabsContent>
        <TabsContent value="captain" className="mt-4">
          <CaptainRecordsTab careers={careers} />
        </TabsContent>
        <TabsContent value="awards" className="mt-4">
          <AwardsTab careers={careers} />
        </TabsContent>
        <TabsContent value="milestones" className="mt-4">
          <MilestonesTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab records={recordsQ.data ?? []} tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Overview ---------- */

function OverviewTab({
  overview,
  loading,
  records,
}: {
  overview: Awaited<ReturnType<typeof computeAcademyOverview>> | undefined;
  loading: boolean;
  records: MCAcademyRecord[];
}) {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (!overview) return <EmptyState icon={Medal} title="No data" description="No finalized matches yet." />;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Finalized matches" value={overview.totalFinalizedMatches} icon={Trophy} />
        <StatCard label="Total runs" value={overview.totalRuns} icon={TrendingUp} />
        <StatCard label="Total wickets" value={overview.totalWickets} icon={Target} />
        <StatCard label="Sixes" value={overview.totalSixes} icon={Star} />
      </div>

      <SectionTitle title="Academy leaders" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <HighlightCard title="Top Run Scorer" row={overview.topRunScorer} suffix=" runs" />
        <HighlightCard title="Top Wicket Taker" row={overview.topWicketTaker} suffix=" wkts" />
        <HighlightCard title="Top Batter (avg)" row={overview.topBatter} suffix=" avg" />
        <HighlightCard title="Most Matches" row={overview.mostMatches} suffix=" matches" />
        <HighlightCard title="Most POM Awards" row={overview.mostPlayerOfMatch} suffix=" awards" />
        <HighlightCard title="Current Captain" row={overview.currentCaptain} />
      </div>

      <SectionTitle title="Latest record" />
      {overview.latestRecord ? (
        <RecordCard record={overview.latestRecord} />
      ) : (
        <p className="text-sm text-muted-foreground">No records yet.</p>
      )}

      <SectionTitle title="Recent records" />
      <div className="grid gap-2 md:grid-cols-2">
        {records.slice(0, 8).map((r) => (
          <RecordCard key={r.id} record={r} />
        ))}
      </div>
    </div>
  );
}

function HighlightCard({
  title,
  row,
  suffix,
}: {
  title: string;
  row: LeaderboardRow | null;
  suffix?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      {row ? (
        <>
          <div className="text-lg font-semibold mt-1">{row.athleteName}</div>
          <div className="text-2xl font-bold tabular-nums">
            {row.value}
            {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground mt-1">—</div>
      )}
    </Card>
  );
}

function RecordCard({ record }: { record: MCAcademyRecord }) {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;
  const name = (meta.name as string) ?? (meta.teamName as string) ?? "";
  return (
    <Card className="p-3 flex items-center gap-3">
      <Medal className="size-5 text-amber-500 flex-none" />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {record.record_type.replace(/_/g, " ")}
        </div>
        <div className="text-sm font-medium truncate">
          {name} <span className="tabular-nums text-muted-foreground">— {record.value}</span>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Batting / Bowling / Fielding leaderboards ---------- */

function LeaderboardTable({
  rows,
  valueLabel,
  loading,
}: {
  rows: LeaderboardRow[];
  valueLabel: string;
  loading?: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (rows.length === 0) {
    return <EmptyState icon={Medal} title="No entries" description="Finalize matches to populate." />;
  }
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-2 w-10">#</th>
            <th className="text-left p-2">Player</th>
            <th className="text-right p-2">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.athleteProfileId ?? "") + i} className="border-t">
              <td className="p-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="p-2 font-medium">{r.athleteName}</td>
              <td className="p-2 text-right tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function BattingRecordsTab({
  careers,
  records,
}: {
  careers: Array<Record<string, unknown>>;
  records: MCAcademyRecord[];
}) {
  const typed = careers as unknown as Array<Record<string, unknown> & { runs: number; wickets: number; athlete_profile_id: string }>;
  const highIS = records.find((r) => r.record_type === "highest_individual_score");
  return (
    <div className="space-y-6">
      {highIS ? (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Highest Individual Score
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {(highIS.metadata as Record<string, unknown>).name as string} — {highIS.value}
          </div>
        </Card>
      ) : null}
      <div>
        <SectionTitle title="Most runs" />
        <LeaderboardTable rows={leaderboardMostRuns(typed)} valueLabel="Runs" />
      </div>
      <div>
        <SectionTitle title="Highest average (min 60 balls)" />
        <LeaderboardTable rows={leaderboardHighestAverage(typed, 60)} valueLabel="Avg" />
      </div>
      <div>
        <SectionTitle title="Highest strike rate" />
        <LeaderboardTable rows={leaderboardHighestStrikeRate(typed, 60)} valueLabel="SR" />
      </div>
      <div>
        <SectionTitle title="Most fours (career)" />
        <LeaderboardTable rows={leaderboardCareer(typed, "fours")} valueLabel="Fours" />
      </div>
      <div>
        <SectionTitle title="Most sixes (career)" />
        <LeaderboardTable rows={leaderboardCareer(typed, "sixes")} valueLabel="Sixes" />
      </div>
    </div>
  );
}

function BowlingRecordsTab({
  careers,
  records,
}: {
  careers: Array<Record<string, unknown>>;
  records: MCAcademyRecord[];
}) {
  const typed = careers as unknown as Array<Record<string, unknown> & { runs: number; wickets: number; athlete_profile_id: string }>;
  const bestBowl = records.find((r) => r.record_type === "best_bowling");
  return (
    <div className="space-y-6">
      {bestBowl ? (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Best Bowling
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {(bestBowl.metadata as Record<string, unknown>).name as string} —{" "}
            {((bestBowl.metadata as Record<string, unknown>).figures as string) ?? bestBowl.value}
          </div>
        </Card>
      ) : null}
      <div>
        <SectionTitle title="Most wickets" />
        <LeaderboardTable rows={leaderboardMostWickets(typed)} valueLabel="Wkts" />
      </div>
      <div>
        <SectionTitle title="Best economy (min 20 overs)" />
        <LeaderboardTable rows={leaderboardBestEconomy(typed, 120)} valueLabel="Econ" />
      </div>
      <div>
        <SectionTitle title="Five-wicket hauls" />
        <LeaderboardTable rows={leaderboardCareer(typed, "five_wicket_hauls")} valueLabel="5W" />
      </div>
    </div>
  );
}

function FieldingRecordsTab({ careers }: { careers: Array<Record<string, unknown>> }) {
  const typed = careers as unknown as Array<Record<string, unknown> & { runs: number; wickets: number; athlete_profile_id: string }>;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title="Most catches" />
        <LeaderboardTable rows={leaderboardCareer(typed, "catches")} valueLabel="Catches" />
      </div>
      <div>
        <SectionTitle title="Most stumpings" />
        <LeaderboardTable rows={leaderboardCareer(typed, "stumpings")} valueLabel="St" />
      </div>
      <div>
        <SectionTitle title="Most run-outs" />
        <LeaderboardTable rows={leaderboardCareer(typed, "run_outs")} valueLabel="RO" />
      </div>
    </div>
  );
}

function TeamRecordsTab({ records }: { records: MCAcademyRecord[] }) {
  const teamRecords = records.filter((r) =>
    [
      "highest_team_score",
      "lowest_team_score",
      "longest_winning_streak",
      "most_tournament_wins",
    ].includes(r.record_type),
  );
  if (teamRecords.length === 0) {
    return <EmptyState icon={Users} title="No team records" description="Finalize matches to populate." />;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {teamRecords.map((r) => (
        <RecordCard key={r.id} record={r} />
      ))}
    </div>
  );
}

function CaptainRecordsTab({ careers }: { careers: Array<Record<string, unknown>> }) {
  const rows = useMemo(() => computeCaptainRecords(careers), [careers]);
  if (rows.length === 0) {
    return <EmptyState icon={Trophy} title="No captain records" description="No captained matches yet." />;
  }
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-2">Captain</th>
            <th className="text-right p-2">M</th>
            <th className="text-right p-2">W</th>
            <th className="text-right p-2">L</th>
            <th className="text-right p-2">Win %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.athleteProfileId} className="border-t">
              <td className="p-2 font-medium">{r.name}</td>
              <td className="p-2 text-right tabular-nums">{r.matches}</td>
              <td className="p-2 text-right tabular-nums">{r.wins}</td>
              <td className="p-2 text-right tabular-nums">{r.losses}</td>
              <td className="p-2 text-right tabular-nums">{r.winPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AwardsTab({ careers }: { careers: Array<Record<string, unknown>> }) {
  const typed = careers as unknown as Array<Record<string, unknown> & { runs: number; wickets: number; athlete_profile_id: string }>;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title="Most Player of the Match awards" />
        <LeaderboardTable
          rows={leaderboardCareer(typed, "player_of_match")}
          valueLabel="Awards"
        />
      </div>
      <div>
        <SectionTitle title="Best captain (win %)" />
        <LeaderboardTable rows={leaderboardBestCaptain(typed, 3)} valueLabel="Win %" />
      </div>
    </div>
  );
}

/* ---------- Milestones ---------- */

function MilestonesTab({ tenantId }: { tenantId: string }) {
  const q = useQuery({
    queryKey: ["mc-athlete-timeline-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_athlete_timeline")
        .select("*, mc_athlete_profiles(id, students(name))")
        .eq("tenant_id", tenantId)
        .order("event_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <EmptyState icon={Star} title="No milestones yet" description="Milestones are appended after every finalized match." />;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const rec = r as unknown as {
          id: string;
          title: string;
          description: string | null;
          event_date: string;
          mc_athlete_profiles?: { students?: { name?: string } | null } | null;
        };
        return (
          <Card key={rec.id} className="p-3 flex items-start gap-3">
            <Star className="size-4 text-amber-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {rec.mc_athlete_profiles?.students?.name} · {rec.title}
              </div>
              {rec.description ? (
                <div className="text-xs text-muted-foreground">{rec.description}</div>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">{rec.event_date}</div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Timeline ---------- */

function TimelineTab({
  records,
  tenantId,
}: {
  records: MCAcademyRecord[];
  tenantId: string;
}) {
  const auditQ = useQuery({
    queryKey: ["mc-audit-log", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_match_audit_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const events: Array<{ at: string; title: string; sub?: string }> = [];
  for (const r of records) {
    events.push({
      at: r.updated_at,
      title: `New record — ${r.record_type.replace(/_/g, " ")}`,
      sub: `${((r.metadata as Record<string, unknown>)?.name as string) ?? ""} — ${r.value}`,
    });
  }
  for (const a of auditQ.data ?? []) {
    events.push({
      at: a.created_at,
      title: a.action.replace(/_/g, " "),
      sub: a.reason ?? undefined,
    });
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (events.length === 0) {
    return <EmptyState icon={Trophy} title="Nothing yet" description="Timeline builds as records and matches are finalized." />;
  }
  return (
    <div className="space-y-2">
      {events.slice(0, 100).map((e, i) => (
        <Card key={i} className="p-3 flex items-start gap-3">
          <Trophy className="size-4 text-amber-500 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{e.title}</div>
            {e.sub ? <div className="text-xs text-muted-foreground">{e.sub}</div> : null}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {new Date(e.at).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Hall of Fame ---------- */

function HallOfFameTab({
  tenantId,
  entries,
  loading,
}: {
  tenantId: string;
  entries: Array<MCHallOfFame & { athleteName?: string }>;
  loading: boolean;
}) {
  const [category, setCategory] = useState<string>("all");
  const filtered = category === "all" ? entries : entries.filter((e) => e.category === category);
  const queryClient = useQueryClient();

  const delMut = useMutation({
    mutationFn: (id: string) => deleteHallOfFameEntry(id),
    onSuccess: () => {
      toast.success("Entry removed");
      queryClient.invalidateQueries({ queryKey: ["mc-hof", tenantId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {HOF_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <HallOfFameAddDialog tenantId={tenantId} onAdded={() => queryClient.invalidateQueries({ queryKey: ["mc-hof", tenantId] })} />
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Hall of Fame is empty"
          description="Add your first inductee to celebrate a career-defining moment."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <Card key={e.id} className="p-4 relative">
              <div className="absolute top-2 right-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => delMut.mutate(e.id)}
                  aria-label="Remove"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
              {e.image_url ? (
                <img
                  src={e.image_url}
                  alt={e.athleteName ?? e.achievement_title}
                  className="size-16 rounded-full object-cover mb-2"
                />
              ) : (
                <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Trophy className="size-6 text-amber-500" />
                </div>
              )}
              <div className="text-sm font-semibold">{e.athleteName ?? "—"}</div>
              <div className="text-base font-bold">{e.achievement_title}</div>
              {e.achievement_description ? (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  {e.achievement_description}
                </p>
              ) : null}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{e.category.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {e.awarded_at}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HallOfFameAddDialog({
  tenantId,
  onAdded,
}: {
  tenantId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("batting");
  const [athleteId, setAthleteId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const athletesQ = useQuery({
    queryKey: ["mc-athletes-picker", tenantId],
    queryFn: () => listAthletes(tenantId),
    enabled: open,
  });

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Achievement title required");
      return;
    }
    try {
      await addHallOfFameEntry({
        tenantId,
        category,
        athleteProfileId: athleteId || null,
        achievementTitle: title.trim(),
        achievementDescription: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success("Inducted into Hall of Fame");
      onAdded();
      setOpen(false);
      setTitle("");
      setDescription("");
      setImageUrl("");
      setAthleteId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hall of Fame — new entry</DialogTitle>
          <DialogDescription>Celebrate a lifetime or match-defining moment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOF_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Player</Label>
            <Select value={athleteId} onValueChange={setAthleteId}>
              <SelectTrigger><SelectValue placeholder="Choose a player" /></SelectTrigger>
              <SelectContent>
                {(athletesQ.data ?? []).map((a) => {
                  const name =
                    (a as unknown as { students?: { name?: string } }).students?.name ??
                    a.id;
                  return (
                    <SelectItem key={a.id} value={a.id}>{name}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Achievement title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Image URL (optional)</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Induct</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Search results ---------- */

function SearchResults({ hits, loading }: { hits: SearchHit[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (hits.length === 0) {
    return (
      <Card className="p-3 text-sm text-muted-foreground">No matches.</Card>
    );
  }
  return (
    <Card className="p-2 space-y-1 max-h-72 overflow-auto">
      {hits.map((h, i) => (
        <div key={i} className="flex items-center gap-2 p-2 hover:bg-muted/40 rounded">
          <Badge variant="outline" className="text-[10px] uppercase">{h.kind.replace(/_/g, " ")}</Badge>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{h.title}</div>
            {h.subtitle ? (
              <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>
            ) : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
