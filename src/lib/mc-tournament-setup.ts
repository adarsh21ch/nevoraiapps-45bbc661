/* ================================================================
 * Tournament Setup — Groups, Venues, Officials + Validation
 * ----------------------------------------------------------------
 * Reusable foundation for the Fixture Engine and Match Center.
 *
 * Reuses existing entities:
 *   - Teams        → mc_teams
 *   - Players      → students / mc_team_players
 *   - Matches      → mc_matches (venue_id / group_id / round_id / matchday_no)
 *   - Officials    → mc_athletes (staff) OR free-form name
 *
 * This module owns NO statistics — it only defines structural setup.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TournamentGroup = Database["public"]["Tables"]["mc_tournament_groups"]["Row"];
export type TournamentGroupInsert = Database["public"]["Tables"]["mc_tournament_groups"]["Insert"];
export type TournamentGroupUpdate = Database["public"]["Tables"]["mc_tournament_groups"]["Update"];

export type TournamentVenue = Database["public"]["Tables"]["mc_tournament_venues"]["Row"];
export type TournamentVenueInsert = Database["public"]["Tables"]["mc_tournament_venues"]["Insert"];
export type TournamentVenueUpdate = Database["public"]["Tables"]["mc_tournament_venues"]["Update"];

export type TournamentOfficial = Database["public"]["Tables"]["mc_tournament_officials"]["Row"];
export type TournamentOfficialInsert =
  Database["public"]["Tables"]["mc_tournament_officials"]["Insert"];
export type TournamentOfficialUpdate =
  Database["public"]["Tables"]["mc_tournament_officials"]["Update"];

export const OFFICIAL_ROLES = [
  { value: "umpire", label: "Umpire" },
  { value: "scorer", label: "Scorer" },
  { value: "referee", label: "Match Referee" },
  { value: "third_umpire", label: "Third Umpire" },
] as const;

export const PITCH_TYPES = ["Turf", "Mat", "Cement", "Astro-turf"] as const;

/* ================================================================
 * GROUPS
 * ================================================================ */

