/**
 * Coach-facing queries.
 *
 * Every read here goes through Supabase with RLS. Coaches only see rows for
 * batches they are actively assigned to via `coach_assignments`, gated by
 * `is_coach_for_batch()` / `list_my_coach_batches()`. No new tables.
 */

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export type MyBatch = {
  batch_id: string;
  tenant_id: string;
  name: string;
  timing: string | null;
  coach_role: string;
};

export type CoachTodaySession = {
  id: string;
  batch_id: string;
  batch_name: string;
  session_date: string;
  notes: string | null;
  present: number;
  total: number;
};

export const coachKeys = {
  myBatches: (tenantId: string) => ["coach", "my-batches", tenantId] as const,
  todaySessions: (tenantId: string) => ["coach", "today-sessions", tenantId] as const,
  batchStudents: (tenantId: string, batchId: string) =>
    ["coach", "batch-students", tenantId, batchId] as const,
};

export async function fetchMyBatches(): Promise<MyBatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("list_my_coach_batches");
  if (error) throw error;
  return (data ?? []) as MyBatch[];
}

export async function fetchCoachTodaySessions(
  tenantId: string,
  batchIds: string[],
): Promise<CoachTodaySession[]> {
  if (batchIds.length === 0) return [];
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: sessions, error } = await supabase
    .from("attendance_sessions")
    .select("id, batch_id, session_date, notes, batches(name)")
    .eq("tenant_id", tenantId)
    .eq("session_date", today)
    .in("batch_id", batchIds);
  if (error) throw error;

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const counts = new Map<string, { present: number; total: number }>();
  if (sessionIds.length > 0) {
    const { data: marks } = await supabase
      .from("attendance_marks")
      .select("session_id, status")
      .in("session_id", sessionIds);
    for (const m of marks ?? []) {
      const c = counts.get(m.session_id) ?? { present: 0, total: 0 };
      c.total += 1;
      if (m.status === "present" || m.status === "late") c.present += 1;
      counts.set(m.session_id, c);
    }
  }

  return (sessions ?? []).map((s) => {
    const c = counts.get(s.id) ?? { present: 0, total: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bname = (s as any).batches?.name ?? "";
    return {
      id: s.id,
      batch_id: s.batch_id,
      batch_name: bname,
      session_date: s.session_date,
      notes: s.notes,
      present: c.present,
      total: c.total,
    };
  });
}

export async function fetchBatchStudents(tenantId: string, batchId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, photo_url, status")
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .order("first_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSessionNote(sessionId: string, notes: string) {
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ notes })
    .eq("id", sessionId);
  if (error) throw error;
}
