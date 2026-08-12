import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  appendBallEvent,
  BallEventError,
  createInnings,
  isLegalDelivery,
  listBallEvents,
  listInningsForMatch,
  nextPosition,
  undoLastBallEvent,
  type AppendBallInput,
  type CreateInningsInput,
  type ExtraType,
  type MCBallEvent,
  type MCInnings,
  deleteBallEvent,
  updateBallEvent,
  type UpdateBallInput,
} from "@/lib/mc-ball-events";
import {
  applyStrikeAfterBall,
  replayInnings,
  validateBallDraft,
  type MatchState,
} from "@/lib/mc-rules-engine";

export interface PersistentSelection {
  striker_athlete_id: string | null;
  striker_name: string | null;
  non_striker_athlete_id: string | null;
  non_striker_name: string | null;
  bowler_athlete_id: string | null;
  bowler_name: string | null;
}

type MCMatch = Database["public"]["Tables"]["mc_matches"]["Row"];
type MCMatchSquad = Database["public"]["Tables"]["mc_match_squads"]["Row"];

export interface CurrentBatterState {
  athleteId: string | null;
  name: string | null;
  onStrike: boolean;
}

export interface CurrentBowlerState {
  athleteId: string | null;
  name: string | null;
}

export interface CurrentOverState {
  overNumber: number;
  ballsBowled: number;
  events: MCBallEvent[];
}

export interface ScoringSession {
  loading: boolean;
  error: string | null;
  match: MCMatch | null;
  innings: MCInnings[];
  activeInnings: MCInnings | null;
  events: MCBallEvent[];
  playingXI: MCMatchSquad[];
  battingSquad: MCMatchSquad[];
  bowlingSquad: MCMatchSquad[];
  striker: CurrentBatterState;
  nonStriker: CurrentBatterState;
  bowler: CurrentBowlerState;
  currentOver: CurrentOverState;
  matchState: MatchState;
  setStriker: (b: CurrentBatterState) => void;
  setNonStriker: (b: CurrentBatterState) => void;
  setBowler: (b: CurrentBowlerState) => void;
  startInnings: (input: Omit<CreateInningsInput, "tenantId" | "matchId">) => Promise<MCInnings>;
  submitBall: (
    input: Omit<
      AppendBallInput,
      | "eventId"
      | "tenantId"
      | "matchId"
      | "inningsId"
      | "priorEvents"
      | "strikerAthleteId"
      | "strikerName"
      | "nonStrikerAthleteId"
      | "nonStrikerName"
      | "bowlerAthleteId"
      | "bowlerName"
    >,
  ) => Promise<MCBallEvent>;
  undo: () => Promise<MCBallEvent | null>;
  deleteBall: (eventId: string) => Promise<void>;
  updateBall: (input: UpdateBallInput) => Promise<void>;
  reload: () => Promise<void>;
}

function pickActiveInnings(list: MCInnings[]): MCInnings | null {
  const inProgress = list.find((i) => i.status === "in_progress");
  if (inProgress) return inProgress;
  return list[list.length - 1] ?? null;
}

function buildCurrentOver(events: MCBallEvent[]): CurrentOverState {
  if (events.length === 0) {
    return { overNumber: 0, ballsBowled: 0, events: [] };
  }
  const lastOver = events[events.length - 1].over_number;
  const overEvents = events.filter((e) => e.over_number === lastOver);
  const legal = overEvents.filter((e) => isLegalDelivery(e.extra_type as ExtraType | null)).length;
  return { overNumber: lastOver, ballsBowled: legal, events: overEvents };
}

function countCompletedLegalDeliveries(events: MCBallEvent[]) {
  return events.filter((e) => isLegalDelivery(e.extra_type as ExtraType | null)).length;
}

