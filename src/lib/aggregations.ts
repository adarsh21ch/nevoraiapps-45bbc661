/**
 * Phase 2 — Server-side Aggregation Layer.
 *
 * Every function here is a thin wrapper around a Postgres RPC that returns a
 * compact JSON summary. The browser NEVER aggregates raw rows for reports,
 * dashboards, or tournaments — it only renders these pre-computed responses.
 *
 * Security: every RPC is SECURITY DEFINER and asserts
 * `is_tenant_member(auth.uid(), _tenant_id)` before returning. Callers pass
 * the tenant id; RLS parity is enforced inside the RPC.
 */
import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// Query-key helper — one convention for all aggregation queries so any part of
// the app can invalidate a domain cache cleanly.
// -----------------------------------------------------------------------------
export const aggKey = (domain: string, tenantId: string, params?: Record<string, unknown>) =>
  ["agg", domain, tenantId, params ?? null] as const;

// -----------------------------------------------------------------------------
// Types (compact — mirror what each RPC returns)
// -----------------------------------------------------------------------------
export type DashboardSummary = {
  total_students: number;
  active_students: number;
  archived_students: number;
  present_today: number;
  absent_today: number;
  sessions_today: number;
  pending_registrations: number;
  new_registrations_7d: number;
  collected_this_month: number;
  collected_billing_this_month: number;
  outstanding_balance: number;
  overdue_invoices: number;
  live_matches: number;
  upcoming_matches: number;
  active_batches: number;
  unread_leads: number;
  as_of: string;
};

export type AttendanceTrendPoint = { date: string; present: number; absent: number; total: number };
export type AtRiskStudent = {
  student_id: string;
  name: string;
  absences: number;
  total: number;
  absent_pct: number;
};
export type AttendanceSummary = {
  range: { from: string; to: string };
  total_marks: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_pct: number | null;
  trend: AttendanceTrendPoint[];
  at_risk: AtRiskStudent[];
};

export type FinanceSummary = {
  range: { from: string; to: string };
  collected: number;
  outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  invoice_status: Record<string, { count: number; total: number }>;
  trend: { month: string; collected: number }[];
  top_defaulters: {
    student_id: string;
    name: string;
    outstanding: number;
    invoices: number;
    latest_due: string | null;
  }[];
};

export type RegistrationSummary = {
  range: { from: string; to: string };
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  conversion_pct: number | null;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  trend: { week: string; count: number }[];
};

export type CommunicationSummary = {
  range: { from: string; to: string };
  total_campaigns: number;
  sent: number;
  failed: number;
  draft: number;
  total_recipients: number;
  total_delivered: number;
  total_failed: number;
  delivery_pct: number | null;
  by_category: Record<string, number>;
  recent: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    recipient_count: number;
    delivered_count: number;
    failed_count: number;
    sent_at: string | null;
    created_at: string;
  }>;
};

export type StudentsSummary = {
  total: number;
  archived: number;
  by_status: Record<string, number>;
  by_gender: Record<string, number>;
  by_batch: { name: string; count: number }[];
  age_buckets: { u10: number; a10_12: number; a13_15: number; a16_18: number; a18p: number };
  joined_trend: { month: string; count: number }[];
};

export type AcademyHealth = {
  score: number;
  attendance_pct: number | null;
  collection_pct: number | null;
  retention_pct: number | null;
  admissions_momentum_pct: number | null;
  delivery_pct: number | null;
  as_of: string;
};

export type TournamentSummary = {
  total: number;
  completed: number;
  live: number;
  upcoming: number;
  by_status: Record<string, number>;
};

export type PointsTableRow = {
  team_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
};

export type TopBatter = {
  athlete_profile_id: string;
  name: string;
  runs: number;
  matches: number;
  highest_score: number | null;
  average: number | null;
  strike_rate: number | null;
};
export type TopBowler = {
  athlete_profile_id: string;
  name: string;
  wickets: number;
  matches: number;
  best_bowling: string | null;
  average: number | null;
  economy_rate: number | null;
};

