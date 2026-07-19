import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { useMatchLive } from "@/hooks/use-match-live";
import { LiveScorecard, BallChip } from "@/components/match-center/live-scorecard";
import { buildCommentary } from "@/lib/mc-commentary";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";
import { ArrowLeft, Radio, RefreshCw } from "lucide-react";


export const Route = createFileRoute("/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Match" },
      { name: "description", content: "Live scorecard, commentary, and ball-by-ball updates." },
      { property: "og:title", content: "Live Match" },
      {
        property: "og:description",
        content: "Live scorecard, commentary, and ball-by-ball updates.",
      },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Match unavailable</h1>
      <p className="mt-2 text-muted-foreground">
        This match isn&apos;t published, or it may have been removed.
      </p>
      <Link to="/matches" className="mt-6 inline-block text-primary underline">
        Back to matches
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Match not found</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t find this match on the public schedule.
      </p>
      <Link to="/matches" className="mt-6 inline-block text-primary underline">
        Back to matches
      </Link>
    </div>
  ),
  component: () => (
    <TenantGate>
      <PublicMatchDetail />
    </TenantGate>
  ),
});

type PublicMatchDetailRow = {
  id: string;
  tenant_id: string;
  status: string;
  match_format: string | null;
  match_type: string | null;
  overs: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  ground_name: string | null;
  result: string | null;
  winner_team: string | null;
  toss_winner: string | null;
  toss_decision: string | null;
  team_a_id: string;
  team_b_id: string;
  visibility: string;
};

