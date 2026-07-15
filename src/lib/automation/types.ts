/**
 * Platform Automation Engine — types.
 *
 * Not module-specific. Any product (Academy, future NevorAI apps) can emit
 * events and register rules against these types.
 */

/** Canonical platform event names. Free-form strings are allowed too. */
export const AUTOMATION_EVENTS = {
  StudentCreated: "student.created",
  StudentUpdated: "student.updated",
  StudentCheckIn: "student.check_in",
  StudentCheckOut: "student.check_out",
  AttendanceMarked: "attendance.marked",
  FeeGenerated: "fee.generated",
  FeeDueTomorrow: "fee.due_tomorrow",
  FeeOverdue: "fee.overdue",
  FeePaid: "fee.paid",
  AdmissionSubmitted: "admission.submitted",
  AdmissionApproved: "admission.approved",
  MatchScheduled: "match.scheduled",
  MatchStarted: "match.started",
  MatchFinished: "match.finished",
  TournamentPublished: "tournament.published",
  TournamentFinished: "tournament.finished",
  CoachFeedbackAdded: "coach.feedback_added",
  PerformanceReportGenerated: "performance.report_generated",
  Birthday: "person.birthday",
  Anniversary: "person.anniversary",
  CommunicationSent: "communication.sent",
  WebsiteLeadReceived: "website.lead_received",
  StaffInvited: "staff.invited",
  StaffAccepted: "staff.accepted",
  StaffDisabled: "staff.disabled",
  StaffRoleChanged: "staff.role_changed",
  StaffAssignmentCreated: "staff.assignment.created",
  StaffAssignmentUpdated: "staff.assignment.updated",
  StaffAssignmentRemoved: "staff.assignment.removed",
  CoachBatchAssigned: "coach.batch_assigned",
  CoachAttendanceReminder: "coach.attendance_reminder",
  CoachSessionReminder: "coach.session_reminder",
  CoachStudentAssigned: "coach.student_assigned",
  CoachParentMessage: "coach.parent_message",
  CoachAnnouncement: "coach.announcement",
  CoachApprovalRequired: "coach.approval_required",
  CoachRemarkApproved: "coach.remark_approved",
  CoachRemarkRejected: "coach.remark_rejected",
  CoachScheduleUpdated: "coach.schedule_updated",
  // Payments & billing (Phase 9)
  PaymentCreated: "payment.created",
  PaymentSuccess: "payment.success",
  PaymentFailed: "payment.failed",
  PaymentRefunded: "payment.refunded",
  InvoiceGenerated: "invoice.generated",
  ReceiptGenerated: "receipt.generated",
  SubscriptionStarted: "subscription.started",
  SubscriptionRenewed: "subscription.renewed",
  SubscriptionExpired: "subscription.expired",
  SubscriptionCancelled: "subscription.cancelled",
  FeePaymentReceived: "fee.payment_received",
  RegistrationPaymentReceived: "registration.payment_received",
} as const;


export type AutomationEventType =
  | (typeof AUTOMATION_EVENTS)[keyof typeof AUTOMATION_EVENTS]
  | (string & {});

export type EventPayload = Record<string, unknown>;

export interface AutomationEvent {
  id: string;
  tenant_id: string;
  event_type: AutomationEventType;
  source_module: string | null;
  source_id: string | null;
  payload: EventPayload;
  status: "pending" | "processed" | "failed";
  created_at: string;
}

/** Declarative condition against the event payload. */
export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "exists"
  | "matches";

export interface Condition {
  path: string; // dot-path into payload, e.g. "student.batch_id"
  op: ConditionOperator;
  value?: unknown;
}

/** Actions are declarative. The engine resolves them to a provider at runtime. */
export type ActionType =
  | "notification.create"
  | "notification.whatsapp"
  | "notification.email"
  | "notification.sms"
  | "notification.push"
  | "webhook.call"
  | "pdf.generate"
  | "report.generate"
  | "task.create"
  | "record.update"
  | "delay"
  | "ai.generate";

export interface Action {
  type: ActionType;
  provider?: string; // optional override, e.g. "whatsapp.meta"
  params: Record<string, unknown>;
  /** Retry policy per action. */
  max_attempts?: number;
  /** Optional dedupe key template — collision skips the action. */
  dedupe_key?: string;
}

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  event_type: AutomationEventType;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type ExecutionStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "retrying";

export interface AutomationExecution {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  event_id: string | null;
  event_type: AutomationEventType;
  action_type: ActionType;
  provider: string | null;
  status: ExecutionStatus;
  attempt: number;
  max_attempts: number;
  duration_ms: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
  next_retry_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/** Context passed to every provider on dispatch. */
export interface ActionContext {
  tenantId: string;
  event: AutomationEvent;
  rule: AutomationRule | null;
  action: Action;
  attempt: number;
}

export interface ActionResult {
  ok: boolean;
  provider: string;
  data?: Record<string, unknown>;
  error?: string;
  /** When true the engine will schedule a retry (bounded by max_attempts). */
  retryable?: boolean;
}