export type AcademyRecordsSummary = {
  total: number;
  top: Array<{
    id: string;
    record_type: string;
    title: string;
    value: string | null;
    holder_name: string | null;
    achieved_at: string | null;
  }>;
};

export type AiReportInputs = {
  dashboard: DashboardSummary;
  health: AcademyHealth;
  attendance: AttendanceSummary;
  finance: FinanceSummary;
  registrations: RegistrationSummary;
  communication: CommunicationSummary;
};

// -----------------------------------------------------------------------------
// Runtime helpers
// -----------------------------------------------------------------------------
async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data as T;
}

const toIsoDate = (d: Date | string | undefined | null): string | null =>
  d == null ? null : typeof d === "string" ? d : d.toISOString().slice(0, 10);

// -----------------------------------------------------------------------------
// Public API — one function per RPC.
// -----------------------------------------------------------------------------
export const getDashboardSummary = (tenantId: string) =>
  callRpc<DashboardSummary>("get_dashboard_summary", { _tenant_id: tenantId });

export const getAttendanceSummary = (
  tenantId: string,
  opts: { from?: Date | string; to?: Date | string; batchId?: string | null } = {},
) =>
  callRpc<AttendanceSummary>("get_attendance_summary", {
    _tenant_id: tenantId,
    _from: toIsoDate(opts.from),
    _to: toIsoDate(opts.to),
    _batch_id: opts.batchId ?? null,
  });

export const getFinanceSummary = (
  tenantId: string,
  opts: { from?: Date | string; to?: Date | string } = {},
) =>
  callRpc<FinanceSummary>("get_finance_summary", {
    _tenant_id: tenantId,
    _from: toIsoDate(opts.from),
    _to: toIsoDate(opts.to),
  });

export const getRegistrationSummary = (
  tenantId: string,
  opts: { from?: Date | string; to?: Date | string } = {},
) =>
  callRpc<RegistrationSummary>("get_registration_summary", {
    _tenant_id: tenantId,
    _from: toIsoDate(opts.from),
    _to: toIsoDate(opts.to),
  });

export const getCommunicationSummary = (
  tenantId: string,
  opts: { from?: Date | string; to?: Date | string } = {},
) =>
  callRpc<CommunicationSummary>("get_communication_summary", {
    _tenant_id: tenantId,
    _from: toIsoDate(opts.from),
    _to: toIsoDate(opts.to),
  });

export const getStudentsSummary = (tenantId: string) =>
  callRpc<StudentsSummary>("get_students_summary", { _tenant_id: tenantId });

export const getAcademyHealth = (tenantId: string) =>
  callRpc<AcademyHealth>("get_academy_health", { _tenant_id: tenantId });

export const getTournamentSummary = (tenantId: string, tournamentId?: string | null) =>
  callRpc<TournamentSummary>("get_tournament_summary", {
    _tenant_id: tenantId,
    _tournament_id: tournamentId ?? null,
  });

export const getPointsTable = (tournamentId: string) =>
  callRpc<PointsTableRow[]>("get_points_table", { _tournament_id: tournamentId });

export const getTopPerformers = (
  tenantId: string,
  kind: "batting" | "bowling" = "batting",
  limit = 10,
  tournamentId?: string | null,
) =>
  callRpc<(TopBatter | TopBowler)[]>("get_top_performers", {
    _tenant_id: tenantId,
    _kind: kind,
    _limit: limit,
    _tournament_id: tournamentId ?? null,
  });

export const getAcademyRecordsSummary = (tenantId: string) =>
  callRpc<AcademyRecordsSummary>("get_academy_records_summary", { _tenant_id: tenantId });

export const getAiReportInputs = (
  tenantId: string,
  opts: { from?: Date | string; to?: Date | string } = {},
) =>
  callRpc<AiReportInputs>("get_ai_report_inputs", {
    _tenant_id: tenantId,
    _from: toIsoDate(opts.from),
    _to: toIsoDate(opts.to),
  });
