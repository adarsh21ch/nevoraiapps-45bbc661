/**
 * Phase 3 — reusable bulk mutation primitives + client-side rate-limit gate.
 *
 * These are the thin client wrappers over the Postgres RPCs introduced by the
 * Phase 3 migration. Adopt them in place of hand-rolled `for (const x of xs)
 * await supabase.from(...).insert(...)` loops. Every call is a single
 * round-trip, transactional, and tenant-gated inside the RPC.
 */
import { supabase } from "@/integrations/supabase/client";

/* -------- Bulk RPCs ------------------------------------------------------ */

export type BulkAttendanceMark = {
  student_id: string;
  status: "present" | "absent" | "late" | "excused";
  remark?: string | null;
};

export async function bulkMarkAttendance(
  sessionId: string,
  marks: BulkAttendanceMark[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("bulk_mark_attendance", {
    _session_id: sessionId,
    _marks: marks,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function bulkApproveRegistrations(
  tenantId: string,
  ids: string[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "bulk_approve_registrations",
    { _tenant_id: tenantId, _ids: ids },
  );
  if (error) throw error;
  return Number(data ?? 0);
}

export async function bulkEnqueueNotificationRecipients(
  campaignId: string,
  recipientIds: string[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "bulk_enqueue_notification_recipients",
    { _campaign_id: campaignId, _recipient_ids: recipientIds },
  );
  if (error) throw error;
  return Number(data ?? 0);
}

/* -------- Match-scoring advisory lock ----------------------------------- */

export async function acquireMatchScoringLock(matchId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "acquire_match_scoring_lock",
    { _match_id: matchId },
  );
  if (error) throw error;
  return Boolean(data);
}

export async function releaseMatchScoringLock(matchId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "release_match_scoring_lock",
    { _match_id: matchId },
  );
  if (error) throw error;
  return Boolean(data);
}

/* -------- Rate limit gate ------------------------------------------------ */

/**
 * Checks a token-bucket for `key`. Returns true when the caller is under
 * the limit and false when they should be blocked. Callers must handle
 * `false` — typically by surfacing "Too many attempts, try again shortly".
 *
 * Bucket keys should be namespaced by the surface, e.g.:
 *   `lead-form:${tenantId}:${email}`
 *   `public-registration:${tenantId}:${ip}`
 *   `login:${email}`
 */
export async function checkRateLimit(
  key: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("check_rate_limit", {
    _key: key,
    _max_hits: maxHits,
    _window_seconds: windowSeconds,
  });
  if (error) {
    // Fail-open: never block real users because the limiter is degraded.
    console.warn("[rate-limit] check failed, allowing", error);
    return true;
  }
  return Boolean(data);
}