function PublicMatchDetail() {
  const tenant = useTenant();
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();

  const matchQ = useQuery({
    queryKey: ["public_match", matchId],
    queryFn: async (): Promise<PublicMatchDetailRow> => {
      const { data, error } = await supabase
        .from("mc_matches")
        .select(
          "id,tenant_id,status,match_format,match_type,overs,scheduled_date,scheduled_time,ground_name,result,winner_team,toss_winner,toss_decision,team_a_id,team_b_id,visibility",
        )
        .eq("id", matchId)
        .eq("visibility", "public")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Match not found");
      if (data.tenant_id !== tenant.id) throw new Error("Match not found");
      return data as PublicMatchDetailRow;
    },
  });

  const teamsQ = useQuery({
    queryKey: ["public_match_teams_detail", matchId],
    enabled: !!matchQ.data,
    queryFn: async () => {
      const ids = [matchQ.data!.team_a_id, matchQ.data!.team_b_id];
      const { data, error } = await supabase
        .from("mc_teams")
        .select("id,name,logo_url")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, { name: string; logo_url: string | null }> = {};
      (data ?? []).forEach((t) => {
        map[t.id] = { name: t.name, logo_url: (t as { logo_url: string | null }).logo_url };
      });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const inningsQ = useQuery({
    queryKey: ["public_match_innings_detail", matchId],
    queryFn: async (): Promise<MCInnings[]> => {
      const { data, error } = await supabase
        .from("mc_innings")
        .select("*")
        .eq("match_id", matchId)
        .order("innings_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MCInnings[];
    },
    staleTime: 5_000,
  });

  const ballsQ = useQuery({
    queryKey: ["public_match_balls", matchId],
    queryFn: async (): Promise<MCBallEvent[]> => {
      const { data, error } = await supabase
        .from("mc_ball_events")
        .select("*")
        .eq("match_id", matchId)
        .order("sequence_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MCBallEvent[];
    },
    staleTime: 5_000,
  });

  const listener = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["public_match", matchId] });
    queryClient.invalidateQueries({ queryKey: ["public_match_innings_detail", matchId] });
    queryClient.invalidateQueries({ queryKey: ["public_match_balls", matchId] });
  }, [queryClient, matchId]);
  useMatchLive(matchId, listener);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  // Pulse indicator flashes whenever ball data changes.
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(t);
  }, [ballsQ.dataUpdatedAt]);

  const handleRefresh = useCallback(() => {
    listener();
  }, [listener]);

  if (matchQ.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-muted-foreground">
        Loading match…
      </div>
    );
  }
  if (!matchQ.data) return null;

  const match = matchQ.data;
  const teams = teamsQ.data ?? {};
  const homeName = teams[match.team_a_id]?.name ?? "Home";
  const awayName = teams[match.team_b_id]?.name ?? "Away";
  const allInnings = inningsQ.data ?? [];
  const allBalls = ballsQ.data ?? [];

  // Determine which team batted first: first innings' batting team, else derive
  // from toss decision, else default to team A. Ensures Team A / Team B order in
  // the toggle mirrors the batting order (bat-first team appears first).
  const firstInningsRow = allInnings.length > 0 ? allInnings[0] : null;
  let battingFirstTeamId: string = match.team_a_id;
  if (firstInningsRow) {
    battingFirstTeamId = firstInningsRow.batting_team_id;
  } else if (match.toss_winner && match.toss_decision) {
    battingFirstTeamId =
      match.toss_decision === "bat"
        ? match.toss_winner
        : match.toss_winner === match.team_a_id
          ? match.team_b_id
          : match.team_a_id;
  }
  const battingSecondTeamId =
    battingFirstTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;

  // Default team selection: whichever team is currently/last batting; falls back
  // to the team that batted first.
  const latestInnings = allInnings.length > 0 ? allInnings[allInnings.length - 1] : null;
  const activeTeamId =
    selectedTeamId ?? latestInnings?.batting_team_id ?? battingFirstTeamId;

  // Find the innings where the active team batted. If none yet (they haven't batted),
  // fall back to the latest innings so the layout still renders with an empty state.
  const teamInnings =
    allInnings.find((i) => i.batting_team_id === activeTeamId) ?? null;
  const currentInnings = teamInnings ?? latestInnings;
  const activeTeamHasBatted = !!teamInnings;
  const currentBalls =
    currentInnings && activeTeamHasBatted
      ? allBalls.filter((b) => b.innings_id === currentInnings.id)
      : [];
  // Innings where the active team bowled (fielded) — used to show bowling
  // figures for a team that hasn't batted yet.
  const bowlingInnings = allInnings.find((i) => i.batting_team_id !== activeTeamId) ?? null;
  const bowlingBalls = bowlingInnings
    ? allBalls.filter((b) => b.innings_id === bowlingInnings.id)
    : [];
  const isLive = match.status === "live" || match.status === "in_progress";

  const commentary = buildCommentary(currentBalls);

  // Group balls into overs (current innings only) for the timeline strip.
  const overs = new Map<number, MCBallEvent[]>();
  currentBalls.forEach((b) => {
    const list = overs.get(b.over_number) ?? [];
    list.push(b);
    overs.set(b.over_number, list);
  });
  const overRows = Array.from(overs.entries()).sort((a, b) => b[0] - a[0]);


  // Derive live broadcast state from the last delivered ball
  const lastBall = currentBalls.length > 0 ? currentBalls[currentBalls.length - 1] : null;
  const strikerName = lastBall?.striker_name ?? null;
  const nonStrikerName = lastBall?.non_striker_name ?? null;
  const bowlerName = lastBall?.bowler_name ?? null;

  // Look up stats for the current striker/non-striker/bowler using name match
  const findBatter = (name: string | null) =>
    name
      ? (allInnings.length > 0
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (currentInnings as any)
          : null) && null
      : null;
  // Simpler: recompute from stats
  const battingOrdered = currentInnings
    ? // reuse: compute via LiveScorecard's engine indirectly is heavier; do a quick derivation
      currentBalls
    : [];
  void findBatter;
  void battingOrdered;

  // Local mini stats derivation from currentBalls for header (light-weight)
  const battersMap = new Map<string, { runs: number; balls: number; fours: number; sixes: number }>();
  const bowlersMap = new Map<string, { runs: number; balls: number; wickets: number }>();
  for (const b of currentBalls) {
    const et = (b.extra_type as string | null) ?? null;
    const isWide = et === "wide";
    const isNoBall = et === "no_ball";
    if (b.striker_name) {
      const s = battersMap.get(b.striker_name) ?? { runs: 0, balls: 0, fours: 0, sixes: 0 };
      const faced = !isWide;
      if (faced) s.balls += 1;
      const off = b.runs_off_bat ?? 0;
      s.runs += off;
      if (off === 4) s.fours += 1;
      if (off === 6) s.sixes += 1;
      battersMap.set(b.striker_name, s);
    }
    if (b.bowler_name) {
      const bw = bowlersMap.get(b.bowler_name) ?? { runs: 0, balls: 0, wickets: 0 };
      const legal = !isWide && !isNoBall;
      if (legal) bw.balls += 1;
      bw.runs += (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0);
      if (b.dismissal_type && b.dismissal_type !== "run_out") bw.wickets += 1;
      bowlersMap.set(b.bowler_name, bw);
    }
  }
  const oversDisplay = (legalBalls: number) =>
    `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

  // Derive team totals from ball events (source of truth) so the score
  // updates in real time even if the innings row hasn't been aggregated yet.
  let derivedRuns = 0;
  let derivedWickets = 0;
  let derivedLegalBalls = 0;
  for (const b of currentBalls) {
    const et = (b.extra_type as string | null) ?? null;
    const isWide = et === "wide";
    const isNoBall = et === "no_ball";
    derivedRuns += (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0);
    if (!isWide && !isNoBall) derivedLegalBalls += 1;
    if (b.dismissal_type) derivedWickets += 1;
  }
  const teamRuns = Math.max(currentInnings?.runs ?? 0, derivedRuns);
  const teamWickets = Math.max(currentInnings?.wickets ?? 0, derivedWickets);
  const teamBalls = Math.max(currentInnings?.balls ?? 0, derivedLegalBalls);

  const strikerStat = strikerName ? battersMap.get(strikerName) : null;
  const nonStrikerStat = nonStrikerName ? battersMap.get(nonStrikerName) : null;
  const bowlerStat = bowlerName ? bowlersMap.get(bowlerName) : null;


  // Recent balls: show previous + current over, grouped with a separator between overs
  const currentOverNo = lastBall?.over_number ?? null;
  const recentOverGroups: { overNo: number; balls: MCBallEvent[] }[] = [];
  if (currentOverNo != null) {
    for (let ov = Math.max(0, currentOverNo - 1); ov <= currentOverNo; ov++) {
      const balls = overs.get(ov);
      if (balls && balls.length) recentOverGroups.push({ overNo: ov, balls });
    }
  }
  const recentBallsRunSum = recentOverGroups.reduce(
    (sum, g) => sum + g.balls.reduce((n, b) => n + (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0), 0),
    0,
  );




  const isCompleted = match.status === "completed" || !!match.result;
  const showBothTotals = isCompleted && allInnings.length >= 2;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/matches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to matches
        </Link>
        <div className="flex items-center gap-2">
          {currentInnings && allInnings.length > 0 && (
            <TeamToggle
              teams={teams}
              match={match}
              homeName={homeName}
              awayName={awayName}
              battingFirstTeamId={battingFirstTeamId}
              battingSecondTeamId={battingSecondTeamId}
              activeTeamId={activeTeamId}
              allInnings={allInnings}
              onSelect={setSelectedTeamId}
              hideScores
              compact
            />
          )}
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:border-primary/50"
            aria-label="Refresh"
          >
            <RefreshCw className={"size-3.5 " + (pulse ? "animate-spin text-primary" : "")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Match header — compact single-line meta */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {isLive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
            <Radio className={"size-3 " + (pulse ? "animate-pulse" : "")} /> Live
          </span>
        )}
        <span className="font-semibold text-foreground">
          {homeName} <span className="text-muted-foreground">vs</span> {awayName}
        </span>
        {match.match_format && <span>· {match.match_format}</span>}
        {match.match_type && <span>· {match.match_type}</span>}
        {match.scheduled_date && (
          <span>· {new Date(match.scheduled_date).toLocaleDateString()}</span>
        )}
        {match.ground_name && <span>· {match.ground_name}</span>}
        {match.toss_winner && match.toss_decision && (
          <span className="basis-full text-[11px]">
            Toss: {teams[match.toss_winner]?.name ?? "Winner"} chose to {match.toss_decision}
          </span>
        )}
        {match.result && (
          <span className="basis-full text-[11px] font-medium" style={{ color: "var(--brand)" }}>
            {match.result}
          </span>
        )}
      </div>

      {showBothTotals && (
        <section className="mt-6 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Final result
          </div>
          <div className="mt-3 space-y-3">
            {allInnings.map((inn) => {
              const tName =
                teams[inn.batting_team_id]?.name ??
                (inn.batting_team_id === match.team_a_id ? homeName : awayName);
              const legalBalls = inn.balls ?? 0;
              return (
                <button
                  key={inn.id}
                  type="button"
                  onClick={() => setSelectedTeamId(inn.batting_team_id)}
                  className={
                    "flex w-full items-baseline justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition " +
                    (inn.batting_team_id === activeTeamId
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/50 bg-background/40 hover:border-primary/40")
                  }
                >
                  <span className="truncate text-sm font-semibold">{tName}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-2xl font-black">
                      {inn.runs ?? 0}
                      <span className="text-muted-foreground">/</span>
                      {inn.wickets ?? 0}
                    </span>
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({oversDisplay(legalBalls)}
                      {match.overs ? ` / ${match.overs}` : ""})
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {match.result && (
            <div className="mt-3 text-xs font-semibold" style={{ color: "var(--brand)" }}>
              {match.result}
            </div>
          )}
        </section>
      )}



      {currentInnings && !activeTeamHasBatted && !showBothTotals ? (
        <YetToBatPanel
          teamName={teams[activeTeamId]?.name ?? "This team"}
          bowlingBalls={bowlingBalls}
          oversDisplay={oversDisplay}
        />
      ) : null}

      {currentInnings && activeTeamHasBatted && !showBothTotals ? (

        <>
          {/* Broadcast card: single stacked column — score → batters → bowling → this over */}
          <section className="mt-6 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-sm space-y-5">
            {/* Score row */}
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {currentInnings.batting_team_id === match.team_a_id ? homeName : awayName}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-black leading-none tabular-nums tracking-tight sm:text-6xl">
                    {teamRuns}
                    <span className="text-muted-foreground">/</span>
                    {teamWickets}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    ({oversDisplay(teamBalls)}
                    {match.overs ? ` / ${match.overs}` : ""})
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">CRR</div>
                <div className="text-2xl font-bold tabular-nums">
                  {teamBalls > 0
                    ? ((teamRuns * 6) / teamBalls).toFixed(2)
                    : "0.00"}
                </div>
              </div>

            </div>

            {/* Batters */}
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/50">
              <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem_2.5rem] gap-x-2 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <div>Batter</div>
                <div className="text-right">R</div>
                <div className="text-right">B</div>
                <div className="text-right">4s</div>
                <div className="text-right">6s</div>
              </div>
              {[
                { name: strikerName, stat: strikerStat, striker: true },
                { name: nonStrikerName, stat: nonStrikerStat, striker: false },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem_2.5rem] gap-x-2 px-3 py-2 text-sm tabular-nums"
                >
                  <div className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                    <span className="truncate">{row.name ?? "—"}</span>
                    {row.striker && row.name && (
                      <span className="shrink-0 text-primary" aria-label="on strike">*</span>
                    )}
                  </div>
                  <div className="text-right font-bold">{row.stat?.runs ?? 0}</div>
                  <div className="text-right">{row.stat?.balls ?? 0}</div>
                  <div className="text-right">{row.stat?.fours ?? 0}</div>
                  <div className="text-right">{row.stat?.sixes ?? 0}</div>
                </div>
              ))}
            </div>

            {/* Bowling (below batter list) */}
            <div className="rounded-2xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Bowling
                  </div>
                  <div className="mt-0.5 truncate text-base font-bold">{bowlerName ?? "—"}</div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span className="text-lg font-black">
                    {bowlerStat?.wickets ?? 0}/{bowlerStat?.runs ?? 0}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({oversDisplay(bowlerStat?.balls ?? 0)} ov)
                  </span>
                </div>
              </div>
            </div>

            {/* Recent balls: previous over → | → current over */}
            <div className="rounded-2xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Recent balls
                  {currentOverNo != null ? ` · Over ${currentOverNo + 1}` : ""}
                </div>
                <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {recentBallsRunSum} runs
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {recentOverGroups.length === 0 && (
                  <span className="text-xs text-muted-foreground">Yet to begin</span>
                )}
                {recentOverGroups.map((group, gi) => (
                  <div key={group.overNo} className="flex items-center gap-1.5">
                    {gi > 0 && (
                      <span
                        aria-hidden
                        className="mx-1 h-5 w-px bg-border"
                        title={`End of over ${group.overNo + 1}`}
                      />
                    )}
                    {group.balls.map((b) => (
                      <BallChip key={b.id} b={b} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

          </section>
        </>
      ) : null}

      {currentInnings ? (
        /* Scorecard tabs (Summary / Batting / Bowling / Overs / Squad / Commentary).
           Rendered for both batted and yet-to-bat teams so Squad/Bowling remain reachable. */
        <div className="mt-6 rounded-3xl border border-border/60 bg-card p-4 sm:p-6">
          <LiveScorecard
            events={currentBalls}
            innings={currentInnings}
            totalOvers={match.overs}
            hideHero={true}
            commentary={commentary}
            battingPending={!activeTeamHasBatted}
            bowlingStatsEvents={activeTeamHasBatted ? undefined : bowlingBalls}
            squad={{
              matchId: match.id,
              teamId: activeTeamId,
              teamName: teams[activeTeamId]?.name ?? (activeTeamId === match.team_a_id ? homeName : awayName),
            }}
            otherSquad={{
              matchId: match.id,
              teamId: activeTeamId === match.team_a_id ? match.team_b_id : match.team_a_id,
              teamName: (activeTeamId === match.team_a_id ? awayName : homeName),
            }}
            matchInfo={{
              ground: match.ground_name,
              format: match.match_format,
              date: match.scheduled_date,
              homeTeam: homeName,
              awayTeam: awayName,
              result: match.result,
            }}
            teamSwitcher={
              <TeamToggle
                teams={teams}
                match={match}
                homeName={homeName}
                awayName={awayName}
                battingFirstTeamId={battingFirstTeamId}
                battingSecondTeamId={battingSecondTeamId}
                activeTeamId={activeTeamId}
                allInnings={allInnings}
                onSelect={setSelectedTeamId}
              />
            }
            squadSwitcher={
              <TeamToggle
                teams={teams}
                match={match}
                homeName={homeName}
                awayName={awayName}
                battingFirstTeamId={battingFirstTeamId}
                battingSecondTeamId={battingSecondTeamId}
                activeTeamId={activeTeamId}
                allInnings={allInnings}
                onSelect={setSelectedTeamId}
                hideScores
              />
            }
          />
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border/60 bg-card p-6 text-center text-muted-foreground">
          The match hasn&apos;t started yet.
        </div>
      )}
    </div>
  );
}

function TeamToggle({
  teams,
  match,
  homeName,
  awayName,
  battingFirstTeamId,
  battingSecondTeamId,
  activeTeamId,
  allInnings,
  onSelect,
  hideScores,
}: {
  teams: Record<string, { name: string; logo_url: string | null }>;
  match: PublicMatchDetailRow;
  homeName: string;
  awayName: string;
  battingFirstTeamId: string;
  battingSecondTeamId: string;
  activeTeamId: string;
  allInnings: MCInnings[];
  onSelect: (id: string) => void;
  hideScores?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-border/60 bg-card p-1 text-xs font-semibold">
      {[
        { id: battingFirstTeamId, name: teams[battingFirstTeamId]?.name ?? (battingFirstTeamId === match.team_a_id ? homeName : awayName) },
        { id: battingSecondTeamId, name: teams[battingSecondTeamId]?.name ?? (battingSecondTeamId === match.team_a_id ? homeName : awayName) },
      ].map((t) => {
        const inn = allInnings.find((i) => i.batting_team_id === t.id);
        const active = t.id === activeTeamId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={
              "rounded-full px-3.5 py-1.5 transition " +
              (active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <span className="truncate">{t.name}</span>
            {!hideScores && (
              <span className="ml-1.5 tabular-nums opacity-80">
                {inn ? `${inn.runs}/${inn.wickets}` : "—"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}



function YetToBatPanel({
  teamName,
  bowlingBalls,
  oversDisplay,
}: {
  teamName: string;
  bowlingBalls: MCBallEvent[];
  oversDisplay: (legalBalls: number) => string;
}) {
  const bowlers = new Map<string, { runs: number; balls: number; wickets: number; maidens: number; ballsInOver: number; runsInOver: number; lastOver: number | null }>();
  for (const b of bowlingBalls) {
    if (!b.bowler_name) continue;
    const et = (b.extra_type as string | null) ?? null;
    const isWide = et === "wide";
    const isNoBall = et === "no_ball";
    const legal = !isWide && !isNoBall;
    const s = bowlers.get(b.bowler_name) ?? { runs: 0, balls: 0, wickets: 0, maidens: 0, ballsInOver: 0, runsInOver: 0, lastOver: null };
    if (s.lastOver !== null && s.lastOver !== b.over_number) {
      if (s.ballsInOver === 6 && s.runsInOver === 0) s.maidens += 1;
      s.ballsInOver = 0;
      s.runsInOver = 0;
    }
    s.lastOver = b.over_number;
    const runs = (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0);
    s.runs += runs;
    s.runsInOver += runs;
    if (legal) {
      s.balls += 1;
      s.ballsInOver += 1;
    }
    if (b.dismissal_type && b.dismissal_type !== "run_out") s.wickets += 1;
    bowlers.set(b.bowler_name, s);
  }
  for (const s of bowlers.values()) {
    if (s.ballsInOver === 6 && s.runsInOver === 0) s.maidens += 1;
  }
  const rows = Array.from(bowlers.entries()).sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs);

  return (
    <section className="mt-6 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {teamName}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-black leading-none tabular-nums tracking-tight sm:text-6xl text-muted-foreground/70">
              —
            </span>
            <span className="text-sm font-semibold text-muted-foreground">Yet to bat</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-background/50">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem_2.5rem] gap-x-2 border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <div>Bowling</div>
          <div className="text-right">O</div>
          <div className="text-right">M</div>
          <div className="text-right">R</div>
          <div className="text-right">W</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No bowling data yet</div>
        ) : (
          rows.map(([name, s]) => (
            <div
              key={name}
              className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem_2.5rem] gap-x-2 px-3 py-2 text-sm tabular-nums"
            >
              <div className="truncate font-semibold">{name}</div>
              <div className="text-right">{oversDisplay(s.balls)}</div>
              <div className="text-right">{s.maidens}</div>
              <div className="text-right">{s.runs}</div>
              <div className="text-right font-bold">{s.wickets}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}


