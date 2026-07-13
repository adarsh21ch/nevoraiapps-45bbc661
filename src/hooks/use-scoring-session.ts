import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type MCBallEvent,
  type MCInnings,
} from "@/lib/mc-ball-events";
import {
  applyStrikeAfterBall,
  replayInnings,
  validateBallDraft,
  type MatchState,
} from "@/lib/mc-rules-engine";

type MCMatch = Database["public"]["Tables"]["mc_matches"]["Row"];
type MCMatchSquad = Database["public"]["Tables"]["mc_match_squads"]["Row"];

/* ================================================================
 * useScoringSession(matchId)
 *
 * Loads match + innings + ball events + playing XI, and exposes
 * mutations. Never stores derived statistics — only the event log
 * plus positional pointers (current over / ball / active innings).
 * ================================================================ */

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
  ballsBowled: number; // legal deliveries this over (0..6)
  events: MCBallEvent[]; // events in current over (any delivery)
}

export interface ScoringSession {
  loading: boolean;
  error: string | null;

  match: MCMatch | null;
  innings: MCInnings[];
  activeInnings: MCInnings | null;
  events: MCBallEvent[]; // active innings events, in order

  playingXI: MCMatchSquad[];
  battingSquad: MCMatchSquad[];
  bowlingSquad: MCMatchSquad[];

  striker: CurrentBatterState;
  nonStriker: CurrentBatterState;
  bowler: CurrentBowlerState;
  currentOver: CurrentOverState;

  /** Reconstructed match state (pure replay of the event log). */
  matchState: MatchState;

  /* --- setters (UI-driven, no calculations) --- */
  setStriker: (b: CurrentBatterState) => void;
  setNonStriker: (b: CurrentBatterState) => void;
  setBowler: (b: CurrentBowlerState) => void;

  /* --- mutations --- */
  startInnings: (input: Omit<CreateInningsInput, "tenantId" | "matchId">) => Promise<MCInnings>;
  submitBall: (
    input: Omit<
      AppendBallInput,
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
  reload: () => Promise<void>;
}

/* ---------- helpers ---------- */

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
  const legal = overEvents.filter((e) => e.is_legal_delivery).length;
  return { overNumber: lastOver, ballsBowled: legal, events: overEvents };
}

