import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MatchHeader,
  PlayerPanel,
  BowlerPanel,
  OverTimeline,
  ScoreButton,
  RunsButton,
  ExtraButton,
  UndoButton,
  DismissalModal,
  PlayerPickerModal,
  RunOutModal,
  ExtraRunsModal,
  SquadDrawer,
  CommentaryPanel,
  type ConnectionStatus,
  type DismissalKind,
  type PlayerOption,
  type BatterStats,
  type BowlerStats,
} from "@/components/match-center/scoring-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useScoringSession, ballHelpers } from "@/hooks/use-scoring-session";
import { calculateInningsStatistics } from "@/lib/mc-statistics-engine";
import { buildCommentary, ballChipLabel } from "@/lib/mc-commentary";
import type { DismissalType, MCBallEvent } from "@/lib/mc-ball-events";
import { updateMatchStatus } from "@/lib/mc-matches";
import { LiveScorecard } from "@/components/match-center/live-scorecard";
import { FinalizationDialog, UnlockMatchDialog } from "@/components/match-center/finalization-ui";
import { detectMatchResult, type InningsRow, type MatchResult } from "@/lib/mc-finalization";
import {
  Users,
  ClipboardList,
  ArrowLeft,
  Printer,
  Share2,
  FileText,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/scorer/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Scorer · Match Center" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ScorerPage,
});

/* ---------------- helpers ---------------- */

const DISMISSAL_MAP: Record<DismissalKind, DismissalType> = {
  Bowled: "bowled",
  Caught: "caught",
  LBW: "lbw",
  "Run Out": "run_out",
  Stumped: "stumped",
  "Hit Wicket": "hit_wicket",
  "Retired Hurt": "retired_hurt",
  "Retired Out": "retired_out",
  "Timed Out": "timed_out",
};




