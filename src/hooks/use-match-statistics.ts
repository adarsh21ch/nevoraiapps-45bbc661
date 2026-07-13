import { useMemo } from "react";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";
import {
  computeInningsStatistics,
  type InningsStatistics,
} from "@/lib/mc-statistics-engine";

/* ================================================================
 * useMatchStatistics
 * ----------------------------------------------------------------
 * Memoized derivation of live cricket statistics from the immutable
 * Ball Event log. Nothing is stored — every value is recomputed
 * whenever the events array reference changes (i.e. after a new
 * ball is appended or an undo removes the last event).
 *
 *   const stats = useMatchStatistics(events, { totalOvers, target });
 *
 * This hook performs NO database reads and NO writes.
 * ================================================================ */

export interface UseMatchStatisticsOptions {
  totalOvers?: number | null;
  target?: number | null;
  activeInnings?: MCInnings | null;
}

export function useMatchStatistics(
  events: MCBallEvent[],
  opts: UseMatchStatisticsOptions = {},
): InningsStatistics {
  const target = opts.target ?? opts.activeInnings?.target ?? null;
  const totalOvers = opts.totalOvers ?? null;
  return useMemo(
    () =>
      computeInningsStatistics(events, { totalOvers, target }),
    [events, totalOvers, target],
  );
}

export type { InningsStatistics } from "@/lib/mc-statistics-engine";
