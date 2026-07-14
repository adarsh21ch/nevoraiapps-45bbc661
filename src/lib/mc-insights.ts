/**
 * Phase 03.0 — Reusable insights primitives.
 *
 * NO new cricket math. All values delegate to the existing Statistics /
 * Performance Analytics engines. This file exists so future dashboards
 * (Owner Insights, Public Website, Awards) all pull from one place.
 */
export {
  computeBatting,
  computeBowling,
  computePartnerships,
  computeFallOfWickets,
  computeOverSummaries,
} from "@/lib/mc-statistics-engine";
export type { BattingStat, BowlingStat } from "@/lib/mc-statistics-engine";

export {
  buildPlayerPerformance,
  listAcademyPerformance,
  generateCoachInsights,
} from "@/lib/mc-performance-analytics";
export type {
  MatchLite,
  PerfPoint,
  SplitBucket,
} from "@/lib/mc-performance-analytics";
