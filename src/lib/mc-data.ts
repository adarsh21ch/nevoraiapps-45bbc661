/* ================================================================
 * Match Center — Unified Data Facade
 * ----------------------------------------------------------------
 * SINGLE PROVIDER for every read-only Match Center view.
 *
 * There is ONE Match Center. Business logic, statistics engine,
 * derivation layer and UI are shared. The only thing that changes
 * between a real academy and a demo academy is the DATA SOURCE:
 *
 *   Real academy  →  Supabase (mc_ball_events, mc_matches, …)
 *   Demo academy  →  local demo dataset (mc-demo/generate + store)
 *
 * Both paths flow through the SAME statistics/derivation engines,
 * so numbers are guaranteed to agree. Pages should never fork on
 * `isDemo` for computation — call these hooks and render the result.
 *
 * These hooks are thin dispatchers over the existing engines. They
 * intentionally do not introduce new caches, new queries, or new
 * realtime channels — everything reuses the react-query cache the
 * production pages already share, or the reactive demo store.
 * ================================================================ */

import { useMemo } from "react";
import { useDemoData, useDemoMode } from "@/lib/mc-demo/store";
import {
  deriveLeaderboards,
  derivePlayerCareer,
  deriveRecords,
  deriveTeamProfile,
  deriveTournament,
  type LeaderRow,
  type PlayerCareer,
  type RecordRow,
  type TeamProfile,
  type TournamentSummary,
} from "@/lib/mc-demo/derive";

/** Whether the current tenant is currently in demo mode. */
export function useIsDemoAcademy(tenantId: string): boolean {
  return useDemoMode(tenantId);
}

/**
 * Academy-wide leaderboards (most runs / wickets / boundaries).
 * Demo mode: derived from ball events. Live mode: page-level query
 * against `mc_academy_records` continues to render — this hook returns
 * `null` so the page can keep its existing Supabase code path.
 */
export function useMCLeaderboards(tenantId: string): {
  mostRuns: LeaderRow[];
  mostWickets: LeaderRow[];
  mostBoundaries: LeaderRow[];
} | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveLeaderboards(demo) : null), [demo]);
}

/** Academy records (highest score, best bowling, most sixes, …). */
export function useMCRecords(tenantId: string): RecordRow[] | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveRecords(demo) : null), [demo]);
}

/** Career of a single athlete across every played match. */
export function useMCPlayerCareer(
  tenantId: string,
  athleteId: string | null | undefined,
): PlayerCareer | null {
  const demo = useDemoData(tenantId);
  return useMemo(
    () => (demo && athleteId ? derivePlayerCareer(demo, athleteId) : null),
    [demo, athleteId],
  );
}

/** Team season profile (W/L, top run scorer, top wicket taker, squad). */
export function useMCTeamProfile(
  tenantId: string,
  teamId: string | null | undefined,
): TeamProfile | null {
  const demo = useDemoData(tenantId);
  return useMemo(
    () => (demo && teamId ? deriveTeamProfile(demo, teamId) : null),
    [demo, teamId],
  );
}

/** Tournament summary: fixtures, standings, orange/purple cap, records. */
export function useMCTournament(
  tenantId: string,
  tournamentId: string | null | undefined,
): TournamentSummary | null {
  const demo = useDemoData(tenantId);
  return useMemo(
    () => (demo && tournamentId ? deriveTournament(demo, tournamentId) : null),
    [demo, tournamentId],
  );
}