export async function listGroups(tournamentId: string) {
  const { data, error } = await supabase
    .from("mc_tournament_groups")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(input: TournamentGroupInsert) {
  const { data, error } = await supabase
    .from("mc_tournament_groups")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateGroup(id: string, patch: TournamentGroupUpdate) {
  const { error } = await supabase.from("mc_tournament_groups").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(id: string) {
  // First, clear any assignments so we don't orphan tournament_teams rows.
  await supabase.from("mc_tournament_teams").update({ group_id: null }).eq("group_id", id);
  const { error } = await supabase.from("mc_tournament_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function assignTeamToGroup(tournamentTeamId: string, groupId: string | null) {
  const { error } = await supabase
    .from("mc_tournament_teams")
    .update({ group_id: groupId })
    .eq("id", tournamentTeamId);
  if (error) throw error;
}

/** Create N evenly-named groups (A, B, C, …) and distribute teams round-robin. */
export async function autoGenerateGroups(input: {
  tenantId: string;
  tournamentId: string;
  groupCount: number;
  teamIds: string[]; // mc_tournament_teams.id (registration ids)
  qualifyPerGroup?: number;
}) {
  const { tenantId, tournamentId, groupCount, teamIds } = input;
  if (groupCount < 1) throw new Error("Need at least one group");

  // Clear existing groups + assignments so re-run is idempotent.
  const existing = await listGroups(tournamentId);
  if (existing.length > 0) {
    await supabase
      .from("mc_tournament_teams")
      .update({ group_id: null })
      .eq("tournament_id", tournamentId);
    await supabase.from("mc_tournament_groups").delete().eq("tournament_id", tournamentId);
  }

  const letters = "ABCDEFGHIJKLMNOP".slice(0, groupCount).split("");
  const rows: TournamentGroupInsert[] = letters.map((letter, i) => ({
    tenant_id: tenantId,
    tournament_id: tournamentId,
    name: `Group ${letter}`,
    display_order: i,
    qualify_count: input.qualifyPerGroup ?? 2,
  }));
  const { data: groups, error } = await supabase
    .from("mc_tournament_groups")
    .insert(rows)
    .select("*");
  if (error) throw error;

  const groupList = groups ?? [];
  // Snake distribution → keeps groups balanced.
  const assignments: { id: string; group_id: string }[] = [];
  teamIds.forEach((teamRegId, i) => {
    const rowIdx = Math.floor(i / groupCount);
    const colIdx = i % groupCount;
    const groupIdx = rowIdx % 2 === 0 ? colIdx : groupCount - 1 - colIdx;
    const group = groupList[groupIdx];
    if (group) assignments.push({ id: teamRegId, group_id: group.id });
  });

  for (const a of assignments) {
    await supabase.from("mc_tournament_teams").update({ group_id: a.group_id }).eq("id", a.id);
  }

  return groupList;
}

/* ================================================================
 * VENUES
 * ================================================================ */

export async function listVenues(tournamentId: string) {
  const { data, error } = await supabase
    .from("mc_tournament_venues")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createVenue(input: TournamentVenueInsert) {
  const { data, error } = await supabase
    .from("mc_tournament_venues")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateVenue(id: string, patch: TournamentVenueUpdate) {
  const { error } = await supabase.from("mc_tournament_venues").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteVenue(id: string) {
  await supabase.from("mc_matches").update({ venue_id: null }).eq("venue_id", id);
  const { error } = await supabase.from("mc_tournament_venues").delete().eq("id", id);
  if (error) throw error;
}

export async function assignMatchToVenue(matchId: string, venueId: string | null) {
  const { error } = await supabase
    .from("mc_matches")
    .update({ venue_id: venueId })
    .eq("id", matchId);
  if (error) throw error;
}

/* ================================================================
 * OFFICIALS
 * ================================================================ */

export async function listOfficials(tournamentId: string) {
  const { data, error } = await supabase
    .from("mc_tournament_officials")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("role", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createOfficial(input: TournamentOfficialInsert) {
  const { data, error } = await supabase
    .from("mc_tournament_officials")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateOfficial(id: string, patch: TournamentOfficialUpdate) {
  const { error } = await supabase.from("mc_tournament_officials").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOfficial(id: string) {
  const { error } = await supabase.from("mc_tournament_officials").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================
 * READINESS VALIDATION
 * ----------------------------------------------------------------
 * Consumed by the Setup Progress panel AND by the Fixture Engine
 * (Step 4) before allowing fixture generation.
 * ================================================================ */

export interface SetupCheck {
  id:
    | "teams_registered"
    | "teams_have_players"
    | "groups_configured"
    | "venues_configured"
    | "officials_configured"
    | "no_venue_conflicts";
  label: string;
  status: "ok" | "warn" | "fail";
  detail?: string;
}

export interface ReadinessReport {
  checks: SetupCheck[];
  canGenerateFixtures: boolean;
}

export async function evaluateReadiness(input: {
  tournamentId: string;
  hasGroups: boolean;
  minPlayersPerTeam?: number;
}): Promise<ReadinessReport> {
  const { tournamentId, hasGroups } = input;
  const minPlayers = input.minPlayersPerTeam ?? 7;

  // Registered teams + player counts (one round-trip per concern).
  const [teamsRes, groupsRes, venuesRes, officialsRes, matchesRes] = await Promise.all([
    supabase
      .from("mc_tournament_teams")
      .select("id, team_id, group_id, team:mc_teams(id, name, mc_team_players(count))")
      .eq("tournament_id", tournamentId),
    supabase.from("mc_tournament_groups").select("id").eq("tournament_id", tournamentId),
    supabase.from("mc_tournament_venues").select("id").eq("tournament_id", tournamentId),
    supabase.from("mc_tournament_officials").select("id, role").eq("tournament_id", tournamentId),
    supabase
      .from("mc_matches")
      .select("id, venue_id, scheduled_date, scheduled_time")
      .eq("tournament_id", tournamentId),
  ]);

  const teams = teamsRes.data ?? [];
  const groups = groupsRes.data ?? [];
  const venues = venuesRes.data ?? [];
  const officials = officialsRes.data ?? [];
  const matches = matchesRes.data ?? [];

  const checks: SetupCheck[] = [];

  // 1) Enough teams
  checks.push({
    id: "teams_registered",
    label: "At least 2 teams registered",
    status: teams.length >= 2 ? "ok" : "fail",
    detail: `${teams.length} team${teams.length === 1 ? "" : "s"}`,
  });

  // 2) Teams have enough players
  const shortRoster = teams.filter((t) => {
    const team = Array.isArray(t.team) ? t.team[0] : t.team;
    const players = team?.mc_team_players;
    const count =
      Array.isArray(players) && players[0] ? (players[0] as { count: number }).count : 0;
    return count < minPlayers;
  });
  checks.push({
    id: "teams_have_players",
    label: `Every team has at least ${minPlayers} players`,
    status: teams.length === 0 ? "warn" : shortRoster.length === 0 ? "ok" : "fail",
    detail:
      shortRoster.length === 0
        ? undefined
        : `${shortRoster.length} team${shortRoster.length === 1 ? "" : "s"} under ${minPlayers} players`,
  });

  // 3) Groups (only when tournament uses group stage)
  if (hasGroups) {
    const unassigned = teams.filter((t) => !t.group_id).length;
    checks.push({
      id: "groups_configured",
      label: "Group stage teams assigned",
      status: groups.length === 0 || unassigned > 0 ? "fail" : "ok",
      detail:
        groups.length === 0
          ? "No groups configured"
          : unassigned > 0
            ? `${unassigned} team${unassigned === 1 ? "" : "s"} not assigned to a group`
            : undefined,
    });
  }

  // 4) Venues
  checks.push({
    id: "venues_configured",
    label: "At least one venue defined",
    status: venues.length >= 1 ? "ok" : "warn",
    detail: venues.length === 0 ? "Add venues to assign fixtures" : undefined,
  });

  // 5) Officials (soft recommendation)
  const hasUmpire = officials.some((o) => o.role === "umpire");
  const hasScorer = officials.some((o) => o.role === "scorer");
  checks.push({
    id: "officials_configured",
    label: "At least one umpire and one scorer",
    status: hasUmpire && hasScorer ? "ok" : "warn",
    detail:
      hasUmpire && hasScorer
        ? undefined
        : !hasUmpire && !hasScorer
          ? "No umpires or scorers"
          : !hasUmpire
            ? "No umpires"
            : "No scorers",
  });

  // 6) Scheduling conflicts — same venue + same date + time within 4 hours.
  const conflicts = findVenueScheduleConflicts(matches);
  checks.push({
    id: "no_venue_conflicts",
    label: "No overlapping venue bookings",
    status: conflicts === 0 ? "ok" : "fail",
    detail:
      conflicts === 0 ? undefined : `${conflicts} overlapping fixture${conflicts === 1 ? "" : "s"}`,
  });

  // Fail = blocking. Warn = advisory.
  const canGenerateFixtures = !checks.some(
    (c) => c.status === "fail" && c.id !== "no_venue_conflicts",
  );

  return { checks, canGenerateFixtures };
}

/** Return the number of fixtures sharing the same venue + start date + time. */
export function findVenueScheduleConflicts(
  matches: {
    venue_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  }[],
): number {
  const buckets = new Map<string, number>();
  for (const m of matches) {
    if (!m.venue_id || !m.scheduled_date) continue;
    const key = `${m.venue_id}|${m.scheduled_date}|${m.scheduled_time ?? ""}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  let overlaps = 0;
  for (const count of buckets.values()) {
    if (count > 1) overlaps += count - 1;
  }
  return overlaps;
}
