/**
 * AcademyOS V2 — Attendance data layer.
 *
 * All attendance reads/writes go through this module. Never call
 * `supabase.from("attendance_marks")` directly from a component.
 *
 * Design rules enforced here:
 *  - Append-only writes: DB trigger blocks illegal updates; this module
 *    only issues legal ones (check_in insert, check_out update, absent
 *    insert, correction via RPC).
 *  - Single source of truth for "current state": always read from the
 *    `attendance_today` view.
 *  - Realtime: subscribe once per tenant via `useRealtimeChannel`.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import type { AttendanceState, AttendanceStatus, AttendanceSource } from "./constants";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const attendanceKeys = {
  today: (tenantId: string) => ["attendance", "today", tenantId] as const,
  session: (tenantId: string, batchId: string, date: string) =>
    ["attendance", "session", tenantId, batchId, date] as const,
  studentHistory: (tenantId: string, studentId: string) =>
    ["attendance", "history", tenantId, studentId] as const,
  inAcademyCount: (tenantId: string) => ["attendance", "in-academy-count", tenantId] as const,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * One row per (session, student) — aggregated across ALL visits today.
 * Backed by the `attendance_today` view. See migration for derivation rules.
 */
export interface AttendanceTodayRow {
  mark_id: string; // latest visit's mark id (for Check Out)
  tenant_id: string;
  student_id: string;
  session_id: string;
  batch_id: string | null;
  session_date: string;
  status: AttendanceStatus;
  check_in_at: string | null; // FIRST check-in of the day
  check_out_at: string | null; // LAST check-out of the day
  duration_minutes: number | null; // SUM of all completed visits
  visit_count: number; // number of check-ins today
  source: AttendanceSource | null;
  marked_by: string | null;
  current_state: AttendanceState;
  last_visit_type: string | null;
}

export async function fetchAttendanceToday(tenantId: string): Promise<AttendanceTodayRow[]> {
  const { data, error } = await supabase
    .from("attendance_today")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceTodayRow[];
}

// ---------------------------------------------------------------------------
// Per-student visit timeline (chronological). Used by player profile timeline
// and daily-summary reports. Absent rows are excluded — timeline shows visits.
// ---------------------------------------------------------------------------
export interface AttendanceVisit {
  mark_id: string;
  tenant_id: string;
  student_id: string;
  session_id: string;
  session_date: string;
  batch_id: string | null;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
  source: AttendanceSource;
  marked_by: string | null;
  visit_type: string | null;
  note: string | null;
  created_at: string;
}

export async function fetchStudentVisits(
  tenantId: string,
  studentId: string,
  opts: { since?: string; limit?: number } = {},
): Promise<AttendanceVisit[]> {
  let q = supabase
    .from("attendance_visits")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .order("session_date", { ascending: false })
    .order("check_in_at", { ascending: true, nullsFirst: false });
  if (opts.since) q = q.gte("session_date", opts.since);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceVisit[];
}

export interface DailyVisitSummary {
  session_date: string;
  first_check_in_at: string | null;
  last_check_out_at: string | null;
  total_minutes: number;
  visit_count: number;
  visits: AttendanceVisit[];
}

/** Group a flat visit list into per-day summaries (client-side derivation). */
export function groupVisitsByDay(visits: AttendanceVisit[]): DailyVisitSummary[] {
  const byDay = new Map<string, AttendanceVisit[]>();
  for (const v of visits) {
    if (v.status !== "present" || !v.check_in_at) continue;
    const arr = byDay.get(v.session_date) ?? [];
    arr.push(v);
    byDay.set(v.session_date, arr);
  }
  const out: DailyVisitSummary[] = [];
  for (const [date, arr] of byDay) {
    arr.sort((a, b) => (a.check_in_at ?? "").localeCompare(b.check_in_at ?? ""));
    const first = arr[0]?.check_in_at ?? null;
    const completed = arr.filter((v) => v.check_out_at);
    const last = completed.length ? completed[completed.length - 1].check_out_at : null;
    const total = arr.reduce((s, v) => s + (v.duration_minutes ?? 0), 0);
    out.push({
      session_date: date,
      first_check_in_at: first,
      last_check_out_at: last,
      total_minutes: total,
      visit_count: arr.length,
      visits: arr,
    });
  }
  return out.sort((a, b) => b.session_date.localeCompare(a.session_date));
}

