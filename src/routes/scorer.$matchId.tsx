import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DismissalModal,
  PlayerPickerModal,
  RunOutModal,
  ExtraRunsModal,
  SquadDrawer,
  type DismissalKind,
  type PlayerOption,
  type BatterStats,
  type BowlerStats,
} from "@/components/match-center/scoring-ui";
import { MobileScorer } from "@/components/match-center/mobile-scorer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useScoringSession, ballHelpers } from "@/hooks/use-scoring-session";
import { calculateInningsStatistics } from "@/lib/mc-statistics-engine";
import { ballChipLabel } from "@/lib/mc-commentary";
import type { DismissalType, ExtraType } from "@/lib/mc-ball-events";

import { LiveScorecard } from "@/components/match-center/live-scorecard";
import { ShareMatchDialog } from "@/components/match-center/share-match-dialog";
import { FinalizationDialog, UnlockMatchDialog } from "@/components/match-center/finalization-ui";
import { detectMatchResult, type InningsRow, type MatchResult } from "@/lib/mc-finalization";
import {
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
  const isDemoPlaceholder = matchId === "demo";
  const isDemoMatch = typeof matchId === "string" && matchId.startsWith("demo-");

  // Demo-mode short-circuit: render a read-only demo scorer for any demo-* id.
  if (isDemoMatch) {
    return <DemoScorerView matchId={matchId} />;
  }

  const isDemo = isDemoPlaceholder;

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
  const [shareOpen, setShareOpen] = useState(false);
  const [inningsCompleteOpen, setInningsCompleteOpen] = useState(false);
  const [matchCompleteOpen, setMatchCompleteOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [commentaryCollapsed, setCommentaryCollapsed] = useState(false);
  const [pendingBallIntent, setPendingBallIntent] = useState<Parameters<typeof session.submitBall>[0] | null>(null);

  /* ---------- hydrate current players from event log on resume ---------- */
  useEffect(() => {
    if (session.loading) return;
    const rs = session.matchState.innings.striker;
    const rn = session.matchState.innings.nonStriker;
    const rb = session.matchState.innings.bowler;
    const strikerEmpty = !session.striker.athleteId && !session.striker.name;
    const nonStrikerEmpty = !session.nonStriker.athleteId && !session.nonStriker.name;
    const bowlerEmpty = !session.bowler.athleteId && !session.bowler.name;
    if (strikerEmpty && (rs.athleteId || rs.name)) {
      const dismissed =
        (rs.athleteId && session.matchState.innings.dismissedIds.has(rs.athleteId)) ||
        (rs.name && session.matchState.innings.dismissedNames.has(rs.name));
      if (!dismissed) session.setStriker({ athleteId: rs.athleteId, name: rs.name, onStrike: true });
    }
    if (nonStrikerEmpty && (rn.athleteId || rn.name)) {
      const dismissed =
        (rn.athleteId && session.matchState.innings.dismissedIds.has(rn.athleteId)) ||
        (rn.name && session.matchState.innings.dismissedNames.has(rn.name));
      if (!dismissed) session.setNonStriker({ athleteId: rn.athleteId, name: rn.name, onStrike: false });
    }
    if (bowlerEmpty && (rb.athleteId || rb.name) && !session.matchState.innings.awaitingNewBowler) {
      session.setBowler({ athleteId: rb.athleteId, name: rb.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session.loading,
    session.matchState.innings.striker.athleteId,
    session.matchState.innings.striker.name,
    session.matchState.innings.nonStriker.athleteId,
    session.matchState.innings.nonStriker.name,
    session.matchState.innings.bowler.athleteId,
    session.matchState.innings.bowler.name,
    session.matchState.innings.awaitingNewBowler,
  ]);

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

  /* Batter/bowler setup is handled from the mobile scorer rows and bottom sheets. */

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
          order: s?.battingPosition,
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
          fours: s?.fours ?? 0,
          sixes: s?.sixes ?? 0,
          strikeRate: s ? String(s.strikeRate) : "0.0",
          order: s?.battingPosition,
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

  const currentOverLabel = (() => {
    if (!session.currentOver.events.length || session.currentOver.ballsBowled >= 6) {
      return stats.team.oversDisplay;
    }
    return `${session.currentOver.overNumber}.${session.currentOver.ballsBowled}`;
  })();

  const previousOverBowler = session.matchState.innings.completedOvers.at(-1);
  const strikerSelected = Boolean(striker.athleteId || striker.name);
  const nonStrikerSelected = Boolean(nonStriker.athleteId || nonStriker.name);
  const bowlerSelected = Boolean(bowlerRef.athleteId || bowlerRef.name);
  const strikerDismissed = Boolean(
    (striker.athleteId && session.matchState.innings.dismissedIds.has(striker.athleteId)) ||
      (striker.name && session.matchState.innings.dismissedNames.has(striker.name)),
  );
  const nonStrikerDismissed = Boolean(
    (nonStriker.athleteId && session.matchState.innings.dismissedIds.has(nonStriker.athleteId)) ||
      (nonStriker.name && session.matchState.innings.dismissedNames.has(nonStriker.name)),
  );
  const incomingBatterRole = !strikerSelected || strikerDismissed
    ? "striker"
    : !nonStrikerSelected || nonStrikerDismissed
      ? "nonStriker"
      : null;
  const sameAsPreviousBowler = Boolean(
    previousOverBowler &&
      ((bowlerRef.athleteId &&
        previousOverBowler.bowlerAthleteId &&
        bowlerRef.athleteId === previousOverBowler.bowlerAthleteId) ||
        (bowlerRef.name &&
          previousOverBowler.bowlerName &&
          bowlerRef.name === previousOverBowler.bowlerName)),
  );
  const newBowlerStillNeeded = Boolean(
    session.matchState.innings.awaitingNewBowler && (!bowlerSelected || sameAsPreviousBowler),
  );
  const requiredPicker = session.matchState.inningsShouldEnd
    ? null
    : incomingBatterRole
      ? incomingBatterRole
      : !strikerSelected
        ? "striker"
        : !nonStrikerSelected
          ? "nonStriker"
          : newBowlerStillNeeded || !bowlerSelected
            ? "bowler"
            : null;

  /* ---------- header text ---------- */
  const teamMap = new Map((teamsQ.data ?? []).map((t) => [t.id, t]));
  const battingTeamId = session.activeInnings?.batting_team_id ?? session.match?.team_a_id ?? "";
  const bowlingTeamId = session.activeInnings?.bowling_team_id ?? session.match?.team_b_id ?? "";
  const homeName = teamMap.get(battingTeamId)?.name ?? "Home";
  const awayName = teamMap.get(bowlingTeamId)?.name ?? "Away";

  // (connection status handled implicitly by MobileScorer; kept for future use)


  /* ---------- ball submission ---------- */
  const [redoStack, setRedoStack] = useState<
    Awaited<ReturnType<typeof session.undo>>[]
  >([]);
  const submit = async (partial: Parameters<typeof session.submitBall>[0]) => {
    try {
      await session.submitBall(partial);
      setRedoStack([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record ball");
    }
  };
  const requestSubmit = (partial: Parameters<typeof session.submitBall>[0]) => {
    if (requiredPicker) {
      setPendingBallIntent(partial);
      return;
    }
    void submit(partial);
  };

  useEffect(() => {
    if (!pendingBallIntent || requiredPicker) return;
    const next = pendingBallIntent;
    setPendingBallIntent(null);
    void submit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBallIntent, requiredPicker]);
  const handleUndo = async () => {
    try {
      const removed = await session.undo();
      if (removed) setRedoStack((s) => [...s, removed]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to undo");
    }
  };
  const handleRedo = async () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((s) => s.slice(0, -1));
    try {
      await session.submitBall({
        runsOffBat: next.runs_off_bat ?? 0,
        extraType: (next.extra_type ?? null) as ExtraType | null,
        extraRuns: next.extra_runs ?? 0,
        dismissalType: (next.dismissal_type ?? null) as DismissalType | null,
        dismissedAthleteId: next.dismissed_athlete_id ?? null,
        dismissedName: next.dismissed_name ?? null,
        fielderAthleteId: next.fielder_athlete_id ?? null,
        fielderName: next.fielder_name ?? null,
        comment: next.comment ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to redo");
      setRedoStack((s) => [...s, next]);
    }
  };

  const onRun = (r: 0 | 1 | 2 | 3 | 4 | 5 | 6) => requestSubmit(ballHelpers.run(r));

  const onExtraRuns = (runs: number) => {
    if (!extraKind) return;
    const kind = extraKind;
    setExtraKind(null);
    if (kind === "Wide") requestSubmit(ballHelpers.wide(runs));
    else if (kind === "No Ball") requestSubmit(ballHelpers.noBall(Math.max(0, runs - 1)));
    else if (kind === "Bye") requestSubmit(ballHelpers.bye(runs));
    else if (kind === "Leg Bye") requestSubmit(ballHelpers.legBye(runs));
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

  const finalizeMatch = () => {
    setFinalizeDialogOpen(true);
  };

  // Innings rows for result detection
  const inningsRowsQ = useQuery({
    enabled: !!session.match,
    queryKey: ["mc-innings-rows", session.match?.id],
    queryFn: async () => {
      if (!session.match) return [] as InningsRow[];
      const { data } = await supabase
        .from("mc_innings")
        .select(
          "id, innings_number, batting_team_id, bowling_team_id, runs, wickets, balls, overs, target, status",
        )
        .eq("match_id", session.match.id)
        .order("innings_number");
      return (data ?? []) as InningsRow[];
    },
    refetchInterval: 15000,
  });

  const detectedResult: MatchResult = useMemo(
    () =>
      detectMatchResult(inningsRowsQ.data ?? [], {
        teamAId: session.match?.team_a_id ?? "",
        teamBId: session.match?.team_b_id ?? "",
        matchStatus: session.match?.status,
      }),
    [inningsRowsQ.data, session.match?.team_a_id, session.match?.team_b_id, session.match?.status],
  );

  const matchLocked = Boolean(
    (session.match as { match_locked?: boolean } | null)?.match_locked,
  );

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
      if (ev.key >= "0" && ev.key <= "6") {
        onRun(Number(ev.key) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      } else if (ev.key.toLowerCase() === "w") setDismissOpen(true);
      else if (ev.key.toLowerCase() === "u") void session.undo();
      else if (ev.key.toLowerCase() === "d") setExtraKind("Wide");
      else if (ev.key.toLowerCase() === "n") setExtraKind("No Ball");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRun, session.undo]);

  /* ---------- render ---------- */
  const navigate = useNavigate();
  const teamAShort =
    teamMap.get(session.match?.team_a_id ?? "")?.short_name ??
    teamMap.get(session.match?.team_a_id ?? "")?.name?.slice(0, 3).toUpperCase() ??
    "A";
  const teamBShort =
    teamMap.get(session.match?.team_b_id ?? "")?.short_name ??
    teamMap.get(session.match?.team_b_id ?? "")?.name?.slice(0, 3).toUpperCase() ??
    "B";
  const matchTitle = `${teamAShort} vs ${teamBShort}`;
  const tournamentLabel = [
    session.match?.match_format,
    session.match?.match_type,
    session.activeInnings ? `Innings ${session.activeInnings.innings_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const chase =
    session.activeInnings?.target != null && stats.team.requiredRuns != null
      ? {
          runsNeeded: stats.team.requiredRuns,
          ballsLeft: stats.team.ballsRemaining ?? 0,
        }
      : null;
  const bowledBowlerIds: string[] = Array.from(stats.bowling.byKey.values())
    .filter((b) => (b.legalBalls > 0 || b.wides > 0 || b.noBalls > 0) && b.player.athleteId)
    .map((b) => b.player.athleteId as string);



  return (
    <div className="scorer-root fixed inset-0 z-40 flex flex-col overflow-hidden bg-background text-foreground">
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
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm space-y-3">
            <div className="text-base font-semibold">Unable to load match</div>
            <p className="text-xs text-muted-foreground">
              We couldn't reach the match data. Check your connection and try again.
            </p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void session.reload()}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/match-center/matches">Back to matches</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : noInnings ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-base font-semibold">Ready to start?</div>
          <p className="max-w-xs text-xs text-muted-foreground">
            No innings has been created for this match yet.
          </p>
          <Button onClick={startFirstInnings}>Start innings 1</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void navigate({ to: "/match-center/live" })}
          >
            Back
          </Button>
        </div>
      ) : (
        <MobileScorer
          onExit={() => void navigate({ to: "/match-center/live" })}
          matchTitle={matchTitle}
          tournamentLabel={tournamentLabel || undefined}
          isLive={!!session.activeInnings && !session.match?.match_locked}
          score={`${stats.team.runs}/${stats.team.wickets}`}
          overs={stats.team.oversDisplay}
          crr={String(stats.team.runRate)}
          rrr={stats.team.requiredRunRate != null ? String(stats.team.requiredRunRate) : undefined}
          target={
            session.activeInnings?.target != null
              ? String(session.activeInnings.target)
              : undefined
          }
          chase={chase}
          striker={strikerStat}
          nonStriker={nonStrikerStat}
          bowler={bowlerStat}
          partnership={
            stats.team.currentPartnership
              ? {
                  runs: stats.team.currentPartnership.runs,
                  balls: stats.team.currentPartnership.balls,
                }
              : null
          }
          overBalls={session.currentOver.events.map(ballChipLabel)}
          currentOverLabel={currentOverLabel}
          insights={{
            partnership: stats.team.currentPartnership
              ? `${stats.team.currentPartnership.runs}(${stats.team.currentPartnership.balls})`
              : "0(0)",
            projected:
              session.match?.overs && stats.team.legalBalls > 0
                ? String(Math.round(stats.team.runRate * session.match.overs))
                : "–",
            lastWicket: stats.team.fallOfWickets.at(-1)
              ? `${stats.team.fallOfWickets.at(-1)?.score}/${stats.team.fallOfWickets.at(-1)?.wicketNumber}`
              : "–",
            extras: String(stats.team.extras.total),
            recentOvers: stats.team.overs_summary.slice(-3).map((over) => ({
              label: `${over.overNumber + 1}`,
              runs: over.runs,
              wickets: over.wickets,
            })),
          }}
          onRun={onRun}
          onExtra={(k) => setExtraKind(k)}
          onOut={() => setDismissOpen(true)}
          onOpenStrikerPicker={() => setPickStrikerOpen(true)}
          onOpenNonStrikerPicker={() => setPickNonStrikerOpen(true)}
          onOpenBowlerPicker={() => setPickBowlerOpen(true)}
          onUndo={() => void handleUndo()}
          onRedo={() => void handleRedo()}
          canRedo={redoStack.length > 0}
          onSwapStrike={() => {
            const s = { ...session.striker };
            session.setStriker({ ...session.nonStriker, onStrike: true });
            session.setNonStriker({ ...s, onStrike: false });
          }}
          onRetiredHurt={() => void finalizeWicket("retired_hurt")}
          onFinishInnings={
            session.activeInnings?.innings_number === 1 ? startSecondInnings : undefined
          }
          showFinishInnings={session.activeInnings?.innings_number === 1}
          onEndMatch={finalizeMatch}
          onOpenScorecard={() => setScorecardOpen(true)}
          scorecardContent={
            <LiveScorecard
              hideHero
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
          }
          onShareMatch={!isDemo ? () => setShareOpen(true) : undefined}
          onOpenScorebook={
            !isDemo
              ? () =>
                  void navigate({
                    to: "/match-center/scorebook/$matchId",
                    params: { matchId },
                  })
              : undefined
          }
          battingOptions={battingOptions}
          bowlingOptions={bowlingOptions}
          onPickPlayer={(role, p) => setPlayer(role, p)}
          requiredPicker={requiredPicker}
          awaitingNewBatter={session.matchState.innings.awaitingNewBatter}
          awaitingNewBatterRole={incomingBatterRole ?? "striker"}
          awaitingNewBowler={session.matchState.innings.awaitingNewBowler}
          previousBowlerId={previousOverBowler?.bowlerAthleteId ?? null}
          previousBowlerName={previousOverBowler?.bowlerName ?? null}
          bowledBowlerIds={bowledBowlerIds}
          dismissedBatterIds={Array.from(session.matchState.innings.dismissedIds)}
          dismissedBatterNames={Array.from(session.matchState.innings.dismissedNames)}

        />

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

      {/* Scorecard sheet */}
      <Sheet open={scorecardOpen} onOpenChange={setScorecardOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col rounded-t-[28px] border-t-0 p-0 pb-[env(safe-area-inset-bottom)] shadow-2xl"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="shrink-0 space-y-0.5 px-5 pt-3 pb-2 text-left">
            <SheetTitle className="text-[22px] font-black tracking-tight">Scorecard</SheetTitle>
            <SheetDescription className="text-[12px]">
              Live totals derived from every ball.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-4">
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
          </div>
        </SheetContent>
      </Sheet>

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

      {session.match && (
        <>
          <FinalizationDialog
            open={finalizeDialogOpen}
            onOpenChange={setFinalizeDialogOpen}
            matchId={session.match.id}
            tenantId={session.match.tenant_id}
            actorId={userQ.data?.id ?? null}
            role="admin"
            teamA={{ id: session.match.team_a_id, name: homeName }}
            teamB={{ id: session.match.team_b_id, name: awayName }}
            detectedResult={detectedResult}
            ballEvents={session.events}
            onFinalized={() => {
              setMatchCompleteOpen(false);
              setInningsCompleteOpen(false);
              // refresh handled by realtime
            }}
          />
          <UnlockMatchDialog
            open={unlockDialogOpen}
            onOpenChange={setUnlockDialogOpen}
            matchId={session.match.id}
            tenantId={session.match.tenant_id}
            actorId={userQ.data?.id ?? null}
            role="owner"
            onUnlocked={() => { /* refresh handled by realtime */ }}
          />
          <ShareMatchDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            matchId={session.match.id}
            academyId={session.match.tenant_id}
          />
        </>
      )}

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

/* =========================================================================
 * Demo Scorer View — fully interactive scorer backed by the local DemoStore.
 * Reuses MatchHeader, LiveScorecard, CommentaryPanel and every scoring UI
 * primitive. Never queries Supabase. All ball events flow through the same
 * rules engine and statistics engine as production.
 * =======================================================================*/

import { findDemoDatasetByMatchId } from "@/lib/mc-demo/store";
import { useDemoScoringSession, finalizeDemoMatch } from "@/hooks/use-demo-scoring-session";
import type { MatchWithTeams } from "@/lib/mc-matches";

function DemoScorerView({ matchId }: { matchId: string }) {
  const dataset = findDemoDatasetByMatchId(matchId);
  const session = useDemoScoringSession(matchId);

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
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inningsCompleteOpen, setInningsCompleteOpen] = useState(false);
  const [matchCompleteOpen, setMatchCompleteOpen] = useState(false);
  const [commentaryCollapsed, setCommentaryCollapsed] = useState(false);
  const [pendingBallIntent, setPendingBallIntent] = useState<Parameters<typeof session.submitBall>[0] | null>(null);

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

  /* Batter/bowler setup is handled from the mobile scorer rows and bottom sheets. */

  if (!dataset || !session.match) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-lg font-semibold">Demo match unavailable</div>
          <p className="text-sm text-muted-foreground">
            The demo fixtures aren't loaded on this device. Turn on Demo Mode
            from Match Center → Settings, then reopen this match.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/match-center/matches">Back to matches</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/match-center">Match Center</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const match = session.match;
  const activeInnings = session.activeInnings;
  const demo = dataset.data;

  /* ---------- player option lists ---------- */
  const battingOptions: PlayerOption[] = session.battingSquad.map((p) => ({
    id: p.athlete_profile_id ?? `ext:${p.id}`,
    name:
      demo.players.find((pl) => pl.id === p.athlete_profile_id)?.student?.name ??
      p.external_player_name ??
      "Player",
    role: p.role ?? undefined,
  }));
  const bowlingOptions: PlayerOption[] = session.bowlingSquad.map((p) => ({
    id: p.athlete_profile_id ?? `ext:${p.id}`,
    name:
      demo.players.find((pl) => pl.id === p.athlete_profile_id)?.student?.name ??
      p.external_player_name ??
      "Player",
    role: p.role ?? undefined,
  }));

  const setPlayer = (
    slot: "striker" | "nonStriker" | "bowler",
    opt: PlayerOption,
  ) => {
    const payload = { athleteId: opt.id.startsWith("ext:") ? null : opt.id, name: opt.name };
    if (slot === "striker") session.setStriker({ ...payload, onStrike: true });
    else if (slot === "nonStriker") session.setNonStriker({ ...payload, onStrike: false });
    else session.setBowler(payload);
  };

  /* ---------- stats & headers ---------- */
  const stats = calculateInningsStatistics(session.events, {
    totalOvers: match.overs ?? null,
    target: activeInnings?.target ?? null,
  });
  const striker = session.striker;
  const nonStriker = session.nonStriker;
  const bowlerRef = session.bowler;

  const strikerKey = striker.athleteId
    ? `id:${striker.athleteId}`
    : striker.name ? `name:${striker.name.toLowerCase()}` : null;
  const nonStrikerKey = nonStriker.athleteId
    ? `id:${nonStriker.athleteId}`
    : nonStriker.name ? `name:${nonStriker.name.toLowerCase()}` : null;
  const bowlerKey = bowlerRef.athleteId
    ? `id:${bowlerRef.athleteId}`
    : bowlerRef.name ? `name:${bowlerRef.name.toLowerCase()}` : null;

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
          order: s?.battingPosition,
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
          fours: s?.fours ?? 0,
          sixes: s?.sixes ?? 0,
          strikeRate: s ? String(s.strikeRate) : "0.0",
          order: s?.battingPosition,
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

  const currentOverLabel = (() => {
    if (!session.currentOver.events.length || session.currentOver.ballsBowled >= 6) {
      return stats.team.oversDisplay;
    }
    return `${session.currentOver.overNumber}.${session.currentOver.ballsBowled}`;
  })();

  const previousOverBowler = session.matchState.innings.completedOvers.at(-1);
  const strikerSelected = Boolean(striker.athleteId || striker.name);
  const nonStrikerSelected = Boolean(nonStriker.athleteId || nonStriker.name);
  const bowlerSelected = Boolean(bowlerRef.athleteId || bowlerRef.name);
  const strikerDismissed = Boolean(
    (striker.athleteId && session.matchState.innings.dismissedIds.has(striker.athleteId)) ||
      (striker.name && session.matchState.innings.dismissedNames.has(striker.name)),
  );
  const nonStrikerDismissed = Boolean(
    (nonStriker.athleteId && session.matchState.innings.dismissedIds.has(nonStriker.athleteId)) ||
      (nonStriker.name && session.matchState.innings.dismissedNames.has(nonStriker.name)),
  );
  const incomingBatterRole = !strikerSelected || strikerDismissed
    ? "striker"
    : !nonStrikerSelected || nonStrikerDismissed
      ? "nonStriker"
      : null;
  const sameAsPreviousBowler = Boolean(
    previousOverBowler &&
      ((bowlerRef.athleteId &&
        previousOverBowler.bowlerAthleteId &&
        bowlerRef.athleteId === previousOverBowler.bowlerAthleteId) ||
        (bowlerRef.name &&
          previousOverBowler.bowlerName &&
          bowlerRef.name === previousOverBowler.bowlerName)),
  );
  const newBowlerStillNeeded = Boolean(
    session.matchState.innings.awaitingNewBowler && (!bowlerSelected || sameAsPreviousBowler),
  );
  const requiredPicker = session.matchState.inningsShouldEnd
    ? null
    : incomingBatterRole
      ? incomingBatterRole
      : !strikerSelected
        ? "striker"
        : !nonStrikerSelected
          ? "nonStriker"
          : newBowlerStillNeeded || !bowlerSelected
            ? "bowler"
            : null;

  const matchWithTeams = (demo.matches.find((m) => m.id === matchId) ?? match) as MatchWithTeams;
  const teamA = matchWithTeams.team_a;
  const teamB = matchWithTeams.team_b;
  const battingTeamId = activeInnings?.batting_team_id ?? teamA?.id ?? "";
  const homeName = battingTeamId === teamA?.id ? teamA?.name ?? "Home" : teamB?.name ?? "Home";
  const awayName = battingTeamId === teamA?.id ? teamB?.name ?? "Away" : teamA?.name ?? "Away";

  // commentary intentionally omitted from compact mobile UI — available via scorecard.

  /* ---------- ball submission ---------- */
  const [redoStack, setRedoStack] = useState<
    Awaited<ReturnType<typeof session.undo>>[]
  >([]);
  const submit = async (partial: Parameters<typeof session.submitBall>[0]) => {
    try {
      await session.submitBall(partial);
      setRedoStack([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record ball");
    }
  };
  const requestSubmit = (partial: Parameters<typeof session.submitBall>[0]) => {
    if (requiredPicker) {
      setPendingBallIntent(partial);
      return;
    }
    void submit(partial);
  };

  useEffect(() => {
    if (!pendingBallIntent || requiredPicker) return;
    const next = pendingBallIntent;
    setPendingBallIntent(null);
    void submit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBallIntent, requiredPicker]);
  const handleUndo = async () => {
    try {
      const removed = await session.undo();
      if (removed) setRedoStack((s) => [...s, removed]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to undo");
    }
  };
  const handleRedo = async () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((s) => s.slice(0, -1));
    try {
      await session.submitBall({
        runsOffBat: next.runs_off_bat ?? 0,
        extraType: (next.extra_type ?? null) as ExtraType | null,
        extraRuns: next.extra_runs ?? 0,
        dismissalType: (next.dismissal_type ?? null) as DismissalType | null,
        dismissedAthleteId: next.dismissed_athlete_id ?? null,
        dismissedName: next.dismissed_name ?? null,
        fielderAthleteId: next.fielder_athlete_id ?? null,
        fielderName: next.fielder_name ?? null,
        comment: next.comment ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to redo");
      setRedoStack((s) => [...s, next]);
    }
  };
  const onRun = (r: 0 | 1 | 2 | 3 | 4 | 5 | 6) => requestSubmit(ballHelpers.run(r));
  const onExtraRuns = (runs: number) => {
    if (!extraKind) return;
    const kind = extraKind;
    setExtraKind(null);
    if (kind === "Wide") requestSubmit(ballHelpers.wide(runs));
    else if (kind === "No Ball") requestSubmit(ballHelpers.noBall(Math.max(0, runs - 1)));
    else if (kind === "Bye") requestSubmit(ballHelpers.bye(runs));
    else if (kind === "Leg Bye") requestSubmit(ballHelpers.legBye(runs));
  };
  const finalizeWicket = async (
    kind: DismissalType,
    opts?: { fielder?: PlayerOption | null; dismissed?: "striker" | "non-striker" },
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
  };
  const handleDismissal = (kind: DismissalKind) => {
    setDismissOpen(false);
    if (kind === "Caught") setCaughtOpen(true);
    else if (kind === "Run Out") setRunOutOpen(true);
    else void finalizeWicket(DISMISSAL_MAP[kind]);
  };

  const startSecondInnings = async () => {
    if (!match || !activeInnings) return;
    const target = session.matchState.innings.runs + 1;
    try {
      await session.startInnings({
        inningsNumber: 2,
        battingTeamId: activeInnings.bowling_team_id,
        bowlingTeamId: activeInnings.batting_team_id,
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

  const resultLine = (() => {
    const ms = session.matchState;
    if (ms.inningsShouldEnd === "target_achieved" && session.matchState.innings) {
      const wicketsLeft = 10 - ms.innings.wickets;
      return `${homeName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
    }
    if (ms.inningsShouldEnd === "all_out" || ms.inningsShouldEnd === "overs_finished") {
      if (activeInnings?.target != null) {
        const diff = activeInnings.target - 1 - ms.innings.runs;
        if (diff > 0) return `${awayName} won by ${diff} run${diff === 1 ? "" : "s"}`;
        if (diff === 0) return "Match tied";
      }
      return "Innings complete";
    }
    return null;
  })();

  const finalizeMatch = () => {
    if (!session.tenantId) return;
    // Winner from result / matchState
    let winnerTeamId: string | null = null;
    const ms = session.matchState;
    if (ms.inningsShouldEnd === "target_achieved") {
      winnerTeamId = activeInnings?.batting_team_id ?? null;
    } else if (activeInnings?.target != null) {
      const diff = activeInnings.target - 1 - ms.innings.runs;
      winnerTeamId = diff > 0 ? activeInnings.bowling_team_id : null;
    }
    const topBat = stats.summary.highestScorer?.player;
    const pomId = topBat?.athleteId ?? null;
    finalizeDemoMatch(session.tenantId, matchId, {
      winnerTeamId,
      result: resultLine ?? "Match complete",
      pomAthleteId: pomId,
    });
    setMatchCompleteOpen(false);
    setInningsCompleteOpen(false);
    toast.success("Demo match finalized");
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(ev.target.tagName))
        return;
      if (ev.key >= "0" && ev.key <= "6") {
        onRun(Number(ev.key) as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      } else if (ev.key.toLowerCase() === "w") setDismissOpen(true);
      else if (ev.key.toLowerCase() === "u") void session.undo();
      else if (ev.key.toLowerCase() === "d") setExtraKind("Wide");
      else if (ev.key.toLowerCase() === "n") setExtraKind("No Ball");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRun, session.undo]);

  const isLive = !match.match_locked && (activeInnings?.status as string) === "in_progress";

  const navigate = useNavigate();
  const teamAShort = teamA?.short_name ?? teamA?.name?.slice(0, 3).toUpperCase() ?? "A";
  const teamBShort = teamB?.short_name ?? teamB?.name?.slice(0, 3).toUpperCase() ?? "B";
  const matchTitle = `${teamAShort} vs ${teamBShort} · Demo`;
  const tournamentLabel = [
    match.match_format,
    match.match_type,
    activeInnings ? `Innings ${activeInnings.innings_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const chase =
    activeInnings?.target != null && stats.team.requiredRuns != null
      ? { runsNeeded: stats.team.requiredRuns, ballsLeft: stats.team.ballsRemaining ?? 0 }
      : null;
  const bowledBowlerIds: string[] = Array.from(stats.bowling.byKey.values())
    .filter((b) => (b.legalBalls > 0 || b.wides > 0 || b.noBalls > 0) && b.player.athleteId)
    .map((b) => b.player.athleteId as string);


  return (
    <div className="scorer-root fixed inset-0 z-40 flex flex-col overflow-hidden bg-background text-foreground">
      {match.match_locked ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
            <LiveScorecard
              events={session.events}
              innings={activeInnings}
              totalOvers={match.overs ?? null}
              matchInfo={{
                ground: match.ground_name,
                tournament: match.match_type,
                date: match.scheduled_date,
                format: match.match_format,
                homeTeam: homeName,
                awayTeam: awayName,
                result: match.result,
              }}
            />
          </div>
        </div>
      ) : (
        <MobileScorer
          onExit={() => void navigate({ to: "/match-center/live" })}
          matchTitle={matchTitle}
          tournamentLabel={tournamentLabel || undefined}
          isLive={isLive}
          score={`${stats.team.runs}/${stats.team.wickets}`}
          overs={stats.team.oversDisplay}
          crr={String(stats.team.runRate)}
          rrr={stats.team.requiredRunRate != null ? String(stats.team.requiredRunRate) : undefined}
          target={activeInnings?.target != null ? String(activeInnings.target) : undefined}
          chase={chase}
          striker={strikerStat}
          nonStriker={nonStrikerStat}
          bowler={bowlerStat}
          partnership={
            stats.team.currentPartnership
              ? {
                  runs: stats.team.currentPartnership.runs,
                  balls: stats.team.currentPartnership.balls,
                }
              : null
          }
          overBalls={session.currentOver.events.map(ballChipLabel)}
          currentOverLabel={currentOverLabel}
          insights={{
            partnership: stats.team.currentPartnership
              ? `${stats.team.currentPartnership.runs}(${stats.team.currentPartnership.balls})`
              : "0(0)",
            projected:
              match.overs && stats.team.legalBalls > 0
                ? String(Math.round(stats.team.runRate * match.overs))
                : "–",
            lastWicket: stats.team.fallOfWickets.at(-1)
              ? `${stats.team.fallOfWickets.at(-1)?.score}/${stats.team.fallOfWickets.at(-1)?.wicketNumber}`
              : "–",
            extras: String(stats.team.extras.total),
            recentOvers: stats.team.overs_summary.slice(-3).map((over) => ({
              label: `${over.overNumber + 1}`,
              runs: over.runs,
              wickets: over.wickets,
            })),
          }}
          onRun={onRun}
          onExtra={(k) => setExtraKind(k)}
          onOut={() => setDismissOpen(true)}
          onOpenStrikerPicker={() => setPickStrikerOpen(true)}
          onOpenNonStrikerPicker={() => setPickNonStrikerOpen(true)}
          onOpenBowlerPicker={() => setPickBowlerOpen(true)}
          onUndo={() => void handleUndo()}
          onRedo={() => void handleRedo()}
          canRedo={redoStack.length > 0}
          onSwapStrike={() => {
            const s = { ...session.striker };
            session.setStriker({ ...session.nonStriker, onStrike: true });
            session.setNonStriker({ ...s, onStrike: false });
          }}
          onRetiredHurt={() => void finalizeWicket("retired_hurt")}
          onFinishInnings={
            activeInnings?.innings_number === 1 ? startSecondInnings : undefined
          }
          showFinishInnings={activeInnings?.innings_number === 1}
          onEndMatch={finalizeMatch}
          onOpenScorecard={() => setScorecardOpen(true)}
          scorecardContent={
            <LiveScorecard
              hideHero
              events={session.events}
              innings={activeInnings}
              totalOvers={match.overs ?? null}
              matchInfo={{
                ground: match.ground_name,
                tournament: match.match_type,
                date: match.scheduled_date,
                format: match.match_format,
                homeTeam: homeName,
                awayTeam: awayName,
                result: match.result,
              }}
            />
          }
          onShareMatch={() => setShareOpen(true)}
          battingOptions={battingOptions}
          bowlingOptions={bowlingOptions}
          onPickPlayer={(role, p) => setPlayer(role, p)}
          requiredPicker={requiredPicker}
          awaitingNewBatter={session.matchState.innings.awaitingNewBatter}
          awaitingNewBatterRole={incomingBatterRole ?? "striker"}
          awaitingNewBowler={session.matchState.innings.awaitingNewBowler}
          previousBowlerId={previousOverBowler?.bowlerAthleteId ?? null}
          previousBowlerName={previousOverBowler?.bowlerName ?? null}
          bowledBowlerIds={bowledBowlerIds}
        />

      )}


      {/* ---------- modals ---------- */}
      <DismissalModal open={dismissOpen} onOpenChange={setDismissOpen} onSelect={handleDismissal} />
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

      {/* Scorecard sheet */}
      <Sheet open={scorecardOpen} onOpenChange={setScorecardOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col rounded-t-[28px] border-t-0 p-0 pb-[env(safe-area-inset-bottom)] shadow-2xl"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="shrink-0 space-y-0.5 px-5 pt-3 pb-2 text-left">
            <SheetTitle className="text-[22px] font-black tracking-tight">Scorecard</SheetTitle>
            <SheetDescription className="text-[12px]">Demo match · derived from ball events.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-4">
            <LiveScorecard
              events={session.events}
              innings={activeInnings}
              totalOvers={match.overs ?? null}
              matchInfo={{
                homeTeam: homeName,
                awayTeam: awayName,
                format: match.match_format ?? null,
                ground: match.ground_name ?? null,
                tournament: match.match_type ?? null,
                date: match.scheduled_date ?? null,
                result: resultLine,
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

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
            <Button variant="outline" onClick={() => setScorecardOpen(true)}>Review</Button>
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
            <DialogDescription>{resultLine ?? "Match ended."}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Final score</div>
            <div className="mt-1 text-3xl font-black tabular-nums">
              {stats.team.runs}/{stats.team.wickets}
            </div>
            <div className="text-xs text-muted-foreground">{stats.team.oversDisplay} overs</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScorecardOpen(true)}>View scorecard</Button>
            <Button onClick={finalizeMatch}>Finalize</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
