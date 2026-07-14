import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 02.6 — Registration & Player Management helpers.
 * Kept small & side-effect-free so it can be composed into the existing
 * dashboard.students.tsx and BulkImportStudents without a rewrite.
 */

export const PLAYER_STATUSES = [
  { value: "active", label: "Active", tone: "emerald" },
  { value: "trial", label: "Trial", tone: "amber" },
  { value: "paused", label: "Inactive", tone: "slate" },
  { value: "suspended", label: "Suspended", tone: "rose" },
  { value: "graduated", label: "Graduated", tone: "indigo" },
  { value: "transferred", label: "Transferred", tone: "sky" },
  { value: "left", label: "Archived", tone: "zinc" },
] as const;

export type PlayerStatus = (typeof PLAYER_STATUSES)[number]["value"];

export const PLAYING_ROLES = [
  "Batter",
  "Bowler",
  "All-rounder",
  "Wicket-keeper",
  "Wicket-keeper batter",
] as const;

export const BATTING_STYLES = ["Right-hand", "Left-hand"] as const;
export const BOWLING_STYLES = [
  "Right-arm fast",
  "Right-arm medium",
  "Right-arm off-spin",
  "Right-arm leg-spin",
  "Left-arm fast",
  "Left-arm medium",
  "Left-arm orthodox",
  "Left-arm chinaman",
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Age in years, or null if DOB missing/invalid. */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export const AGE_GROUPS = [
  { key: "u10", label: "Under 10", min: 0, max: 9 },
  { key: "u12", label: "Under 12", min: 10, max: 11 },
  { key: "u14", label: "Under 14", min: 12, max: 13 },
  { key: "u16", label: "Under 16", min: 14, max: 15 },
  { key: "u19", label: "Under 19", min: 16, max: 18 },
  { key: "sr", label: "Senior 19+", min: 19, max: 999 },
] as const;

export function inAgeGroup(age: number | null, key: string): boolean {
  const g = AGE_GROUPS.find((a) => a.key === key);
  if (!g || age === null) return false;
  return age >= g.min && age <= g.max;
}

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

export type DupeReport = {
  phoneDupes: Map<string, number>; // phone -> existing count in tenant
  similarNames: Map<string, string[]>; // input name -> existing similar names
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function detectDuplicates(
  incoming: { name: string; phone: string }[],
  existing: { name: string; phone: string | null }[],
): DupeReport {
  const existingByPhone = new Set(existing.map((s) => (s.phone || "").replace(/\s+/g, "")));
  const existingNames = existing.map((s) => norm(s.name));

  const phoneDupes = new Map<string, number>();
  const similarNames = new Map<string, string[]>();

  const seenPhones = new Set<string>();
  for (const r of incoming) {
    const p = (r.phone || "").replace(/\s+/g, "");
    if (p && (existingByPhone.has(p) || seenPhones.has(p))) {
      phoneDupes.set(p, (phoneDupes.get(p) ?? 0) + 1);
    }
    if (p) seenPhones.add(p);

    const nn = norm(r.name);
    const hits = existingNames.filter(
      (e) => e === nn || (nn.length > 3 && (e.includes(nn) || nn.includes(e))),
    );
    if (hits.length > 0) similarNames.set(r.name, hits.slice(0, 3));
  }
  return { phoneDupes, similarNames };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

const EXPORT_COLUMNS = [
  ["player_id", "Player ID"],
  ["name", "Name"],
  ["phone", "Mobile"],
  ["email", "Email"],
  ["dob", "DOB"],
  ["gender", "Gender"],
  ["playing_role", "Playing role"],
  ["batting_style", "Batting"],
  ["bowling_style", "Bowling"],
  ["batch_name", "Batch"],
  ["coach_name", "Coach"],
  ["joined_at", "Joined"],
  ["status", "Status"],
  ["guardian_name", "Parent"],
  ["guardian_phone", "Parent phone"],
  ["emergency_contact_name", "Emergency contact"],
  ["emergency_contact_phone", "Emergency phone"],
  ["school_college", "School / College"],
  ["blood_group", "Blood group"],
  ["city", "City"],
  ["state", "State"],
] as const;

export function exportStudents(
  rows: Record<string, any>[],
  batchNameById: Map<string, string>,
  format: "csv" | "xlsx",
) {
  const shaped = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, label] of EXPORT_COLUMNS) {
      const v =
        k === "batch_name"
          ? batchNameById.get(r.batch_id) ?? ""
          : r[k] ?? "";
      out[label] = v == null ? "" : String(v);
    }
    return out;
  });

  const ws = XLSX.utils.json_to_sheet(shaped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Players");
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    XLSX.writeFile(wb, `players-${stamp}.csv`, { bookType: "csv" });
  } else {
    XLSX.writeFile(wb, `players-${stamp}.xlsx`);
  }
}

/* ------------------------------------------------------------------ */
/* Archive / reactivate                                                */
/* ------------------------------------------------------------------ */

export async function archiveStudent(id: string, reason?: string) {
  const { error } = await (supabase.from("students") as any)
    .update({
      status: "left",
      archived_at: new Date().toISOString(),
      archive_reason: reason ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function reactivateStudent(id: string) {
  const { error } = await (supabase.from("students") as any)
    .update({
      status: "active",
      archived_at: null,
      archive_reason: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setStudentStatus(
  id: string,
  status: PlayerStatus,
  reason?: string,
) {
  const patch: Record<string, unknown> = { status };
  if (status === "left") {
    patch.archived_at = new Date().toISOString();
    patch.archive_reason = reason ?? null;
  } else {
    patch.archived_at = null;
    patch.archive_reason = null;
  }
  const { error } = await (supabase.from("students") as any).update(patch).eq("id", id);
  if (error) throw error;
}
