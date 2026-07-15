import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { emitEvent } from "@/lib/automation/emit-client";

export type MCMatch = Database["public"]["Tables"]["mc_matches"]["Row"];
export type MCMatchInsert = Database["public"]["Tables"]["mc_matches"]["Insert"];
export type MCMatchUpdate = Database["public"]["Tables"]["mc_matches"]["Update"];

export type MCMatchSquad = Database["public"]["Tables"]["mc_match_squads"]["Row"];
export type MCMatchSquadInsert = Database["public"]["Tables"]["mc_match_squads"]["Insert"];

export type MCCustomMatchType = Database["public"]["Tables"]["mc_custom_match_types"]["Row"];

export type MCTeam = Database["public"]["Tables"]["mc_teams"]["Row"];
export type MCTeamInsert = Database["public"]["Tables"]["mc_teams"]["Insert"];

/* -------- Catalogs -------- */

export const MATCH_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "friendly", label: "Friendly" },
  { value: "tournament", label: "Tournament" },
  { value: "league", label: "League" },
  { value: "school", label: "School" },
  { value: "district", label: "District" },
  { value: "division", label: "Division" },
  { value: "state", label: "State" },
  { value: "national", label: "National" },
] as const;

export const MATCH_FORMATS = [
  { value: "T10", label: "T10", overs: 10 },
  { value: "T20", label: "T20", overs: 20 },
  { value: "ODI", label: "ODI", overs: 50 },
  { value: "Test", label: "Test", overs: 90 },
  { value: "Custom", label: "Custom overs", overs: 20 },
] as const;

export const MATCH_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
] as const;

export const TOSS_DECISIONS = [
  { value: "bat", label: "Chose to bat" },
  { value: "bowl", label: "Chose to bowl" },
] as const;

/* -------- Teams -------- */

export type TeamLite = Pick<
  MCTeam,
  | "id"
  | "name"
  | "short_name"
  | "logo_url"
  | "age_group"
  | "team_color"
  | "is_external"
  | "city"
  | "coach_name"
  | "status"
>;

