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
  type DismissalType,
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
  redo: () => Promise<MCBallEvent | null>;
  deleteBall: (eventId: string) => Promise<void>;
  updateBall: (input: UpdateBallInput) => Promise<void>;
  updateBallBowler: (eventId: string, opt: { athleteId: string | null; name: string }) => Promise<void>;
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
  const activeInningsRef = useRef<MCInnings | null>(null);
  
  useEffect(() => {
    activeInningsRef.current = activeInnings;
  }, [activeInnings]);

  const eventsRef = useRef<MCBallEvent[]>([]);
  const strikerRef = useRef<CurrentBatterState>(striker);
  const nonStrikerRef = useRef<CurrentBatterState>(nonStriker);
  const bowlerRef = useRef<CurrentBowlerState>(bowler);
  
  const redoStackRef = useRef<MCBallEvent[]>([]);
  
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const persistSelection = useCallback(
    async (s: CurrentBatterState, ns: CurrentBatterState, b: CurrentBowlerState) => {
      const active = activeInningsRef.current;
      if (!matchId || !active || !opts.tenantId) return;
      try {
        await supabase.from("mc_match_draft_selections" as any).upsert({
          tenant_id: opts.tenantId,
          match_id: matchId,
          innings_id: active.id,
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
    [matchId, opts.tenantId],
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
        const [evs, draftRes] = await Promise.all([
          listBallEvents(active.id),
          supabase.from("mc_match_draft_selections" as any).select("*").eq("innings_id", active.id).maybeSingle()
        ]);
        
        eventsRef.current = evs;
        setEvents(evs);

        const draft = draftRes.data as any;
        if (draft) {
          const s = { athleteId: draft.striker_athlete_id, name: draft.striker_name, onStrike: true };
          const ns = { athleteId: draft.non_striker_athlete_id, name: draft.non_striker_name, onStrike: false };
          const b = { athleteId: draft.bowler_athlete_id, name: draft.bowler_name };
          
          strikerRef.current = s;
          nonStrikerRef.current = ns;
          bowlerRef.current = b;
          
          setStrikerState(s);
          setNonStrikerState(ns);
          setBowlerState(b);
        }
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

    const ballChannel = supabase
      .channel(`mc_ball_events:${activeInnings.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "mc_ball_events",
        filter: `innings_id=eq.${activeInnings.id}`,
      }, (payload) => {
        setEvents((prev) => {
          let next = [...prev];
          if (payload.eventType === "INSERT") {
            const row = payload.new as MCBallEvent;
            if (next.some((e) => e.id === row.id)) return prev;
            next.push(row);
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as MCBallEvent;
            next = next.filter((e) => e.id !== row.id);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MCBallEvent;
            next = next.map((e) => (e.id === row.id ? row : e));
          }
          const sorted = next.sort((a, b) => a.sequence_number - b.sequence_number);
          eventsRef.current = sorted; // KEEP REF IN SYNC
          return sorted;
        });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "mc_match_draft_selections",
        filter: `innings_id=eq.${activeInnings.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const row = payload.new as any;
          const s = { athleteId: row.striker_athlete_id, name: row.striker_name, onStrike: true };
          const ns = { athleteId: row.non_striker_athlete_id, name: row.non_striker_name, onStrike: false };
          const b = { athleteId: row.bowler_athlete_id, name: row.bowler_name };
          
          strikerRef.current = s;
          nonStrikerRef.current = ns;
          bowlerRef.current = b;
          
          setStrikerState(s);
          setNonStrikerState(ns);
          setBowlerState(b);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ballChannel);
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
      redoStackRef.current = [];
      setEvents([]);
      return created;
    },
    [matchId, opts.tenantId],
  );

  const submitBall = useCallback<ScoringSession["submitBall"]>(
    async (partial) => {
      const active = activeInningsRef.current;
      if (!matchId || !opts.tenantId || !active) throw new Error("Invalid state");
      
      const latestMatchState = replayInnings(eventsRef.current, {
        totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
        maxWickets: 10,
        target: active.target ?? null,
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
          innings: active,
          events: eventsRef.current,
          matchStatus: match?.status ?? null,
          totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
        },
      );

      const pos = nextPosition(eventsRef.current);
      const isLegal = isLegalDelivery(partial.extraType ?? null);
      const optimistic: MCBallEvent = {
        id: makeClientEventId(),
        tenant_id: opts.tenantId,
        match_id: matchId,
        innings_id: active.id,
        sequence_number: pos.sequenceNumber,
        over_number: pos.overNumber,
        ball_number: pos.ballNumber,
        is_legal_delivery: isLegal,
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
      redoStackRef.current = [];
      const result = await appendBallEvent({ 
        ...partial, 
        tenantId: opts.tenantId,
        matchId,
        inningsId: active.id,
        eventId: optimistic.id,
        priorEvents: eventsRef.current.filter(e => e.id !== optimistic.id)
      });
      
      const newStriker = applyStrikeAfterBall({ striker: currentStriker, nonStriker: currentNonStriker }, result, isLegal);
      setStriker({ ...newStriker.striker, onStrike: true });
      setNonStriker({ ...newStriker.nonStriker, onStrike: false });
      
      return result;
    },
    [matchId, opts.tenantId, opts.userId, match?.status, setStriker, setNonStriker],
  );


  const undo = useCallback(async () => {
    const active = activeInningsRef.current;
    if (!active) return null;
    const last = await undoLastBallEvent(active.id);
    if (last) {
      redoStackRef.current = [last, ...redoStackRef.current].slice(0, 20);
      setEvents((prev) => prev.filter((e) => e.id !== last.id));
    }
    return last;
  }, []);

  const redo = useCallback(async () => {
    const active = activeInningsRef.current;
    if (!active || redoStackRef.current.length === 0) return null;
    
    const lastUndone = redoStackRef.current[0];
    redoStackRef.current = redoStackRef.current.slice(1);
    
    try {
      const result = await appendBallEvent({
        eventId: lastUndone.id,
        tenantId: lastUndone.tenant_id,
        matchId: lastUndone.match_id,
        inningsId: lastUndone.innings_id,
        strikerAthleteId: lastUndone.striker_athlete_id,
        strikerName: lastUndone.striker_name,
        nonStrikerAthleteId: lastUndone.non_striker_athlete_id,
        nonStrikerName: lastUndone.non_striker_name,
        bowlerAthleteId: lastUndone.bowler_athlete_id,
        bowlerName: lastUndone.bowler_name,
        runsOffBat: lastUndone.runs_off_bat,
        extraType: lastUndone.extra_type as ExtraType | null,
        extraRuns: lastUndone.extra_runs,
        dismissalType: lastUndone.dismissal_type as DismissalType | null,
        dismissedAthleteId: lastUndone.dismissed_athlete_id,
        dismissedName: lastUndone.dismissed_name,
        fielderAthleteId: lastUndone.fielder_athlete_id,
        fielderName: lastUndone.fielder_name,
        priorEvents: eventsRef.current,
      });
      return result;
    } catch (err) {
      console.error("[scoring] Redo failed", err);
      redoStackRef.current = [lastUndone, ...redoStackRef.current];
      return null;
    }
  }, []);


  const deleteBall = useCallback(async (eventId: string) => {
    await deleteBallEvent(eventId);
    redoStackRef.current = [];
  }, []);

  const updateBall = useCallback(async (input: UpdateBallInput) => {
    await updateBallEvent(input);
    redoStackRef.current = [];
  }, []);

  const updateBallBowler = useCallback(async (eventId: string, opt: { athleteId: string | null; name: string }) => {
    const { error } = await (supabase as any).rpc("update_mc_ball_bowler", {
      p_event_id: eventId,
      p_bowler_athlete_id: opt.athleteId,
      p_bowler_name: opt.name
    });
    if (error) throw error;
    redoStackRef.current = [];
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
    redo,
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
  wicket: (kind: DismissalType, opts?: { fielderAthleteId?: string | null; fielderName?: string | null; dismissedAthleteId?: string | null; dismissedName?: string | null }) => ({
    runsOffBat: 0,
    extraType: null,
    extraRuns: 0,
    dismissalType: kind,
    fielderAthleteId: opts?.fielderAthleteId,
    fielderName: opts?.fielderName,
    dismissedAthleteId: opts?.dismissedAthleteId,
    dismissedName: opts?.dismissedName,
  }),
};


