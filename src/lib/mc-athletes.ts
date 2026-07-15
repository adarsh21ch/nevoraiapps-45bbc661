import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MCAthlete = Database["public"]["Tables"]["mc_athlete_profiles"]["Row"];
export type MCAthleteInsert = Database["public"]["Tables"]["mc_athlete_profiles"]["Insert"];
export type MCAthleteUpdate = Database["public"]["Tables"]["mc_athlete_profiles"]["Update"];

export type MCCricket = Database["public"]["Tables"]["mc_cricket_profiles"]["Row"];
export type MCCricketInsert = Database["public"]["Tables"]["mc_cricket_profiles"]["Insert"];
export type MCCricketUpdate = Database["public"]["Tables"]["mc_cricket_profiles"]["Update"];

export type MCAchievement = Database["public"]["Tables"]["mc_athlete_achievements"]["Row"];
export type MCAchievementInsert = Database["public"]["Tables"]["mc_athlete_achievements"]["Insert"];

export type MCAward = Database["public"]["Tables"]["mc_athlete_awards"]["Row"];
export type MCAwardInsert = Database["public"]["Tables"]["mc_athlete_awards"]["Insert"];

export type MCTimelineEntry = Database["public"]["Tables"]["mc_athlete_timeline"]["Row"];
export type MCTimelineInsert = Database["public"]["Tables"]["mc_athlete_timeline"]["Insert"];

export type StudentLite = {
  id: string;
  name: string;
  photo_url: string | null;
  dob: string | null;
  gender: string | null;
  batch_id: string | null;
  status: string | null;
  player_id: string | null;
  phone: string | null;
};

/* -------- Enums / catalogs -------- */

export const PRIMARY_SPORTS = [
  { value: "cricket", label: "Cricket" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "badminton", label: "Badminton" },
  { value: "other", label: "Other" },
] as const;

export const DOMINANT_HANDS = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "ambidextrous", label: "Ambidextrous" },
] as const;

export const FITNESS_STATUSES = [
  { value: "fit", label: "Fit" },
  { value: "recovering", label: "Recovering" },
  { value: "injured", label: "Injured" },
  { value: "rest", label: "On rest" },
] as const;

export const ATHLETE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "retired", label: "Retired" },
] as const;

export const CRICKET_ROLES = [
  { value: "batter", label: "Batter" },
  { value: "bowler", label: "Bowler" },
  { value: "all_rounder", label: "All-rounder" },
  { value: "wicket_keeper", label: "Wicket keeper" },
] as const;

export const CRICKET_BATTING_STYLES = [
  { value: "right_hand", label: "Right-hand" },
  { value: "left_hand", label: "Left-hand" },
] as const;

export const CRICKET_BOWLING_STYLES = [
  "Right-arm fast",
  "Right-arm medium",
  "Left-arm fast",
  "Left-arm medium",
  "Off-spin",
  "Leg-spin",
  "Left-arm orthodox",
  "Left-arm chinaman",
] as const;

export const CRICKET_BOWLING_TYPES = [
  { value: "pace", label: "Pace" },
  { value: "spin", label: "Spin" },
  { value: "medium", label: "Medium" },
  { value: "none", label: "N/A" },
] as const;

export const ACHIEVEMENT_KINDS = [
  { value: "district", label: "District Selection" },
  { value: "division", label: "Division Selection" },
  { value: "state", label: "State Selection" },
  { value: "national", label: "National Selection" },
  { value: "academy_captain", label: "Academy Captain" },
  { value: "tournament_winner", label: "Tournament Winner" },
  { value: "player_of_tournament", label: "Player Of Tournament" },
  { value: "custom", label: "Custom" },
] as const;

export const AWARD_KINDS = [
  { value: "potm_match", label: "Player Of Match" },
  { value: "potm_month", label: "Player Of Month" },
  { value: "best_batter", label: "Best Batter" },
  { value: "best_bowler", label: "Best Bowler" },
  { value: "mvp", label: "MVP" },
  { value: "best_captain", label: "Best Captain" },
  { value: "most_improved", label: "Most Improved" },
  { value: "custom", label: "Custom" },
] as const;

export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/* -------- Students -------- */

export async function listStudents(tenantId: string): Promise<StudentLite[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, photo_url, dob, gender, batch_id, status, player_id, phone")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getStudent(tenantId: string, studentId: string): Promise<StudentLite | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, photo_url, dob, gender, batch_id, status, player_id, phone")
    .eq("tenant_id", tenantId)
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* -------- Athlete profile CRUD -------- */