/* ---------- hook ---------- */

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

  const [striker, setStriker] = useState<CurrentBatterState>({
    athleteId: null,
    name: null,
    onStrike: true,
  });
  const [nonStriker, setNonStriker] = useState<CurrentBatterState>({
    athleteId: null,
    name: null,
    onStrike: false,
  });
  const [bowler, setBowler] = useState<CurrentBowlerState>({
    athleteId: null,
    name: null,
  });

  const activeInnings = useMemo(() => pickActiveInnings(innings), [innings]);

  const eventsRef = useRef<MCBallEvent[]>([]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  /* ---------- initial load ---------- */

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: matchRow, error: matchErr }, inningsList, { data: squad }] =
        await Promise.all([
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
        setEvents(evs);
      } else {
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

  /* ---------- realtime: broadcast ball events to any subscriber ---------- */

  useEffect(() => {
    if (!activeInnings?.id) return;
    const channel = supabase
      .channel(`mc_ball_events:${activeInnings.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mc_ball_events",
          filter: `innings_id=eq.${activeInnings.id}`,
        },
        (payload) => {
          setEvents((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as MCBallEvent;
              if (prev.some((e) => e.id === row.id)) return prev;
              return [...prev, row].sort(
                (a, b) => a.sequence_number - b.sequence_number,
              );
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
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeInnings?.id]);

  /* ---------- squads split by innings ---------- */

  const battingSquad = useMemo(
    () =>
      activeInnings
        ? playingXI.filter((p) => p.team_id === activeInnings.batting_team_id)
        : [],
    [playingXI, activeInnings],
  );
  const bowlingSquad = useMemo(
    () =>
      activeInnings
        ? playingXI.filter((p) => p.team_id === activeInnings.bowling_team_id)
        : [],
    [playingXI, activeInnings],
  );

  /* ---------- current over ---------- */

  const currentOver = useMemo(() => buildCurrentOver(events), [events]);

  /* ---------- reconstructed match state (pure replay) ---------- */

  const matchState = useMemo<MatchState>(
    () =>
      replayInnings(events, {
        totalOvers: (match as { overs?: number | null } | null)?.overs ?? null,
        maxWickets: 10,
        target: activeInnings?.target ?? null,
      }),
    [events, match, activeInnings?.target],
  );

  /* ---------- mutations ---------- */

  const startInnings = useCallback(
    async (input: Omit<CreateInningsInput, "tenantId" | "matchId">) => {
      if (!matchId) throw new BallEventError("INVALID_MATCH", "Missing match.");
      if (!opts.tenantId)
        throw new BallEventError("INVALID_TENANT", "Missing tenant.");
      if (match?.status === "completed" || match?.status === "archived") {
        throw new BallEventError(
          "MATCH_COMPLETED",
          "Match is no longer active.",
        );
      }
      const created = await createInnings({
        ...input,
        tenantId: opts.tenantId,
        matchId,
      });
      setInnings((prev) => [...prev, created]);
      setEvents([]);
      return created;
    },
    [matchId, opts.tenantId, match?.status],
  );

  const submitBall = useCallback<ScoringSession["submitBall"]>(
    async (partial) => {
      if (!matchId)
        throw new BallEventError("INVALID_MATCH", "Missing match.");
      if (!opts.tenantId)
        throw new BallEventError("INVALID_TENANT", "Missing tenant.");
      if (!activeInnings)
        throw new BallEventError(
          "INVALID_INNINGS",
          "Start an innings before scoring.",
        );
      if (activeInnings.status !== "in_progress")
        throw new BallEventError(
          "INNINGS_CLOSED",
          "Innings is not in progress.",
        );
      if (match?.status === "completed" || match?.status === "archived")
        throw new BallEventError(
          "MATCH_COMPLETED",
          "Match is no longer active.",
        );
      if (!striker.athleteId && !striker.name)
        throw new BallEventError("NO_STRIKER", "Select the striker.");
      if (!bowler.athleteId && !bowler.name)
        throw new BallEventError("NO_BOWLER", "Select the bowler.");

      // Rules-engine validation against the reconstructed state.
      validateBallDraft(
        {
          strikerAthleteId: striker.athleteId,
          strikerName: striker.name,
          nonStrikerAthleteId: nonStriker.athleteId,
          nonStrikerName: nonStriker.name,
          bowlerAthleteId: bowler.athleteId,
          bowlerName: bowler.name,
          ...partial,
        },
        matchState,
        {
          innings: activeInnings,
          events: eventsRef.current,
          matchStatus: match?.status ?? null,
        },
      );

      const created = await appendBallEvent({
        tenantId: opts.tenantId,
        matchId,
        inningsId: activeInnings.id,
        strikerAthleteId: striker.athleteId,
        strikerName: striker.name,
        nonStrikerAthleteId: nonStriker.athleteId,
        nonStrikerName: nonStriker.name,
        bowlerAthleteId: bowler.athleteId,
        bowlerName: bowler.name,
        createdBy: opts.userId ?? null,
        priorEvents: eventsRef.current,
        ...partial,
      });
      // Optimistic append (realtime will dedupe by id).
      setEvents((prev) =>
        prev.some((e) => e.id === created.id) ? prev : [...prev, created],
      );

      // Auto strike rotation for the UI pointer (state is still derived from
      // events — this only updates the *selected* striker/non-striker).
      const legalBefore = eventsRef.current.filter(
        (e) => e.over_number === created.over_number && e.is_legal_delivery,
      ).length;
      const overCompleted =
        created.is_legal_delivery && legalBefore + 1 >= 6;
      const next = applyStrikeAfterBall(
        { striker, nonStriker },
        created,
        overCompleted,
      );
      if (
        next.striker.athleteId !== striker.athleteId ||
        next.striker.name !== striker.name
      ) {
        setStriker({ ...next.striker, onStrike: true });
        setNonStriker({ ...next.nonStriker, onStrike: false });
      }

      return created;
    },
    [
      matchId,
      opts.tenantId,
      opts.userId,
      activeInnings,
      match?.status,
      striker,
      nonStriker,
      bowler,
      matchState,
    ],
  );

  const undo = useCallback(async () => {
    if (!activeInnings)
      throw new BallEventError("INVALID_INNINGS", "No active innings.");
    const removed = await undoLastBallEvent(activeInnings.id);
    if (removed) {
      setEvents((prev) => prev.filter((e) => e.id !== removed.id));
    }
    return removed;
  }, [activeInnings]);

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
    reload: load,
  };
}

/* ================================================================
 * Convenience helpers for the scorer UI (still no derived stats).
 * Each returns a partial for `submitBall`.
 * ================================================================ */

export const ballHelpers = {
  run: (runs: 0 | 1 | 2 | 3 | 4 | 5 | 6) => ({
    runsOffBat: runs,
    extraType: null,
    extraRuns: 0,
  }),
  wide: (runs: number = 1) => ({
    runsOffBat: 0,
    extraType: "wide" as const,
    extraRuns: runs,
  }),
  noBall: (batRuns: number = 0) => ({
    runsOffBat: batRuns,
    extraType: "no_ball" as const,
    extraRuns: 1,
  }),
  bye: (runs: number) => ({
    runsOffBat: 0,
    extraType: "bye" as const,
    extraRuns: runs,
  }),
  legBye: (runs: number) => ({
    runsOffBat: 0,
    extraType: "leg_bye" as const,
    extraRuns: runs,
  }),
  wicket: (kind: AppendBallInput["dismissalType"], extras?: {
    fielderAthleteId?: string | null;
    fielderName?: string | null;
    dismissedAthleteId?: string | null;
    dismissedName?: string | null;
  }) => ({
    runsOffBat: 0,
    extraType: null,
    extraRuns: 0,
    dismissalType: kind ?? null,
    ...extras,
  }),
};

export { isLegalDelivery, nextPosition };
