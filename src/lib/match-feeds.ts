/**
 * Phase 03.0 — Shared "match feeds" primitives.
 *
 * Every shell (Owner Dashboard, Match Center, Student App, Parent Portal)
 * subscribes to the same React Query keys so a single fetch warms the rest
 * of the app. No new engine logic — thin wrappers over `listMatches`.
 */
import { useQuery } from "@tanstack/react-query";
import { listMatches, type MatchWithTeams } from "@/lib/mc-matches";

export const matchFeedKeys = {
  all: (tenantId: string) => ["mc-matches", tenantId] as const,
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Underlying shared source. All feed hooks derive from this one query. */
export function useTenantMatches(tenantId: string | undefined) {
  return useQuery({
    enabled: !!tenantId,
    queryKey: matchFeedKeys.all(tenantId ?? "none"),
    queryFn: () => listMatches(tenantId!),
    staleTime: 30_000,
  });
}

export function useLiveMatches(tenantId: string | undefined) {
  const q = useTenantMatches(tenantId);
  const data = (q.data ?? []).filter((m) => m.status === "live");
  return { ...q, data };
}

export function useUpcomingMatches(tenantId: string | undefined, limit = 5) {
  const q = useTenantMatches(tenantId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data = (q.data ?? [])
    .filter(
      (m) => m.status === "scheduled" && m.scheduled_date && new Date(m.scheduled_date) >= today,
    )
    .sort((a, b) => (a.scheduled_date! < b.scheduled_date! ? -1 : 1))
    .slice(0, limit);
  return { ...q, data };
}

export function useTodaysMatches(tenantId: string | undefined) {
  const q = useTenantMatches(tenantId);
  const now = new Date();
  const data = (q.data ?? []).filter(
    (m) => m.scheduled_date && isSameDay(new Date(m.scheduled_date), now),
  );
  return { ...q, data };
}

export function useRecentMatches(tenantId: string | undefined, limit = 5) {
  const q = useTenantMatches(tenantId);
  const data = (q.data ?? []).filter((m) => m.status === "completed").slice(0, limit);
  return { ...q, data };
}

export type { MatchWithTeams };