function ScorerPage() {
  const { matchId } = Route.useParams();
  const isDemo = matchId === "demo";

  // Auth user
  const userQ = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  // Match tenant (needed by hook for writes)
  const tenantQ = useQuery({
    enabled: !isDemo,
    queryKey: ["mc-match-tenant", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_matches")
        .select("tenant_id")
        .eq("id", matchId)
        .maybeSingle();
      return data?.tenant_id ?? null;
    },
  });

  const session = useScoringSession(isDemo ? undefined : matchId, {
    tenantId: tenantQ.data ?? undefined,
    userId: userQ.data?.id ?? null,
  });

  // Team names
  const teamsQ = useQuery({
    enabled: !!session.match,
    queryKey: ["mc-match-teams", session.match?.id],
    queryFn: async () => {
      if (!session.match) return null;
      const { data } = await supabase
        .from("mc_teams")
        .select("id, name, short_name")
        .in("id", [session.match.team_a_id, session.match.team_b_id].filter(Boolean));
      return data ?? [];
    },
  });

  // Squad names — resolve athlete_profile_id → student name
  const nameMapQ = useQuery({
    enabled: session.playingXI.length > 0,
    queryKey: ["mc-scorer-names", session.playingXI.map((p) => p.id).join(",")],
    queryFn: async () => {
      const ids = session.playingXI
        .map((p) => p.athlete_profile_id)
        .filter((x): x is string => !!x);
      if (ids.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from("mc_athlete_profiles")
        .select("id, students:student_id(name)")
        .in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { id: string; students: { name: string } | null }) => {
        if (r.students?.name) map[r.id] = r.students.name;
      });
      return map;
    },
  });

  const nameMap = nameMapQ.data ?? {};

  const battingOptions: PlayerOption[] = useMemo(
    () =>
      session.battingSquad.map((p) => ({
        id: p.athlete_profile_id ?? `ext:${p.id}`,
        name:
          (p.athlete_profile_id && nameMap[p.athlete_profile_id]) ||
          p.external_player_name ||
          "Player",
        role: p.role ?? undefined,
      })),
    [session.battingSquad, nameMap],
  );
  const bowlingOptions: PlayerOption[] = useMemo(
    () =>
      session.bowlingSquad.map((p) => ({
        id: p.athlete_profile_id ?? `ext:${p.id}`,
        name:
          (p.athlete_profile_id && nameMap[p.athlete_profile_id]) ||
          p.external_player_name ||
          "Player",
        role: p.role ?? undefined,
      })),
    [session.bowlingSquad, nameMap],
  );

  const findSquad = (opt: PlayerOption) =>
    session.playingXI.find(
      (p) =>
        (p.athlete_profile_id && opt.id === p.athlete_profile_id) ||
        opt.id === `ext:${p.id}`,
    );

  const setPlayer = (
    slot: "striker" | "nonStriker" | "bowler",
    opt: PlayerOption,
  ) => {
    const squad = findSquad(opt);
    const payload = {
      athleteId: squad?.athlete_profile_id ?? null,
      name: opt.name,
    };
    if (slot === "striker") session.setStriker({ ...payload, onStrike: true });
    else if (slot === "nonStriker")
      session.setNonStriker({ ...payload, onStrike: false });
    else session.setBowler(payload);
  };

  /* ---------- modal state ---------- */
  const [dismissOpen, setDismissOpen] = useState(false);

  const [caughtOpen, setCaughtOpen] = useState(false);
  const [runOutOpen, setRunOutOpen] = useState(false);
  const [newBatterOpen, setNewBatterOpen] = useState(false);
  const [newBowlerOpen, setNewBowlerOpen] = useState(false);
  const [pickStrikerOpen, setPickStrikerOpen] = useState(false);
  const [pickNonStrikerOpen, setPickNonStrikerOpen] = useState(false);
  const [pickBowlerOpen, setPickBowlerOpen] = useState(false);
  const [extraKind, setExtraKind] = useState<"Wide" | "No Ball" | "Bye" | "Leg Bye" | null>(null);
  const [rightDrawer, setRightDrawer] = useState(false);
  const [leftDrawer, setLeftDrawer] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [inningsCompleteOpen, setInningsCompleteOpen] = useState(false);
  const [matchCompleteOpen, setMatchCompleteOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [commentaryCollapsed, setCommentaryCollapsed] = useState(false);

  /* ---------- innings/match completion detection ---------- */
  useEffect(() => {
    if (session.matchState.inningsShouldEnd && !inningsCompleteOpen) {
      setInningsCompleteOpen(true);
    }
  }, [session.matchState.inningsShouldEnd, inningsCompleteOpen]);

  useEffect(() => {
    if (session.matchState.matchShouldEnd && !matchCompleteOpen) {
      setMatchCompleteOpen(true);
    }
  }, [session.matchState.matchShouldEnd, matchCompleteOpen]);

  /* ---------- stats ---------- */
  const stats = useMemo(
    () =>
      calculateInningsStatistics(session.events, {
        totalOvers: session.match?.overs ?? null,
        target: session.activeInnings?.target ?? null,
      }),
    [session.events, session.match?.overs, session.activeInnings?.target],
  );

  const striker = session.striker;
  const nonStriker = session.nonStriker;
  const bowlerRef = session.bowler;

  const strikerKey = striker.athleteId
    ? `id:${striker.athleteId}`
    : striker.name
      ? `name:${striker.name.toLowerCase()}`
      : null;
  const nonStrikerKey = nonStriker.athleteId
    ? `id:${nonStriker.athleteId}`
    : nonStriker.name
      ? `name:${nonStriker.name.toLowerCase()}`
      : null;
  const bowlerKey = bowlerRef.athleteId
    ? `id:${bowlerRef.athleteId}`
    : bowlerRef.name
      ? `name:${bowlerRef.name.toLowerCase()}`
      : null;

  const strikerStat: BatterStats | undefined = strikerKey
    ? (() => {
        const s = stats.batting.byKey.get(strikerKey);
        return {
          name: striker.name ?? undefined,
          runs: s?.runs ?? 0,
          balls: s?.balls ?? 0,
          fours: s?.fours ?? 0,
          sixes: s?.sixes ?? 0,
          strikeRate: s ? String(s.strikeRate) : "0.0",
          last5: session.events
            .filter((e) => e.striker_athlete_id === striker.athleteId || e.striker_name === striker.name)
            .slice(-5)
            .map(ballChipLabel),
          onStrike: true,
        };
      })()
    : undefined;

  const nonStrikerStat: BatterStats | undefined = nonStrikerKey
    ? (() => {
        const s = stats.batting.byKey.get(nonStrikerKey);
        return {
          name: nonStriker.name ?? undefined,
          runs: s?.runs ?? 0,
          balls: s?.balls ?? 0,
          strikeRate: s ? String(s.strikeRate) : "0.0",
        };
      })()
    : undefined;

  const bowlerStat: BowlerStats | undefined = bowlerKey
    ? (() => {
        const b = stats.bowling.byKey.get(bowlerKey);
        return {
          name: bowlerRef.name ?? undefined,
          overs: b?.oversDisplay ?? "0.0",
          runs: b?.runsConceded ?? 0,
          wickets: b?.wickets ?? 0,
          economy: b ? String(b.economy) : "–",
          lastOver: session.currentOver.events.map(ballChipLabel),
        };
      })()
    : undefined;

  /* ---------- header text ---------- */
  const teamMap = new Map((teamsQ.data ?? []).map((t) => [t.id, t]));
  const battingTeamId = session.activeInnings?.batting_team_id ?? session.match?.team_a_id ?? "";
  const bowlingTeamId = session.activeInnings?.bowling_team_id ?? session.match?.team_b_id ?? "";
  const homeName = teamMap.get(battingTeamId)?.name ?? "Home";
  const awayName = teamMap.get(bowlingTeamId)?.name ?? "Away";

  const connection: ConnectionStatus =
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online";

  const commentary = useMemo(() => buildCommentary(session.events), [session.events]);

  /* ---------- ball submission ---------- */
  const submit = async (partial: Parameters<typeof session.submitBall>[0]) => {
    try {
      await session.submitBall(partial);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record ball");
    }
  };

  const onRun = (r: 0 | 1 | 2 | 3 | 4 | 6) => submit(ballHelpers.run(r));

  const onExtraRuns = (runs: number) => {
    if (!extraKind) return;
    const kind = extraKind;
    setExtraKind(null);
    if (kind === "Wide") submit(ballHelpers.wide(runs));
    else if (kind === "No Ball") submit(ballHelpers.noBall(Math.max(0, runs - 1)));
    else if (kind === "Bye") submit(ballHelpers.bye(runs));
    else if (kind === "Leg Bye") submit(ballHelpers.legBye(runs));
  };

  const finalizeWicket = async (
    kind: DismissalType,
    opts?: {
      fielder?: PlayerOption | null;
      dismissed?: "striker" | "non-striker";
    },
  ) => {
    const dismissedRef =
      opts?.dismissed === "non-striker"
        ? { id: nonStriker.athleteId, name: nonStriker.name }
        : { id: striker.athleteId, name: striker.name };
    await submit(
      ballHelpers.wicket(kind, {
        fielderAthleteId: opts?.fielder?.id ?? null,
        fielderName: opts?.fielder?.name ?? null,
        dismissedAthleteId: dismissedRef.id,
        dismissedName: dismissedRef.name,
      }),
    );
    setNewBatterOpen(true);
  };

  const handleDismissal = (kind: DismissalKind) => {
    setDismissOpen(false);
    if (kind === "Caught") {
      setCaughtOpen(true);
    } else if (kind === "Run Out") {
      setRunOutOpen(true);
    } else {
      void finalizeWicket(DISMISSAL_MAP[kind]);
    }
  };

  /* ---------- start innings if needed ---------- */
  const noInnings = !session.loading && !session.activeInnings && !!session.match;
  const startFirstInnings = async () => {
    if (!session.match) return;
    try {
      await session.startInnings({
        inningsNumber: 1,
        battingTeamId: session.match.team_a_id,
        bowlingTeamId: session.match.team_b_id,
        target: null,
      });
      toast.success("Innings started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start innings");
    }
  };

  const startSecondInnings = async () => {
    if (!session.match || !session.activeInnings) return;
    const target = session.matchState.innings.runs + 1;
    try {
      // Complete current innings then start next
      await supabase
        .from("mc_innings")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", session.activeInnings.id);
      await session.startInnings({
        inningsNumber: 2,
        battingTeamId: session.activeInnings.bowling_team_id,
        bowlingTeamId: session.activeInnings.batting_team_id,
        target,
      });
      session.setStriker({ athleteId: null, name: null, onStrike: true });
      session.setNonStriker({ athleteId: null, name: null, onStrike: false });
      session.setBowler({ athleteId: null, name: null });
      setInningsCompleteOpen(false);
      toast.success(`Innings 2 · target ${target}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start next innings");
    }
  };

  const finalizeMatch = async () => {
    if (!session.match) return;
    try {
      await updateMatchStatus(session.match.id, "completed");
      toast.success("Match completed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finalize match");
    }
  };

  /* ---------- result string ---------- */
  const resultLine = (() => {
    const ms = session.matchState;
    if (ms.inningsShouldEnd === "target_achieved" && session.matchState.innings) {
      const wicketsLeft = 10 - ms.innings.wickets;
      return `${homeName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    }
    if (ms.inningsShouldEnd === "all_out" || ms.inningsShouldEnd === "overs_finished") {
      if (session.activeInnings?.target != null) {
        const diff = session.activeInnings.target - 1 - ms.innings.runs;
        if (diff > 0) return `${awayName} won by ${diff} run${diff === 1 ? "" : "s"}`;
        if (diff === 0) return "Match tied";
      }
      return "Innings complete";
    }
    return null;
  })();

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(ev.target.tagName))
        return;
      if (ev.key >= "0" && ev.key <= "6" && ev.key !== "5") {
        onRun(Number(ev.key) as 0 | 1 | 2 | 3 | 4 | 6);
      } else if (ev.key.toLowerCase() === "w") setDismissOpen(true);
      else if (ev.key.toLowerCase() === "u") void session.undo();
      else if (ev.key.toLowerCase() === "d") setExtraKind("Wide");
      else if (ev.key.toLowerCase() === "n") setExtraKind("No Ball");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.submitBall, session.undo]);

  /* ---------- render ---------- */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <MatchHeader
        homeTeam={homeName}
        awayTeam={awayName}
        score={`${stats.team.runs}/${stats.team.wickets}`}
        overs={stats.team.oversDisplay}
        crr={String(stats.team.runRate)}
        rrr={stats.team.requiredRunRate != null ? String(stats.team.requiredRunRate) : undefined}
        target={session.activeInnings?.target != null ? String(session.activeInnings.target) : undefined}
        status={session.activeInnings ? `Innings ${session.activeInnings.innings_number}` : "Setup"}
        format={session.match?.match_format ?? undefined}
        ground={session.match?.ground_name ?? undefined}
        tournament={session.match?.match_type ?? undefined}
        connection={connection}
      />

      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
            <Link to="/match-center/live">
              <ArrowLeft className="size-3.5" /> Exit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setLeftDrawer(true)}
          >
            <ClipboardList className="size-3.5" /> Match info
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setScorecardOpen(true)}
          >
            <FileText className="size-3.5" /> Scorecard
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setRightDrawer(true)}
          >
            <Users className="size-3.5" /> Squad
          </Button>
        </div>
      </div>

      {isDemo ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div className="max-w-md space-y-3">
            <div className="text-lg font-semibold">Demo scorer</div>
            <p className="text-sm text-muted-foreground">
              This is a placeholder route. Create a real match from Match
              Center → Create, then open its scorer.
            </p>
            <Button asChild>
              <Link to="/match-center/create">Create a match</Link>
            </Button>
          </div>
        </div>
      ) : session.loading ? (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
          Loading match…
        </div>
      ) : session.error ? (
        <div className="grid flex-1 place-items-center text-sm text-destructive">
          {session.error}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Left: Batters */}
          <div className="flex min-h-0 flex-col gap-3">
            <PlayerPanel striker={strikerStat} nonStriker={nonStrikerStat} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setPickStrikerOpen(true)}>
                {striker.name ? "Change striker" : "Select striker"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPickNonStrikerOpen(true)}>
                {nonStriker.name ? "Change non-striker" : "Select non-striker"}
              </Button>
            </div>
            {stats.team.currentPartnership && (
              <div className="rounded-lg border bg-card p-3 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Partnership
                </div>
                <div className="mt-0.5 font-semibold tabular-nums">
                  {stats.team.currentPartnership.runs} ({stats.team.currentPartnership.balls})
                </div>
              </div>
            )}
          </div>

          {/* Center: over timeline + scoring buttons */}
          <div className="flex min-h-0 flex-col gap-3">
            <OverTimeline balls={session.currentOver.events.map(ballChipLabel)} />

            {noInnings ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center">
                <div className="text-sm font-semibold">Ready to start?</div>
                <p className="text-xs text-muted-foreground">
                  No innings has been created for this match yet.
                </p>
                <Button onClick={startFirstInnings}>Start innings 1</Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2">
                  {([0, 1, 2, 3, 4, 6] as const).map((r) => (
                    <RunsButton key={r} value={r} onClick={() => onRun(r)} />
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <ExtraButton label="Wide" onClick={() => setExtraKind("Wide")} />
                  <ExtraButton label="No Ball" onClick={() => setExtraKind("No Ball")} />
                  <ExtraButton label="Bye" onClick={() => setExtraKind("Bye")} />
                  <ExtraButton label="Leg Bye" onClick={() => setExtraKind("Leg Bye")} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ScoreButton
                    label="OUT"
                    tone="wicket"
                    size="xl"
                    onClick={() => setDismissOpen(true)}
                    className="sm:col-span-2"
                  />
                  <ScoreButton
                    label="Swap"
                    tone="neutral"
                    sublabel="Strike"
                    onClick={() => {
                      const s = { ...session.striker };
                      session.setStriker({ ...session.nonStriker, onStrike: true });
                      session.setNonStriker({ ...s, onStrike: false });
                    }}
                  />
                  <ScoreButton
                    label="End"
                    tone="danger"
                    sublabel="Match"
                    onClick={finalizeMatch}
                  />
                </div>
              </>
            )}

            <CommentaryPanel
              entries={commentary.slice(0, 12)}
              collapsed={commentaryCollapsed}
              onToggle={() => setCommentaryCollapsed((v) => !v)}
            />
          </div>

          {/* Right: Bowler + undo */}
          <div className="flex min-h-0 flex-col gap-3">
            <BowlerPanel bowler={bowlerStat} />
            <Button variant="outline" size="sm" onClick={() => setPickBowlerOpen(true)}>
              {bowlerRef.name ? "Change bowler" : "Select bowler"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <UndoButton onClick={() => void session.undo()} />
              <Button variant="secondary" size="lg" className="h-14 gap-2" onClick={() => setScorecardOpen(true)}>
                <FileText className="size-4" /> Card
              </Button>
            </div>
            {session.matchState.innings.awaitingNewBatter && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                Waiting for next batter…
                <Button size="sm" className="mt-2 w-full" onClick={() => setNewBatterOpen(true)}>
                  Select
                </Button>
              </div>
            )}
            {session.matchState.innings.awaitingNewBowler && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                Over complete — assign next bowler.
                <Button size="sm" className="mt-2 w-full" onClick={() => setNewBowlerOpen(true)}>
                  Select
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- modals ---------- */}
      <DismissalModal
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        onSelect={handleDismissal}
      />

      <PlayerPickerModal
        open={caughtOpen}
        onOpenChange={setCaughtOpen}
        title="Who took the catch?"
        players={bowlingOptions}
        recent={bowlingOptions.slice(0, 3)}
        onSelect={(p) => {
          setCaughtOpen(false);
          void finalizeWicket("caught", { fielder: p });
        }}
      />

      <RunOutModal
        open={runOutOpen}
        onOpenChange={setRunOutOpen}
        onSelect={(who) => {
          setRunOutOpen(false);
          void finalizeWicket("run_out", { dismissed: who });
        }}
      />

      <PlayerPickerModal
        open={newBatterOpen}
        onOpenChange={setNewBatterOpen}
        title="Select next batter"
        description="Choose the incoming batter."
        players={battingOptions.filter(
          (o) =>
            o.id !== (session.striker.athleteId ?? `name:${session.striker.name}`) &&
            o.id !== (session.nonStriker.athleteId ?? `name:${session.nonStriker.name}`),
        )}
        onSelect={(p) => {
          setPlayer("striker", p);
          setNewBatterOpen(false);
        }}
      />

      <PlayerPickerModal
        open={newBowlerOpen}
        onOpenChange={setNewBowlerOpen}
        title="Select next bowler"
        description="Cannot be the previous over's bowler."
        players={bowlingOptions}
        onSelect={(p) => {
          setPlayer("bowler", p);
          setNewBowlerOpen(false);
        }}
      />

      <PlayerPickerModal
        open={pickStrikerOpen}
        onOpenChange={setPickStrikerOpen}
        title="Select striker"
        players={battingOptions}
        onSelect={(p) => {
          setPlayer("striker", p);
          setPickStrikerOpen(false);
        }}
      />
      <PlayerPickerModal
        open={pickNonStrikerOpen}
        onOpenChange={setPickNonStrikerOpen}
        title="Select non-striker"
        players={battingOptions}
        onSelect={(p) => {
          setPlayer("nonStriker", p);
          setPickNonStrikerOpen(false);
        }}
      />
      <PlayerPickerModal
        open={pickBowlerOpen}
        onOpenChange={setPickBowlerOpen}
        title="Select bowler"
        players={bowlingOptions}
        onSelect={(p) => {
          setPlayer("bowler", p);
          setPickBowlerOpen(false);
        }}
      />

      <ExtraRunsModal
        open={!!extraKind}
        onOpenChange={(v) => !v && setExtraKind(null)}
        kind={extraKind ?? ""}
        onSelect={onExtraRuns}
      />

      {/* Scorecard drawer */}
      <Dialog open={scorecardOpen} onOpenChange={setScorecardOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Scorecard</DialogTitle>
            <DialogDescription>
              Live totals derived from every ball. Nothing entered manually.
            </DialogDescription>
          </DialogHeader>
          <LiveScorecard
            events={session.events}
            innings={session.activeInnings}
            totalOvers={session.match?.overs ?? null}
            matchInfo={{
              homeTeam: homeName,
              awayTeam: awayName,
              format: session.match?.match_format ?? null,
              ground: session.match?.ground_name ?? null,
              tournament: session.match?.match_type ?? null,
              date: session.match?.scheduled_date ?? null,
              result: resultLine,
            }}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-4" /> Print
            </Button>
            <Button variant="outline" size="sm" disabled>
              <FileText className="mr-1.5 size-4" /> PDF (soon)
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Share2 className="mr-1.5 size-4" /> Share (soon)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Innings complete */}
      <Dialog open={inningsCompleteOpen} onOpenChange={setInningsCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Innings complete</DialogTitle>
            <DialogDescription>
              {session.matchState.inningsShouldEnd === "all_out" && "All out."}
              {session.matchState.inningsShouldEnd === "overs_finished" && "Overs finished."}
              {session.matchState.inningsShouldEnd === "target_achieved" && "Target achieved."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-3xl font-black tabular-nums">
              {stats.team.runs}/{stats.team.wickets}
            </div>
            <div className="text-xs text-muted-foreground">{stats.team.oversDisplay} overs</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScorecardOpen(true)}>
              Review scorecard
            </Button>
            {session.matchState.matchShouldEnd ? (
              <Button onClick={finalizeMatch}>Finalize match</Button>
            ) : (
              <Button onClick={startSecondInnings}>Start next innings</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match complete */}
      <Dialog open={matchCompleteOpen} onOpenChange={setMatchCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-primary" /> Match complete
            </DialogTitle>
            <DialogDescription>
              {resultLine ?? "Match ended."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Final score
            </div>
            <div className="mt-1 text-3xl font-black tabular-nums">
              {stats.team.runs}/{stats.team.wickets}
            </div>
            <div className="text-xs text-muted-foreground">{stats.team.oversDisplay} overs</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScorecardOpen(true)}>
              View scorecard
            </Button>
            <Button onClick={finalizeMatch}>Finalize</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Right squad drawer */}
      <SquadDrawer
        open={rightDrawer}
        onOpenChange={setRightDrawer}
        side="right"
        title="Squad"
      >
        <SquadSection title={`${homeName} · Batting`} players={battingOptions} />
        <SquadSection title={`${awayName} · Bowling`} players={bowlingOptions} />
      </SquadDrawer>

      {/* Left match info drawer */}
      <SquadDrawer
        open={leftDrawer}
        onOpenChange={setLeftDrawer}
        side="left"
        title="Match info"
      >
        <InfoRow label="Format" value={session.match?.match_format ?? "—"} />
        <InfoRow label="Overs" value={session.match?.overs != null ? String(session.match.overs) : "—"} />
        <InfoRow label="Ground" value={session.match?.ground_name ?? "—"} />
        <InfoRow label="Tournament" value={session.match?.match_type ?? "—"} />
        <InfoRow label="Umpire" value={session.match?.umpire ?? "—"} />
        <InfoRow label="Scorer" value={session.match?.scorer ?? "—"} />
      </SquadDrawer>
    </div>
  );
}

function SquadSection({ title, players }: { title: string; players: PlayerOption[] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {players.length === 0 ? (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          No players.
        </div>
      ) : (
        <ul className="space-y-1">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.role}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