function samePlayerRef(
  a: { athleteId?: string | null; name?: string | null },
  b: { athleteId?: string | null; name?: string | null },
) {
  return (
    Boolean(a.athleteId && b.athleteId && a.athleteId === b.athleteId) ||
    Boolean(!a.athleteId && !b.athleteId && a.name && b.name && a.name === b.name)
  );
}

function matchStateForSelectedBatters(
  state: MatchState,
  striker: CurrentBatterState,
  nonStriker: CurrentBatterState,
): MatchState {
  if (!state.innings.awaitingNewBatter) return state;
  const strikerReady =
    Boolean(striker.athleteId || striker.name) &&
    !(striker.athleteId && state.innings.dismissedIds.has(striker.athleteId)) &&
    !(striker.name && state.innings.dismissedNames.has(striker.name));
  const nonStrikerReady =
    Boolean(nonStriker.athleteId || nonStriker.name) &&
    !(nonStriker.athleteId && state.innings.dismissedIds.has(nonStriker.athleteId)) &&
    !(nonStriker.name && state.innings.dismissedNames.has(nonStriker.name));
  if (!strikerReady || !nonStrikerReady || samePlayerRef(striker, nonStriker)) return state;
  return {
    ...state,
    innings: {
      ...state.innings,
      awaitingNewBatter: false,
    },
  };
}

function makeClientEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
  );
}