export async function listAllTeams(tenantId: string): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from("mc_teams")
    .select(
      "id, name, short_name, logo_url, age_group, team_color, is_external, city, coach_name, status",
    )
    .eq("tenant_id", tenantId)
    .order("is_external", { ascending: true })
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createExternalTeam(input: {
  tenantId: string;
  name: string;
  city?: string;
  coach_name?: string;
  age_group?: string;
  logo_url?: string;
}) {
  const payload: MCTeamInsert = {
    tenant_id: input.tenantId,
    name: input.name.trim(),
    sport: "cricket",
    is_external: true,
    city: input.city?.trim() || null,
    coach_name: input.coach_name?.trim() || null,
    age_group: input.age_group?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    status: "active",
  };
  const { data, error } = await supabase.from("mc_teams").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* -------- Team players → default XI -------- */

export type TeamPlayerLite = {
  id: string;
  team_id: string;
  student_id: string;
  role: string | null;
  jersey_number: number | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_keeper: boolean;
};

export async function listTeamPlayersForXI(teamId: string): Promise<TeamPlayerLite[]> {
  const { data, error } = await supabase
    .from("mc_team_players")
    .select("id, team_id, student_id, role, jersey_number, is_captain, is_vice_captain, is_keeper")
    .eq("team_id", teamId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type StudentLite = {
  id: string;
  name: string;
  photo_url: string | null;
  player_id: string | null;
  dob: string | null;
};

export async function listStudentsByIds(ids: string[]): Promise<StudentLite[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("students")
    .select("id, name, photo_url, player_id, dob")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

/** Resolve or lazily create an athlete profile per student for match squads. */
export async function ensureAthleteProfileIds(
  tenantId: string,
  studentIds: string[],
): Promise<Record<string, string>> {
  if (studentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("mc_athlete_profiles")
    .select("id, student_id")
    .eq("tenant_id", tenantId)
    .in("student_id", studentIds);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    map[r.student_id] = r.id;
  });
  const missing = studentIds.filter((id) => !map[id]);
  if (missing.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from("mc_athlete_profiles")
      .insert(
        missing.map((sid) => ({
          tenant_id: tenantId,
          student_id: sid,
          primary_sport: "cricket",
        })),
      )
      .select("id, student_id");
    if (insErr) throw insErr;
    (inserted ?? []).forEach((r) => {
      map[r.student_id] = r.id;
    });
  }
  return map;
}

/* -------- Previous match / previous XI lookup -------- */

export async function findLastMatchBetween(
  tenantId: string,
  teamAId: string,
  teamBId: string,
): Promise<MCMatch | null> {
  const { data, error } = await supabase
    .from("mc_matches")
    .select("*")
    .eq("tenant_id", tenantId)
    .or(
      `and(team_a_id.eq.${teamAId},team_b_id.eq.${teamBId}),and(team_a_id.eq.${teamBId},team_b_id.eq.${teamAId})`,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMatchSquad(matchId: string, teamId: string) {
  const { data, error } = await supabase
    .from("mc_match_squads")
    .select("*")
    .eq("match_id", matchId)
    .eq("team_id", teamId)
    .order("batting_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

/* -------- Custom match types -------- */

export async function listCustomMatchTypes(tenantId: string) {
  const { data, error } = await supabase
    .from("mc_custom_match_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("label");
  if (error) throw error;
  return data ?? [];
}

export async function addCustomMatchType(tenantId: string, label: string) {
  const { data, error } = await supabase
    .from("mc_custom_match_types")
    .insert({ tenant_id: tenantId, label: label.trim() })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* -------- Matches -------- */

export type MatchWithTeams = MCMatch & {
  team_a: TeamLite | null;
  team_b: TeamLite | null;
};

export async function listMatches(tenantId: string): Promise<MatchWithTeams[]> {
  const { data, error } = await supabase
    .from("mc_matches")
    .select(
      `*,
       team_a:mc_teams!mc_matches_team_a_id_fkey(id, name, short_name, logo_url, age_group, team_color, is_external, city, coach_name, status),
       team_b:mc_teams!mc_matches_team_b_id_fkey(id, name, short_name, logo_url, age_group, team_color, is_external, city, coach_name, status)`,
    )
    .eq("tenant_id", tenantId)
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MatchWithTeams[];
}

export async function getMatch(tenantId: string, matchId: string) {
  const { data, error } = await supabase
    .from("mc_matches")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type CreateMatchInput = {
  tenantId: string;
  team_a_id: string;
  team_b_id: string;
  match_type: string;
  match_format: string;
  overs: number;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  ground_name?: string | null;
  pitch?: string | null;
  weather?: string | null;
  scorer?: string | null;
  umpire?: string | null;
  notes?: string | null;
  visibility?: string | null;
  streaming_url?: string | null;
  ball_type?: string | null;
  createdBy?: string | null;
  squad_a: MatchSquadDraft[];
  squad_b: MatchSquadDraft[];
};

export type MatchSquadDraft = {
  athlete_profile_id?: string | null;
  external_player_name?: string | null;
  batting_order?: number | null;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  is_keeper?: boolean;
  is_substitute?: boolean;
  role?: string | null;
};

export async function createMatch(input: CreateMatchInput) {
  const insert: MCMatchInsert = {
    tenant_id: input.tenantId,
    team_a_id: input.team_a_id,
    team_b_id: input.team_b_id,
    match_type: input.match_type,
    match_format: input.match_format,
    overs: input.overs,
    scheduled_date: input.scheduled_date || null,
    scheduled_time: input.scheduled_time || null,
    ground_name: input.ground_name || null,
    pitch: input.pitch || null,
    weather: input.weather || null,
    scorer: input.scorer || null,
    umpire: input.umpire || null,
    notes: input.notes || null,
    visibility: input.visibility || "private",
    streaming_url: input.streaming_url || null,
    ball_type: input.ball_type || null,
    status: "scheduled",
    created_by: input.createdBy ?? null,
  };
  const { data: match, error } = await supabase
    .from("mc_matches")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;

  const rows: MCMatchSquadInsert[] = [
    ...input.squad_a.map((p, i) => makeSquadRow(input.tenantId, match.id, input.team_a_id, p, i)),
    ...input.squad_b.map((p, i) => makeSquadRow(input.tenantId, match.id, input.team_b_id, p, i)),
  ];
  if (rows.length > 0) {
    const { error: squadErr } = await supabase.from("mc_match_squads").insert(rows);
    if (squadErr) throw squadErr;
  }
  return match;
}

function makeSquadRow(
  tenantId: string,
  matchId: string,
  teamId: string,
  p: MatchSquadDraft,
  idx: number,
): MCMatchSquadInsert {
  return {
    tenant_id: tenantId,
    match_id: matchId,
    team_id: teamId,
    athlete_profile_id: p.athlete_profile_id ?? null,
    external_player_name: p.external_player_name ?? null,
    batting_order: p.batting_order ?? idx + 1,
    is_playing: !(p.is_substitute ?? false),
    is_captain: !!p.is_captain,
    is_vice_captain: !!p.is_vice_captain,
    is_keeper: !!p.is_keeper,
    is_substitute: !!p.is_substitute,
    role: p.role ?? null,
  };
}

export async function updateMatchStatus(id: string, status: string, tenantId?: string) {
  const { error } = await supabase.from("mc_matches").update({ status }).eq("id", id);
  if (error) throw error;

  if (tenantId) {
    const eventType =
      status === "live"
        ? "match.started"
        : status === "completed"
          ? "match.finished"
          : status === "scheduled"
            ? "match.scheduled"
            : null;
    if (eventType) {
      emitEvent({
        tenantId,
        eventType,
        sourceModule: "match-center",
        sourceId: id,
        payload: { match_id: id, status },
      });
    }
  }
}

export async function deleteMatch(id: string) {
  const { error } = await supabase.from("mc_matches").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateMatch(tenantId: string, matchId: string) {
  const source = await getMatch(tenantId, matchId);
  if (!source) throw new Error("Match not found");
  const squads = await supabase.from("mc_match_squads").select("*").eq("match_id", matchId);
  if (squads.error) throw squads.error;

  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    status: _s,
    winner_team: _w,
    result: _r,
    toss_winner: _t,
    toss_decision: _td,
    ...rest
  } = source;

  const { data: copy, error } = await supabase
    .from("mc_matches")
    .insert({ ...rest, status: "scheduled" })
    .select("*")
    .single();
  if (error) throw error;

  const rows: MCMatchSquadInsert[] = (squads.data ?? []).map((r) => ({
    tenant_id: tenantId,
    match_id: copy.id,
    team_id: r.team_id,
    athlete_profile_id: r.athlete_profile_id,
    external_player_name: r.external_player_name,
    batting_order: r.batting_order,
    is_playing: r.is_playing,
    is_captain: r.is_captain,
    is_vice_captain: r.is_vice_captain,
    is_keeper: r.is_keeper,
    is_substitute: r.is_substitute,
    role: r.role,
  }));
  if (rows.length > 0) {
    const { error: se } = await supabase.from("mc_match_squads").insert(rows);
    if (se) throw se;
  }
  return copy;
}

/* -------- Smart defaults (per-tenant, localStorage) -------- */

type Defaults = {
  match_type?: string;
  match_format?: string;
  overs?: number;
  ground_name?: string;
  ball_type?: string;
  scorer?: string;
  umpire?: string;
  pitch?: string;
  team_a_id?: string;
  team_b_id?: string;
  playing_xi?: Record<string, string[]>; // teamId -> ordered athlete_profile_ids
  captains?: Record<string, string>; // teamId -> athlete_profile_id
  keepers?: Record<string, string>;
  vice_captains?: Record<string, string>;
};

function key(tenantId: string) {
  return `mc:match-defaults:${tenantId}`;
}

export function readMatchDefaults(tenantId: string): Defaults {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(tenantId));
    return raw ? (JSON.parse(raw) as Defaults) : {};
  } catch {
    return {};
  }
}

export function writeMatchDefaults(tenantId: string, patch: Defaults) {
  if (typeof window === "undefined") return;
  try {
    const current = readMatchDefaults(tenantId);
    window.localStorage.setItem(key(tenantId), JSON.stringify({ ...current, ...patch }));
  } catch {
    /* ignore */
  }
}