/** Live count of players currently in the academy (across all batches). */
export function useInAcademyCount(tenantId: string | null | undefined) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: attendanceKeys.today(tenantId ?? "none"),
    queryFn: () => fetchAttendanceToday(tenantId!),
    enabled: !!tenantId,
    staleTime: 15_000,
  });
  useAttendanceRealtime(tenantId, qc);
  const count = useMemo(
    () => (q.data ?? []).filter((r) => r.current_state === "in_academy").length,
    [q.data],
  );
  return { ...q, count };
}

// ---------------------------------------------------------------------------
// Realtime — one subscription per tenant, refcounted via `useRealtimeChannel`.
// Invalidates all attendance queries for this tenant on any change.
// ---------------------------------------------------------------------------
export function useAttendanceRealtime(tenantId: string | null | undefined, qc: QueryClient) {
  useRealtimeChannel(
    tenantId ? `attendance:${tenantId}` : null,
    (channel) => {
      // Narrow-scope invalidator: refresh only THIS tenant's today feed +
      // in-academy count. Historical/per-student histories are stable and
      // do not need to refetch on every check-in.
      const bump = () => {
        if (!tenantId) return;
        qc.invalidateQueries({ queryKey: attendanceKeys.today(tenantId) });
        qc.invalidateQueries({ queryKey: attendanceKeys.inAcademyCount(tenantId) });
      };
      return channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance_marks",
            filter: `tenant_id=eq.${tenantId}`,
          },
          bump,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance_sessions",
            filter: `tenant_id=eq.${tenantId}`,
          },
          bump,
        );
    },
    [tenantId],
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

/** Get or create today's session for a batch. */
async function ensureSession(tenantId: string, batchId: string, dateISO: string): Promise<string> {
  const { data: existing, error: fetchErr } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .eq("session_date", dateISO)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (existing) return existing.id;
  const { data: created, error: insertErr } = await supabase
    .from("attendance_sessions")
    .insert({ tenant_id: tenantId, batch_id: batchId, session_date: dateISO })
    .select("id")
    .single();
  if (insertErr) throw insertErr;
  return created.id;
}

export interface CheckInInput {
  tenantId: string;
  batchId: string;
  studentId: string;
  source?: AttendanceSource;
  meta?: import("@/integrations/supabase/types").Json;
  markedBy?: string | null;
  /** Optional visit classification (practice/match/fitness/...). Free-form. */
  visitType?: string | null;
  /** Optional visit note (late arrival, injured, batting session, ...). */
  note?: string | null;
}

export async function checkInStudent(input: CheckInInput): Promise<void> {
  const dateISO = todayISO();
  const sessionId = await ensureSession(input.tenantId, input.batchId, dateISO);

  // If an active row already exists (e.g. marked absent earlier), the partial
  // unique index (session_id, student_id) WHERE superseded_by IS NULL blocks
  // this insert. Client should detect that and offer a correction flow.
  const { error } = await supabase.from("attendance_marks").insert({
    tenant_id: input.tenantId,
    session_id: sessionId,
    student_id: input.studentId,
    status: "present",
    check_in_at: new Date().toISOString(),
    source: input.source ?? "manual",
    marked_by: input.markedBy ?? null,
    check_in_meta: input.meta ?? {},
    visit_type: input.visitType ?? null,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export interface CheckOutInput {
  markId: string;
  meta?: import("@/integrations/supabase/types").Json;
}

export async function checkOutStudent(input: CheckOutInput): Promise<void> {
  const { error } = await supabase
    .from("attendance_marks")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_meta: input.meta ?? {},
    })
    .eq("id", input.markId);
  if (error) throw error;
}

// NOTE: We intentionally do NOT expose a `markStudentAbsent` mutation.
// Absent is DERIVED (any active student who is `not_marked` at end of day is
// counted as absent for reporting). This matches how sports academies operate —
// players arrive when they arrive; there is no forced session close.
// Corrections may still create absent rows via the `correct_attendance` RPC.

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkInStudent,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(vars.tenantId) });
    },
  });
}

export function useCheckOut(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkOutStudent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(tenantId) });
    },
  });
}