export function useScoringSession(
  matchId: string | undefined,
  opts: { tenantId?: string; userId?: string | null } = {},
): ScoringSession {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MCMatch | null>(null);
  const [innings, setInnings] = useState<MCInnings[]>([]);
  const [events, setEvents] = useState<MCBallEvent[]>([]);
  const [playingXI, setPlayingXI] = useState<MCMatchSquad[]>([]);

  const [striker, setStrikerState] = useState<CurrentBatterState>({
    athleteId: null,
    name: null,
    onStrike: true,
  });
  const [nonStriker, setNonStrikerState] = useState<CurrentBatterState>({
    athleteId: null,
    name: null,
    onStrike: false,
  });
  const [bowler, setBowlerState] = useState<CurrentBowlerState>({
    athleteId: null,
    name: null,
  });

  const activeInnings = useMemo(() => pickActiveInnings(innings), [innings]);
  const eventsRef = useRef<MCBallEvent[]>([]);
  const strikerRef = useRef<CurrentBatterState>(striker);
  const nonStrikerRef = useRef<CurrentBatterState>(nonStriker);
  const bowlerRef = useRef<CurrentBowlerState>(bowler);
  
  const netQueueRef = useRef<Promise<void>>(Promise.resolve());
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const persistSelection = useCallback(
    async (s: CurrentBatterState, ns: CurrentBatterState, b: CurrentBowlerState) => {
      if (!matchId || !activeInnings || !opts.tenantId) return;
      try {
        await supabase.from("mc_match_draft_selections" as any).upsert({
          tenant_id: opts.tenantId,
          match_id: matchId,
          innings_id: activeInnings.id,
          striker_athlete_id: s.athleteId,
          striker_name: s.name,
          non_striker_athlete_id: ns.athleteId,
          non_striker_name: ns.name,
          bowler_athlete_id: b.athleteId,
          bowler_name: b.name,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'innings_id' });
      } catch (err) {
        console.warn("[scoring] Selection persistence failed", err);
      }
    },
    [matchId, activeInnings, opts.tenantId],
  );

  const setStriker = useCallback((b: CurrentBatterState) => {
    strikerRef.current = b;
    setStrikerState(b);
    void persistSelection(b, nonStrikerRef.current, bowlerRef.current);
  }, [persistSelection]);

  const setNonStriker = useCallback((b: CurrentBatterState) => {
    nonStrikerRef.current = b;
    setNonStrikerState(b);
    void persistSelection(strikerRef.current, b, bowlerRef.current);
  }, [persistSelection]);

  const setBowler = useCallback((b: CurrentBowlerState) => {
    bowlerRef.current = b;
    setBowlerState(b);
    void persistSelection(strikerRef.current, nonStrikerRef.current, b);
  }, [persistSelection]);

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: matchRow, error: matchErr }, inningsList, { data: squad }] = await Promise.all([
        supabase.from("mc_matches").select("*").eq("id", matchId).maybeSingle(),
        listInningsForMatch(matchId),
        supabase.from("mc_match_squads").select("*").eq("match_id", matchId),
      ]);
      if (matchErr) throw matchErr;
      setMatch(matchRow ?? null);
      setInnings(inningsList);
      setPlayingXI(squad ?? []);
      const active = pickActiveInnings(inningsList);
      if (active) {
        const evs = await listBallEvents(active.id);
        eventsRef.current = evs;
        setEvents(evs);
      } else {
        eventsRef.current = [];
        setEvents([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match.");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeInnings?.id) return;
    const channel = supabase
      .channel(`mc_ball_events:${activeInnings.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "mc_ball_events",
        filter: `innings_id=eq.${activeInnings.id}`,
      }, (payload) => {
        setEvents((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MCBallEvent;
            if (prev.some((e) => e.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => a.sequence_number - b.sequence_number);
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as MCBallEvent;
            return prev.filter((e) => e.id !== row.id);
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as MCBallEvent;
            return prev.map((e) => (e.id === row.id ? row : e));
          }
          return prev;
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeInnings?.id]);

  const battingSquad = useMemo(
    () => activeInnings ? playingXI.filter((p) => p.team_id === activeInnings.batting_team_id) : [],
    [playingXI, activeInnings],
  );
  const bowlingSquad = useMemo(
    () => activeInnings ? playingXI.filter((p) => p.team_id === activeInnings.bowling_team_id) : [],
    [playingXI, activeInnings],
  );

  const currentOver = useMemo(() => buildCurrentOver(events), [events]);

  const matchState = useMemo<MatchState>(
    () => replayInnings(events, {
      totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
      maxWickets: 10,
      target: activeInnings?.target ?? null,
    }),
    [events, match, activeInnings?.target],
  );

  const startInnings = useCallback(
    async (input: Omit<CreateInningsInput, "tenantId" | "matchId">) => {
      if (!matchId || !opts.tenantId) throw new Error("Missing ID");
      const created = await createInnings({ ...input, tenantId: opts.tenantId, matchId });
      setInnings((prev) => [...prev, created]);
      eventsRef.current = [];
      setEvents([]);
      return created;
    },
    [matchId, opts.tenantId],
  );

  const submitBall = useCallback<ScoringSession["submitBall"]>(
    async (partial) => {
      if (!matchId || !opts.tenantId || !activeInnings) throw new Error("Invalid state");
      
      const latestMatchState = replayInnings(eventsRef.current, {
        totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
        maxWickets: 10,
        target: activeInnings.target ?? null,
      });

      const currentStriker = strikerRef.current;
      const currentNonStriker = nonStrikerRef.current;
      const currentBowler = bowlerRef.current;

      validateBallDraft(
        {
          strikerAthleteId: currentStriker.athleteId,
          strikerName: currentStriker.name,
          nonStrikerAthleteId: currentNonStriker.athleteId,
          nonStrikerName: currentNonStriker.name,
          bowlerAthleteId: currentBowler.athleteId,
          bowlerName: currentBowler.name,
          ...partial,
        },
        matchStateForSelectedBatters(latestMatchState, currentStriker, currentNonStriker),
        {
          innings: activeInnings,
          events: eventsRef.current,
          matchStatus: match?.status ?? null,
          totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
        },
      );

      const pos = nextPosition(eventsRef.current);
      const optimistic: MCBallEvent = {
        id: makeClientEventId(),
        tenant_id: opts.tenantId,
        match_id: matchId,
        innings_id: activeInnings.id,
        sequence_number: pos.sequenceNumber,
        over_number: pos.overNumber,
        ball_number: pos.ballNumber,
        is_legal_delivery: isLegalDelivery(partial.extraType ?? null),
        striker_athlete_id: currentStriker.athleteId,
        striker_name: currentStriker.name,
        non_striker_athlete_id: currentNonStriker.athleteId,
        non_striker_name: currentNonStriker.name,
        bowler_athlete_id: currentBowler.athleteId,
        bowler_name: currentBowler.name,
        runs_off_bat: partial.runsOffBat ?? 0,
        extra_type: partial.extraType ?? null,
        extra_runs: partial.extraRuns ?? 0,
        dismissal_type: partial.dismissalType ?? null,
        dismissed_athlete_id: partial.dismissedAthleteId ?? null,
        dismissed_name: partial.dismissedName ?? null,
        fielder_athlete_id: partial.fielderAthleteId ?? null,
        fielder_name: partial.fielderName ?? null,
        comment: null,
        created_by: opts.userId ?? null,
        created_at: new Date().toISOString(),
      } as MCBallEvent;

      setEvents((prev) => [...prev, optimistic]);
      const result = await appendBallEvent({ 
        ...partial, 
        tenantId: opts.tenantId,
        matchId,
        inningsId: activeInnings.id,
        eventId: optimistic.id,
        strikerAthleteId: optimistic.striker_athlete_id,
        strikerName: optimistic.striker_name,
        nonStrikerAthleteId: optimistic.non_striker_athlete_id,
        nonStrikerName: optimistic.non_striker_name,
        bowlerAthleteId: optimistic.bowler_athlete_id,
        bowlerName: optimistic.bowler_name,
      });
      
      const newStriker = applyStrikeAfterBall({ striker: currentStriker, nonStriker: currentNonStriker }, result, optimistic.is_legal_delivery);
      setStriker({ ...newStriker.striker, onStrike: true });
      setNonStriker({ ...newStriker.nonStriker, onStrike: false });
      
      return result;
    },
    [matchId, opts.tenantId, opts.userId, activeInnings, match?.status, setStriker, setNonStriker],
  );

  const undo = useCallback(async () => {
    if (!activeInnings) return null;
    const last = await undoLastBallEvent(activeInnings.id);
    return last;
  }, [activeInnings]);

  const deleteBall = useCallback(async (eventId: string) => {
    if (!activeInnings?.id) return;
    await deleteBallEvent(eventId);
    toast.success("Ball deleted");
  }, [activeInnings?.id]);

  const updateBall = useCallback(async (input: UpdateBallInput) => {
    await updateBallEvent(input);
    toast.success("Ball updated");
  }, []);

  return {
    loading,
    error,
    match,
    innings,
    activeInnings,
    events,
    playingXI,
    battingSquad,
    bowlingSquad,
    striker,
    nonStriker,
    bowler,
    currentOver,
    matchState,
    setStriker,
    setNonStriker,
    setBowler,
    startInnings,
    submitBall,
    undo,
    deleteBall,
    updateBall,
    reload: load,
  };
}

export const ballHelpers = {
  run: (runs: 0 | 1 | 2 | 3 | 4 | 5 | 6) => ({ runsOffBat: runs, extraType: null, extraRuns: 0 }),
  wide: (runs: number = 1) => ({ runsOffBat: 0, extraType: "wide" as const, extraRuns: runs }),
  noBall: (batRuns: number = 0, byes: number = 0) => ({ runsOffBat: batRuns, extraType: "no_ball" as const, extraRuns: byes }),
  bye: (runs: number) => ({ runsOffBat: 0, extraType: "bye" as const, extraRuns: runs }),
  legBye: (runs: number) => ({ runsOffBat: 0, extraType: "leg_bye" as const, extraRuns: runs }),
  wicket: (kind: AppendBallInput["dismissalType"], extras?: any) => ({
    runsOffBat: 0,
    extraType: null,
    extraRuns: 0,
    dismissalType: kind ?? null,
    ...extras,
  }),
};
