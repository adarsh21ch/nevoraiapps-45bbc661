/* ================================================================
 * Match Center — Unified Data Facade
 * ----------------------------------------------------------------
 * SINGLE PROVIDER for every read-only Match Center view. The UI
 * never forks on `isDemo` for computation — call these hooks and
 * render the result.
 *
 *   Real academy  →  Supabase (mc_ball_events, mc_matches, …)
 *   Demo academy  →  local demo dataset (mc-demo/generate + store)
 *
 * Both paths flow through the SAME statistics/derivation engines,
 * so numbers are guaranteed to agree.
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
import {
  deriveAwards,
  deriveChildSummary,
  derivePlayerPerformance,
  deriveRecognitions,
  type DemoChildSummary,
  type DemoPlayerPerformance,
  type DerivedAward,
  type DerivedRecognition,
} from "@/lib/mc-demo/derive-extras";

/** Whether the current tenant is currently in demo mode. */
export function useIsDemoAcademy(tenantId: string): boolean {
  return useDemoMode(tenantId);
}

/** Academy-wide leaderboards. `null` in live mode so pages keep Supabase. */
export function useMCLeaderboards(tenantId: string): {
  mostRuns: LeaderRow[];
  mostWickets: LeaderRow[];
  mostBoundaries: LeaderRow[];
} | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveLeaderboards(demo) : null), [demo]);
}

export function useMCRecords(tenantId: string): RecordRow[] | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveRecords(demo) : null), [demo]);
}

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

export function useMCTeamProfile(
  tenantId: string,
  teamId: string | null | undefined,
): TeamProfile | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo && teamId ? deriveTeamProfile(demo, teamId) : null), [demo, teamId]);
}

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

/** Auto-derived recognitions (POM, centuries, 5-fers, hat tricks, …). */
export function useMCRecognitions(tenantId: string): DerivedRecognition[] | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveRecognitions(demo) : null), [demo]);
}

/** Season / career awards derived from ball-event totals. */
export function useMCAwards(tenantId: string): DerivedAward[] | null {
  const demo = useDemoData(tenantId);
  return useMemo(() => (demo ? deriveAwards(demo) : null), [demo]);
}

/** AI reports pass-through for demo (production uses Supabase directly). */
export function useMCAIReports(tenantId: string) {
  const demo = useDemoData(tenantId);
  return demo?.aiReports ?? null;
}

/** Full performance profile (form, splits, consistency) for demo player. */
export function useMCPlayerPerformance(
  tenantId: string,
  athleteId: string | null | undefined,
): DemoPlayerPerformance | null {
  const demo = useDemoData(tenantId);
  return useMemo(
    () => (demo && athleteId ? derivePlayerPerformance(demo, athleteId) : null),
    [demo, athleteId],
  );
}

/** Parent-portal ChildSummary derived from demo events. */
export function useMCChildSummary(
  tenantId: string,
  athleteId: string | null | undefined,
): DemoChildSummary | null {
  const demo = useDemoData(tenantId);
  return useMemo(
    () => (demo && athleteId ? deriveChildSummary(demo, athleteId) : null),
    [demo, athleteId],
  );
}

export type { DerivedRecognition, DerivedAward, DemoPlayerPerformance, DemoChildSummary };
