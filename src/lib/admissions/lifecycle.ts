/**
 * Phase 7 — Admissions & Onboarding lifecycle.
 * Client-safe constants shared by dashboard + student views.
 */
export const LIFECYCLE_STATUSES = [
  "applied",
  "registration_in_progress",
  "registration_submitted",
  "registration_fee_pending",
  "under_review",
  "approved",
  "rejected",
  "waitlisted",
  "imported",
  "invitation_sent",
  "activated",
  "profile_completed",
  "fee_plan_assigned",
  "batch_assigned",
  "active",
  "inactive",
  "transferred",
  "alumni",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  applied: "Applied",
  registration_in_progress: "Registration In Progress",
  registration_submitted: "Registration Submitted",
  registration_fee_pending: "Registration Fee Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  imported: "Imported",
  invitation_sent: "Invitation Sent",
  activated: "Activated",
  profile_completed: "Profile Completed",
  fee_plan_assigned: "Fee Plan Assigned",
  batch_assigned: "Batch Assigned",
  active: "Active Student",
  inactive: "Inactive",
  transferred: "Transferred",
  alumni: "Alumni",
};

export const LIFECYCLE_TONE: Record<LifecycleStatus, string> = {
  applied: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  registration_in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  registration_submitted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  registration_fee_pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  under_review: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  waitlisted: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  imported: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  invitation_sent: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  activated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  profile_completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  fee_plan_assigned: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  batch_assigned: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  inactive: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  transferred: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  alumni: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export function isPendingApproval(status: string | null | undefined): boolean {
  if (!status) return false;
  return [
    "applied",
    "registration_in_progress",
    "registration_submitted",
    "registration_fee_pending",
    "under_review",
    "waitlisted",
  ].includes(status);
}

export function isActiveStudent(status: string | null | undefined): boolean {
  if (!status) return false;
  return ["active", "activated", "profile_completed", "fee_plan_assigned", "batch_assigned", "approved"].includes(
    status,
  );
}
