// Reports data layer — Phase 2 complete.
//
// This module is now a THIN client over server-side RPCs. Every report
// aggregation (SUM/COUNT/GROUP BY/percentages/trends/top-N) runs inside
// Postgres via SECURITY DEFINER functions that assert tenant membership.
// The browser only receives compact pre-aggregated JSON and renders it.
//
// If you find yourself adding `.reduce`, `.filter`, or `.map` here to
// compute a KPI, add it to the corresponding RPC instead. Keep this file
// as pass-through mapping only.
import { supabase } from "@/integrations/supabase/client";

export type Range = { from: string; to: string }; // ISO
export type Preset = "today" | "yesterday" | "7d" | "30d" | "quarter" | "year" | "custom";

export function presetRange(preset: Preset, custom?: Range): Range {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  let from: Date, to: Date;
  switch (preset) {
    case "today":
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = endOfDay(y);
      break;
    }
    case "7d":
      from = startOfDay(new Date(now.getTime() - 6 * 86400000));
      to = endOfDay(now);
      break;
    case "30d":
      from = startOfDay(new Date(now.getTime() - 29 * 86400000));
      to = endOfDay(now);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      to = endOfDay(now);
      break;
    }
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      to = endOfDay(now);
      break;
    case "custom":
      if (custom) return custom;
      from = startOfDay(new Date(now.getTime() - 29 * 86400000));
      to = endOfDay(now);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export const rqk = {
  attendance: (t: string, r: Range) => ["r", "att", t, r.from, r.to] as const,
  billing: (t: string, r: Range) => ["r", "bill", t, r.from, r.to] as const,
  admissions: (t: string, r: Range) => ["r", "adm", t, r.from, r.to] as const,
  players: (t: string, r: Range) => ["r", "ply", t, r.from, r.to] as const,
  matches: (t: string, r: Range) => ["r", "mch", t, r.from, r.to] as const,
  comms: (t: string, r: Range) => ["r", "cmm", t, r.from, r.to] as const,
  website: (t: string, r: Range) => ["r", "web", t, r.from, r.to] as const,
};

// -------- Shared RPC caller ------------------------------------------------
async function callReportRpc<T>(name: string, tenantId: string, r: Range): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(name, {
    _tenant_id: tenantId,
    _from: r.from,
    _to: r.to,
  });
  if (error) throw error;
  return data as T;
}

// ---------------- Attendance ---------------------------------------------
export type AttendanceReport = {
  totalMarks: number;
  present: number;
  absent: number;
  late: number;
  percent: number;
  sessions: number;
  daily: { date: string; present: number; absent: number; percent: number }[];
  perBatch: { batch: string; present: number; total: number; percent: number }[];
  topStudents: { name: string; percent: number; present: number; total: number }[];
  lowStudents: { name: string; percent: number; present: number; total: number }[];
};
export const fetchAttendanceReport = (tenantId: string, r: Range) =>
  callReportRpc<AttendanceReport>("get_report_attendance", tenantId, r);

// ---------------- Billing (owner) ----------------------------------------
export type BillingReport = {
  revenue: number;
  paymentsCount: number;
  avgPayment: number;
  byMonth: { label: string; amount: number }[];
  byMethod: { label: string; amount: number }[];
  byType: { label: string; amount: number }[];
  pendingStudents: number;
  pendingApprox: number;
  collectionRate: number;
};
export const fetchBillingReport = (tenantId: string, r: Range) =>
  callReportRpc<BillingReport>("get_report_billing", tenantId, r);

// ---------------- Admissions --------------------------------------------
export type AdmissionsReport = {
  totalLeads: number;
  byStage: { stage: string; count: number }[];
  bySource: { label: string; count: number }[];
  conversion: number;
  avgConversionDays: number | null;
  trials: number;
  converted: number;
  rejected: number;
};
export const fetchAdmissionsReport = (tenantId: string, r: Range) =>
  callReportRpc<AdmissionsReport>("get_report_admissions", tenantId, r);

// ---------------- Players -----------------------------------------------
export type PlayersReport = {
  active: number;
  inactive: number;
  graduated: number;
  newInRange: number;
  byBatch: { label: string; count: number }[];
  byAgeGroup: { label: string; count: number }[];
  byRole: { label: string; count: number }[];
  retention: number;
};
export const fetchPlayersReport = (tenantId: string, r: Range) =>
  callReportRpc<PlayersReport>("get_report_players", tenantId, r);

// ---------------- Matches -----------------------------------------------
export type MatchesReport = {
  total: number;
  completed: number;
  upcoming: number;
  live: number;
  byResult: { label: string; count: number }[];
  topScorers: { name: string; runs: number }[];
};
export const fetchMatchesReport = (tenantId: string, r: Range) =>
  callReportRpc<MatchesReport>("get_report_matches", tenantId, r);

// ---------------- Communications ----------------------------------------
export type CommsReport = {
  campaigns: number;
  sent: number;
  delivered: number;
  failed: number;
  byCategory: { label: string; count: number }[];
  byStatus: { label: string; count: number }[];
};
export async function fetchCommsReport(tenantId: string, r: Range): Promise<CommsReport> {
  // Server-aggregated via get_communication_summary. The shape mapping below
  // is a rename — no aggregation happens in the browser.
  const { getCommunicationSummary } = await import("./aggregations");
  const s = await getCommunicationSummary(tenantId, {
    from: r.from.slice(0, 10),
    to: r.to.slice(0, 10),
  });
  const byStatus: { label: string; count: number }[] = [
    { label: "sent", count: s.sent },
    { label: "failed", count: s.failed },
    { label: "draft", count: s.draft },
  ].filter((x) => x.count > 0);
  const byCategory = Object.entries(s.by_category).map(([label, count]) => ({ label, count }));
  return {
    campaigns: s.total_campaigns,
    sent: s.total_delivered,
    delivered: s.total_delivered,
    failed: s.total_failed,
    byCategory,
    byStatus,
  };
}

// ---------------- Website ----------------------------------------------
export type WebsiteReport = {
  webRegistrations: number;
  webLeads: number;
  bySource: { label: string; count: number }[];
};
export const fetchWebsiteReport = (tenantId: string, r: Range) =>
  callReportRpc<WebsiteReport>("get_report_website", tenantId, r);

// ---------------- CSV export (presentation utility, not aggregation) ----
export function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