export type AthleteWithStudent = MCAthlete & {
  student: StudentLite | null;
  cricket: MCCricket | null;
  team?: { id: string; name: string } | null;
};

export async function listAthletes(tenantId: string): Promise<AthleteWithStudent[]> {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .select(
      `*,
       student:students(id, name, photo_url, dob, gender, batch_id, status, player_id, phone),
       cricket:mc_cricket_profiles(*)`,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      cricket: MCCricket[] | MCCricket | null;
      student: StudentLite | null;
    } & MCAthlete;
    const cricket = Array.isArray(r.cricket) ? (r.cricket[0] ?? null) : (r.cricket ?? null);
    return { ...r, cricket, team: null } as AthleteWithStudent;
  });
}

export async function getAthlete(tenantId: string, athleteId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .select(
      `*,
       student:students(id, name, photo_url, dob, gender, batch_id, status, player_id, phone),
       cricket:mc_cricket_profiles(*)`,
    )
    .eq("tenant_id", tenantId)
    .eq("id", athleteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as {
    cricket: MCCricket[] | MCCricket | null;
    student: StudentLite | null;
  } & MCAthlete;
  const cricket = Array.isArray(r.cricket) ? (r.cricket[0] ?? null) : (r.cricket ?? null);
  return { ...r, cricket } as AthleteWithStudent;
}

export async function getAthleteByStudent(tenantId: string, studentId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data as MCAthlete | null;
}

export async function createAthlete(input: MCAthleteInsert) {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAthlete(id: string, input: MCAthleteUpdate) {
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAthlete(id: string) {
  const { error } = await supabase.from("mc_athlete_profiles").delete().eq("id", id);
  if (error) throw error;
}

/* -------- Cricket profile -------- */

export async function upsertCricketProfile(
  tenantId: string,
  athleteProfileId: string,
  input: Partial<MCCricket>,
) {
  const payload: MCCricketInsert = {
    tenant_id: tenantId,
    athlete_profile_id: athleteProfileId,
    ...input,
  };
  const { data, error } = await supabase
    .from("mc_cricket_profiles")
    .upsert(payload, { onConflict: "athlete_profile_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* -------- Achievements -------- */

export async function listAchievements(athleteId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_achievements")
    .select("*")
    .eq("athlete_profile_id", athleteId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAchievement(input: MCAchievementInsert) {
  const { data, error } = await supabase
    .from("mc_athlete_achievements")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAchievement(id: string, input: Partial<MCAchievement>) {
  const { data, error } = await supabase
    .from("mc_athlete_achievements")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAchievement(id: string) {
  const { error } = await supabase.from("mc_athlete_achievements").delete().eq("id", id);
  if (error) throw error;
}

/* -------- Awards -------- */

export async function listAwards(athleteId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_awards")
    .select("*")
    .eq("athlete_profile_id", athleteId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAward(input: MCAwardInsert) {
  const { data, error } = await supabase
    .from("mc_athlete_awards")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAward(id: string, input: Partial<MCAward>) {
  const { data, error } = await supabase
    .from("mc_athlete_awards")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAward(id: string) {
  const { error } = await supabase.from("mc_athlete_awards").delete().eq("id", id);
  if (error) throw error;
}

/* -------- Timeline -------- */

export async function listTimeline(athleteId: string) {
  const { data, error } = await supabase
    .from("mc_athlete_timeline")
    .select("*")
    .eq("athlete_profile_id", athleteId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTimelineEntry(input: MCTimelineInsert) {
  const { data, error } = await supabase
    .from("mc_athlete_timeline")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTimelineEntry(id: string, input: Partial<MCTimelineEntry>) {
  const { data, error } = await supabase
    .from("mc_athlete_timeline")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimelineEntry(id: string) {
  const { error } = await supabase.from("mc_athlete_timeline").delete().eq("id", id);
  if (error) throw error;
}

/* -------- Current team lookup -------- */

export async function findCurrentTeam(tenantId: string, studentId: string) {
  const { data, error } = await supabase
    .from("mc_team_players")
    .select("team:mc_teams(id, name)")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  const t = (data as unknown as { team: { id: string; name: string } | null } | null)?.team;
  return t ?? null;
}
