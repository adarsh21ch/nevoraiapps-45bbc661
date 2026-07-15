import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MCTeam = Database["public"]["Tables"]["mc_teams"]["Row"];
export type MCTeamInsert = Database["public"]["Tables"]["mc_teams"]["Insert"];
export type MCTeamUpdate = Database["public"]["Tables"]["mc_teams"]["Update"];
export type MCTeamPlayer = Database["public"]["Tables"]["mc_team_players"]["Row"];
export type MCTeamPlayerInsert = Database["public"]["Tables"]["mc_team_players"]["Insert"];

export type Student = Database["public"]["Tables"]["students"]["Row"];

export const AGE_GROUPS = ["U10", "U12", "U14", "U16", "U19", "Senior", "Girls", "Custom"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const TEAM_STATUSES = ["active", "inactive", "archived"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const PLAYER_ROLES = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all_rounder", label: "All-rounder" },
  { value: "wicket_keeper", label: "Wicket keeper" },
] as const;

export const BATTING_STYLES = [
  { value: "right_hand", label: "Right-hand" },
  { value: "left_hand", label: "Left-hand" },
] as const;

export const BOWLING_STYLES = [
  "Right-arm fast",
  "Right-arm medium",
  "Left-arm fast",
  "Left-arm medium",
  "Off-spin",
  "Leg-spin",
  "Left-arm orthodox",
  "Left-arm chinaman",
] as const;

export async function listTeams(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_teams")
    .select("*, mc_team_players(count)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    player_count:
      Array.isArray(t.mc_team_players) && t.mc_team_players[0]
        ? (t.mc_team_players[0] as { count: number }).count
        : 0,
  }));
}

export type TeamWithCount = Awaited<ReturnType<typeof listTeams>>[number];

export async function getTeam(tenantId: string, teamId: string) {
  const { data, error } = await supabase
    .from("mc_teams")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTeamPlayers(teamId: string) {
  const { data, error } = await supabase
    .from("mc_team_players")
    .select("*")
    .eq("team_id", teamId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listStudents(tenantId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, photo_url, dob, gender, batch_id, status, player_id, phone")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export type StudentLite = Awaited<ReturnType<typeof listStudents>>[number];

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export async function createTeam(input: MCTeamInsert) {
  const { data, error } = await supabase.from("mc_teams").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, input: MCTeamUpdate) {
  const { data, error } = await supabase
    .from("mc_teams")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id: string) {
  const { error } = await supabase.from("mc_teams").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateTeam(tenantId: string, teamId: string) {
  const source = await getTeam(tenantId, teamId);
  if (!source) throw new Error("Team not found");
  const players = await listTeamPlayers(teamId);
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = source;
  const copy = await createTeam({
    ...rest,
    name: `${source.name} (Copy)`,
    captain_student_id: null,
    vice_captain_student_id: null,
    keeper_student_id: null,
  });
  if (players.length) {
    const rows: MCTeamPlayerInsert[] = players.map((p) => ({
      tenant_id: tenantId,
      team_id: copy.id,
      student_id: p.student_id,
      role: p.role,
      batting_style: p.batting_style,
      bowling_style: p.bowling_style,
      jersey_number: p.jersey_number,
      is_captain: false,
      is_vice_captain: false,
      is_keeper: false,
    }));
    const { error } = await supabase.from("mc_team_players").insert(rows);
    if (error) throw error;
  }
  return copy;
}

export async function addPlayersToTeam(tenantId: string, teamId: string, studentIds: string[]) {
  if (!studentIds.length) return;
  const rows: MCTeamPlayerInsert[] = studentIds.map((sid) => ({
    tenant_id: tenantId,
    team_id: teamId,
    student_id: sid,
  }));
  const { error } = await supabase
    .from("mc_team_players")
    .upsert(rows, { onConflict: "team_id,student_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removePlayerFromTeam(teamId: string, studentId: string) {
  const { error } = await supabase
    .from("mc_team_players")
    .delete()
    .eq("team_id", teamId)
    .eq("student_id", studentId);
  if (error) throw error;
}

export async function updateTeamPlayer(
  teamId: string,
  studentId: string,
  patch: Partial<MCTeamPlayer>,
) {
  const { error } = await supabase
    .from("mc_team_players")
    .update(patch)
    .eq("team_id", teamId)
    .eq("student_id", studentId);
  if (error) throw error;
}

export async function setCaptaincy(
  teamId: string,
  field: "captain_student_id" | "vice_captain_student_id" | "keeper_student_id",
  studentId: string | null,
) {
  const patch: MCTeamUpdate = { [field]: studentId } as MCTeamUpdate;
  const { error } = await supabase.from("mc_teams").update(patch).eq("id", teamId);
  if (error) throw error;
}
