/* ================================================================
 * Tournament Management
 * ----------------------------------------------------------------
 * CRUD + fixtures + team registration.
 *
 * The Tournament Engine ORCHESTRATES data — it does not own statistics.
 * All numeric aggregation delegates to the Statistics Engine.
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createMatch } from "@/lib/mc-matches";

export type MCTournament = Database["public"]["Tables"]["mc_tournaments"]["Row"];
export type MCTournamentInsert = Database["public"]["Tables"]["mc_tournaments"]["Insert"];
export type MCTournamentUpdate = Database["public"]["Tables"]["mc_tournaments"]["Update"];
export type MCTournamentTeam = Database["public"]["Tables"]["mc_tournament_teams"]["Row"];

export const TOURNAMENT_TYPES = [
  { value: "league", label: "League" },
  { value: "knockout", label: "Knockout" },
  { value: "round_robin", label: "Round Robin" },
  { value: "league_knockout", label: "League + Knockout" },
  { value: "practice_series", label: "Practice Series" },
  { value: "custom", label: "Custom" },
] as const;

export const TOURNAMENT_FORMATS = ["T10", "T20", "ODI", "Test", "Custom"] as const;
export const TOURNAMENT_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"] as const;
export const TOURNAMENT_VISIBILITIES = ["internal", "academy", "public"] as const;

/* ================================================================
 * Slug helpers — slugs are for public URLs only; UUIDs remain the
 * internal identifier. Uniqueness is scoped per tenant.
 * ================================================================ */

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "tournament"
  );
}

/** Ensure the slug is unique within a tenant, suffixing -2, -3, … as needed. */
export async function generateUniqueSlug(tenantId: string, base: string): Promise<string> {
  const root = slugify(base);
  const { data, error } = await supabase
    .from("mc_tournaments")
    .select("slug")
    .eq("tenant_id", tenantId)
    .like("slug", `${root}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => r.slug).filter(Boolean) as string[]);
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

/* ================================================================
 * CRUD
 * ================================================================ */

export async function listTournaments(tenantId: string): Promise<MCTournament[]> {
  const { data, error } = await supabase
    .from("mc_tournaments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTournament(id: string): Promise<MCTournament | null> {
  const { data, error } = await supabase
    .from("mc_tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTournament(input: MCTournamentInsert): Promise<MCTournament> {
  const { data, error } = await supabase.from("mc_tournaments").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTournament(
  id: string,
  patch: MCTournamentUpdate,
): Promise<MCTournament> {
  const { data, error } = await supabase
    .from("mc_tournaments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from("mc_tournaments").delete().eq("id", id);
  if (error) throw error;
}

/* ================================================================
 * Team registration
 * ================================================================ */

export interface TournamentTeamWithTeam extends MCTournamentTeam {
  team: {
    id: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
    is_external: boolean | null;
    team_color: string | null;
  } | null;
}

export async function listTournamentTeams(tournamentId: string): Promise<TournamentTeamWithTeam[]> {
  const { data, error } = await supabase
    .from("mc_tournament_teams")
    .select(`*, team:mc_teams(id, name, short_name, logo_url, is_external, team_color)`)
    .eq("tournament_id", tournamentId)
    .order("position", { ascending: true })
    .order("points", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TournamentTeamWithTeam[];
}

export async function registerTeams(
  tenantId: string,
  tournamentId: string,
  teamIds: string[],
): Promise<void> {
  if (teamIds.length === 0) return;
  const rows = teamIds.map((teamId) => ({
    tenant_id: tenantId,
    tournament_id: tournamentId,
    team_id: teamId,
  }));
  const { error } = await supabase
    .from("mc_tournament_teams")
    .upsert(rows, { onConflict: "tournament_id,team_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeTeam(tournamentId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from("mc_tournament_teams")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);
  if (error) throw error;
}

/* ================================================================
 * Fixtures — the Tournament references matches via mc_matches.tournament_id
 * ================================================================ */

export async function listFixtures(tournamentId: string) {
  const { data, error } = await supabase
    .from("mc_matches")
    .select(
      `*,
       team_a:mc_teams!mc_matches_team_a_id_fkey(id, name, short_name, logo_url),
       team_b:mc_teams!mc_matches_team_b_id_fkey(id, name, short_name, logo_url)`,
    )
    .eq("tournament_id", tournamentId)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_time", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export interface FixturePlan {
  team_a_id: string;
  team_b_id: string;
  round: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
}

/** Round-robin pairs — every team plays every other once (single leg). */
export function generateRoundRobin(teamIds: string[]): FixturePlan[] {
  const fixtures: FixturePlan[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      fixtures.push({
        team_a_id: teamIds[i],
        team_b_id: teamIds[j],
        round: 1,
        scheduled_date: null,
        scheduled_time: null,
      });
    }
  }
  return fixtures;
}

/** Knockout bracket — power-of-two seeding; byes go to top seeds. */
export function generateKnockout(teamIds: string[]): FixturePlan[] {
  const n = teamIds.length;
  if (n < 2) return [];
  const size = 2 ** Math.ceil(Math.log2(n));
  const padded: (string | null)[] = [...teamIds];
  while (padded.length < size) padded.push(null);
  const fixtures: FixturePlan[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = padded[i];
    const b = padded[size - 1 - i];
    if (a && b) {
      fixtures.push({
        team_a_id: a,
        team_b_id: b,
        round: 1,
        scheduled_date: null,
        scheduled_time: null,
      });
    }
  }
  return fixtures;
}

/**
 * Create real matches for each fixture plan. Reuses the existing Match Center
 * `createMatch` — no duplicate match logic.
 */
export async function persistFixtures(input: {
  tenantId: string;
  tournamentId: string;
  overs: number;
  matchFormat: string;
  fixtures: FixturePlan[];
  createdBy?: string | null;
}): Promise<string[]> {
  const created: string[] = [];
  for (const f of input.fixtures) {
    const match = await createMatch({
      tenantId: input.tenantId,
      team_a_id: f.team_a_id,
      team_b_id: f.team_b_id,
      match_type: "tournament",
      match_format: input.matchFormat,
      overs: input.overs,
      scheduled_date: f.scheduled_date,
      scheduled_time: f.scheduled_time,
      visibility: "private",
      createdBy: input.createdBy ?? null,
      squad_a: [],
      squad_b: [],
    });
    // Link the match to the tournament.
    const { error } = await supabase
      .from("mc_matches")
      .update({ tournament_id: input.tournamentId })
      .eq("id", match.id);
    if (error) throw error;
    created.push(match.id);
  }
  return created;
}
