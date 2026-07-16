/**
 * Canonical Students service (Phase 13.4).
 *
 * Every student read across AcademyOS — Dashboard, Students, Attendance,
 * Reports, Analytics, NevorAI, Communications, Founder Intelligence — MUST
 * go through this module. Do not add new `supabase.from("students")` calls
 * outside this file; add a helper here and consume it.
 *
 * Legacy sites (`src/lib/dashboard-queries.ts#fetchStudent[s]`,
 * `src/lib/students-manage.ts` mutations) are preserved for backward-compat
 * and are re-exported from here so callers can migrate imports without a
 * behavior change.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Student = Database["public"]["Tables"]["students"]["Row"];

// Re-export existing canonical reads so new code has one import path.
export { fetchStudent, fetchStudents, qk as dashboardQk } from "@/lib/dashboard-queries";

/**
 * Canonical student query keys. React Query consumers should reuse these
 * to avoid cache duplication with legacy `qk.students`.
 */
export const studentKeys = {
  all: (tenantId: string) => ["students", tenantId] as const,
  byId: (id: string) => ["student", id] as const,
  activeCount: (tenantId: string) => ["students", "active-count", tenantId] as const,
  newSince: (tenantId: string, sinceISO: string) =>
    ["students", "new-since", tenantId, sinceISO] as const,
};

type Client = SupabaseClient<Database>;

/** Canonical: active student count for a tenant. */
export async function countActiveStudents(
  client: Client | typeof supabase,
  tenantId: string,
): Promise<number> {
  const { count } = await client
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  return count ?? 0;
}

/** Canonical: new students created since a timestamp. */
export async function countStudentsSince(
  client: Client | typeof supabase,
  tenantId: string,
  sinceISO: string,
  untilISO?: string,
): Promise<number> {
  let q = client
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceISO);
  if (untilISO) q = q.lte("created_at", untilISO);
  const { count } = await q;
  return count ?? 0;
}
