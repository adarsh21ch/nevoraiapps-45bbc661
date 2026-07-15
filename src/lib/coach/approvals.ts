/**
 * Head-Coach approval workflow for assistant-coach remarks.
 * Reuses mc_coach_remarks. RLS: tenant members can read/update.
 */
import { supabase } from "@/integrations/supabase/client";

export const approvalKeys = {
  pending: (tenantId: string) => ["coach", "approvals", tenantId] as const,
  history: (tenantId: string) => ["coach", "approvals-history", tenantId] as const,
};

export type PendingRemark = {
  id: string;
  student_id: string;
  student_name: string | null;
  remark: string;
  author_user_id: string | null;
  author_name: string | null;
  submitted_by_role: string | null;
  visible_to_parents: boolean;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
};

type RemarkRow = {
  id: string;
  student_id: string;
  remark: string;
  author_user_id: string | null;
  author_name: string | null;
  submitted_by_role: string | null;
  visible_to_parents: boolean;
  approval_status: string;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  students: { first_name: string | null; last_name: string | null } | null;
};

function mapRow(r: RemarkRow): PendingRemark {
  return {
    id: r.id,
    student_id: r.student_id,
    student_name: r.students
      ? [r.students.first_name, r.students.last_name].filter(Boolean).join(" ") || null
      : null,
    remark: r.remark,
    author_user_id: r.author_user_id,
    author_name: r.author_name,
    submitted_by_role: r.submitted_by_role,
    visible_to_parents: r.visible_to_parents,
    approval_status: r.approval_status as PendingRemark["approval_status"],
    rejection_reason: r.rejection_reason,
    created_at: r.created_at,
    approved_at: r.approved_at,
  };
}

export async function fetchPendingRemarks(tenantId: string): Promise<PendingRemark[]> {
  const { data, error } = await supabase
    .from("mc_coach_remarks")
    .select(
      "id, student_id, remark, author_user_id, author_name, submitted_by_role, visible_to_parents, approval_status, rejection_reason, created_at, approved_at, students(first_name, last_name)",
    )
    .eq("tenant_id", tenantId)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as unknown as RemarkRow));
}

export async function fetchRecentDecisions(tenantId: string): Promise<PendingRemark[]> {
  const { data, error } = await supabase
    .from("mc_coach_remarks")
    .select(
      "id, student_id, remark, author_user_id, author_name, submitted_by_role, visible_to_parents, approval_status, rejection_reason, created_at, approved_at, students(first_name, last_name)",
    )
    .eq("tenant_id", tenantId)
    .in("approval_status", ["approved", "rejected"])
    .not("approved_at", "is", null)
    .order("approved_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as unknown as RemarkRow));
}

export async function approveRemark(id: string, approverId: string) {
  const { error } = await supabase
    .from("mc_coach_remarks")
    .update({
      approval_status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectRemark(id: string, approverId: string, reason: string) {
  const { error } = await supabase
    .from("mc_coach_remarks")
    .update({
      approval_status: "rejected",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", id);
  if (error) throw error;
}
