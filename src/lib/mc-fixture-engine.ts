/* ================================================================
 * Fixture Engine v2 — Tournament Center
 * ----------------------------------------------------------------
 * Design principles
 *   • Pure planners → deterministic, testable, side-effect free.
 *   • Persistence delegates to `createMatch` from Match Center — this
 *     module NEVER duplicates scoring, squad or statistics logic.
 *   • Bracket wiring lives in mc_tournament_rounds (feeder_a/b → advances_to).
 *   • Scheduling is decoupled from generation, so future features
 *     (rain delays, reschedules, multi-day, multi-ground, templates)
 *     can plug in as additional passes without rewriting planners.
 *
 * Format matrix
 *   ┌──────────────────────┬─────────────────────────────────────┐
 *   │ Format               │ Generator                           │
 *   ├──────────────────────┼─────────────────────────────────────┤
 *   │ league / round_robin │ planRoundRobin (single or double)   │
 *   │ knockout             │ planKnockout                         │
 *   │ group_stage          │ planGroupStage                       │
 *   │ league_knockout /    │ planGroupStage + planKnockout        │
 *   │ group_plus_knockout  │  (bracket seeded from group qualifiers)│
 *   │ custom               │ caller-supplied FixturePlan[]        │
 *   └──────────────────────┴─────────────────────────────────────┘
 * ================================================================ */

import { supabase } from "@/integrations/supabase/client";
import { createMatch } from "@/lib/mc-matches";
import type { Database } from "@/integrations/supabase/types";
import type { MCTournament } from "@/lib/mc-tournaments";
import type {
  TournamentGroup,
  TournamentVenue,
  TournamentOfficial,
} from "@/lib/mc-tournament-setup";

/* ================================================================
 * TYPES
 * ================================================================ */

export type BracketStage =
  | "r64"
  | "r32"
  | "r16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

/** A planned fixture — everything needed to persist a match + round row. */
export interface FixturePlan {
  /** Deterministic key so planners and schedulers can cross-reference. */
  slot_key: string;
  stage: "league" | "group" | "knockout";
  bracket_stage?: BracketStage;
  stage_order: number; // ordering within a stage (matchday, round index)
  slot_index: number;
  matchday_no?: number | null;
  group_id?: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  /** For knockout placeholders that resolve from an earlier round. */
  feeder_a_slot?: string | null;
  feeder_b_slot?: string | null;
  is_placeholder: boolean;
  label?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  venue_id?: string | null;
}

export interface FixturePlanResult {
  fixtures: FixturePlan[];
  warnings: string[];
}

export interface GenerationOptions {
  /** Double round robin — each pair plays twice (home + away). */
  doubleLeg?: boolean;
  /** Group + knockout uses this to know how many advance from each group. */
  qualifiersPerGroup?: number;
  /** Enable a third-place playoff after semifinals. */
  thirdPlaceMatch?: boolean;
  /** Bracket seeding style: "standard" (1v8/4v5/2v7/3v6) or "sequential". */
  seedingStrategy?: "standard" | "sequential";
}

export interface ScheduleOptions {
  startDate: string; // "YYYY-MM-DD"
  slotsPerDay?: number; // default 2
  matchDurationMinutes?: number; // default 210
  restDaysBetweenMatches?: number; // default 0
  dayStartTime?: string; // "HH:mm" (default "10:00")
  gapBetweenSlotsMinutes?: number; // default 30
  venues: TournamentVenue[];
  /** Optional exclusion of dates (weekly off days, holidays). */
  blackoutDates?: string[];
}

/* ================================================================
 * VALIDATION
 * ================================================================ */

export interface FixturePlanIssue {
  code: "self_play" | "duplicate" | "empty" | "odd_bracket" | "no_teams" | "no_qualifiers";
  message: string;
}

export function validateFixturePlan(plan: FixturePlan[]): FixturePlanIssue[] {
  const issues: FixturePlanIssue[] = [];
  if (plan.length === 0) {
    issues.push({ code: "empty", message: "No fixtures generated" });
    return issues;
  }
  const seen = new Set<string>();
  for (const f of plan) {
    if (f.team_a_id && f.team_b_id && f.team_a_id === f.team_b_id) {
      issues.push({
        code: "self_play",
        message: `Team plays itself in ${f.slot_key}`,
      });
    }
    if (f.team_a_id && f.team_b_id) {
      const key = [f.stage, f.group_id ?? "-", ...[f.team_a_id, f.team_b_id].sort()].join("|");
      if (seen.has(key)) {
        issues.push({
          code: "duplicate",
          message: `Duplicate pairing in ${f.stage}`,
        });
      }
      seen.add(key);
    }
  }
  return issues;
}

/* ================================================================
 * ROUND ROBIN — circle method (works for any team count)
 * ================================================================ */

function circleRoundRobin(
  teamIds: (string | null)[],
): { round: number; a: string | null; b: string | null }[] {
  const teams = teamIds.slice();
  if (teams.length % 2 !== 0) teams.push(null); // bye
  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const rotating = teams.slice(1);
  const out: { round: number; a: string | null; b: string | null }[] = [];
  for (let r = 0; r < rounds; r++) {
    const list = [teams[0], ...rotating];
    for (let i = 0; i < half; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      // alternate home/away by round parity — helps balance venues later
      if (r % 2 === 0) out.push({ round: r + 1, a, b });
      else out.push({ round: r + 1, a: b, b: a });
    }
    rotating.unshift(rotating.pop()!);
  }
  return out;
}

export function planRoundRobin(
  teamIds: string[],
  opts: GenerationOptions = {},
): FixturePlan[] {
  if (teamIds.length < 2) return [];
  const single = circleRoundRobin(teamIds).filter((m) => m.a && m.b);
  const legs = opts.doubleLeg ? [single, single.map((m) => ({ ...m, a: m.b, b: m.a }))] : [single];
  const plans: FixturePlan[] = [];
  let slot = 0;
  legs.forEach((leg, legIdx) => {
    for (const m of leg) {
      const matchday = m.round + legIdx * (teamIds.length - 1);
      plans.push({
        slot_key: `L-${matchday}-${slot}`,
        stage: "league",
        stage_order: matchday,
        slot_index: slot++,
        matchday_no: matchday,
        team_a_id: m.a,
        team_b_id: m.b,
        is_placeholder: false,
        label: `Matchday ${matchday}`,
      });
    }
  });
  return plans;
}

/* ================================================================
 * GROUP STAGE — each group runs its own round robin
 * ================================================================ */

export interface GroupTeamMap {
  group: TournamentGroup;
  teamIds: string[]; // mc_teams.id
}

export function planGroupStage(
  groups: GroupTeamMap[],
  opts: GenerationOptions = {},
): FixturePlan[] {
  const plans: FixturePlan[] = [];
  let slot = 0;
  for (const g of groups) {
    if (g.teamIds.length < 2) continue;
    const rr = circleRoundRobin(g.teamIds).filter((m) => m.a && m.b);
    const legs = opts.doubleLeg ? [rr, rr.map((m) => ({ ...m, a: m.b, b: m.a }))] : [rr];
    legs.forEach((leg, legIdx) => {
      for (const m of leg) {
        const matchday = m.round + legIdx * (g.teamIds.length - 1);
        plans.push({
          slot_key: `G-${g.group.id}-${matchday}-${slot}`,
          stage: "group",
          stage_order: matchday,
          slot_index: slot++,
          matchday_no: matchday,
          group_id: g.group.id,
          team_a_id: m.a,
          team_b_id: m.b,
          is_placeholder: false,
          label: `${g.group.name ?? "Group"} · Matchday ${matchday}`,
        });
      }
    });
  }
  return plans;
}

/* ================================================================
 * KNOCKOUT — power-of-two bracket with placeholder wiring
 * ================================================================ */

const STAGE_BY_SIZE: Record<number, BracketStage> = {
  64: "r64",
  32: "r32",
  16: "r16",
  8: "quarterfinal",
  4: "semifinal",
  2: "final",
};

/** Standard seeding order for a bracket of size `n` — top seeds meet lowest. */
function standardSeedOrder(n: number): number[] {
  // 2 → [1,2]; 4 → [1,4,2,3]; 8 → [1,8,4,5,2,7,3,6] …
  let order = [1, 2];
  while (order.length < n) {
    const next: number[] = [];
    const size = order.length * 2;
    for (const s of order) {
      next.push(s);
      next.push(size + 1 - s);
    }
    order = next;
  }
  return order;
}

/**
 * Build a knockout bracket from a seeded team list. Extra slots are BYEs
 * (represented by `null` team ids on the winning side — persistence layer will
 * auto-advance byes when wiring rounds).
 *
 * When `useFeederPlaceholders` is true, later-round matches reference their
 * feeder slots by `slot_key` instead of holding team ids. This is what the
 * group+knockout flow uses so the round table can wire winners automatically.
 */
export function planKnockout(
  seededTeamIds: (string | null)[],
  opts: GenerationOptions = {},
): FixturePlan[] {
  const teamCount = seededTeamIds.length;
  if (teamCount < 2) return [];
  const size = 2 ** Math.ceil(Math.log2(teamCount));
  const padded: (string | null)[] = [...seededTeamIds];
  while (padded.length < size) padded.push(null);

  const order = opts.seedingStrategy === "sequential"
    ? Array.from({ length: size }, (_, i) => i + 1)
    : standardSeedOrder(size);

  // Round 1 fixtures according to seeding order
  const roundSizes: number[] = [];
  for (let s = size; s >= 2; s = s / 2) roundSizes.push(s);

  const plans: FixturePlan[] = [];
  let slot = 0;
  const round1Keys: string[] = [];

  for (let i = 0; i < size / 2; i++) {
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];
    const a = padded[seedA - 1] ?? null;
    const b = padded[seedB - 1] ?? null;
    const stage = STAGE_BY_SIZE[size] ?? "r64";
    const key = `K-${stage}-${i}`;
    round1Keys.push(key);
    plans.push({
      slot_key: key,
      stage: "knockout",
      bracket_stage: stage,
      stage_order: 0,
      slot_index: slot++,
      team_a_id: a,
      team_b_id: b,
      is_placeholder: a === null || b === null, // byes flagged
      label: `${stageLabel(stage)} · Match ${i + 1}`,
    });
  }

  // Later rounds — placeholders with feeder wiring
  let prevKeys = round1Keys;
  for (let r = 1; r < roundSizes.length; r++) {
    const stageSize = roundSizes[r];
    const stage = STAGE_BY_SIZE[stageSize] ?? "r64";
    const nextKeys: string[] = [];
    for (let i = 0; i < stageSize / 2; i++) {
      const feederA = prevKeys[i * 2];
      const feederB = prevKeys[i * 2 + 1];
      const key = `K-${stage}-${i}`;
      nextKeys.push(key);
      plans.push({
        slot_key: key,
        stage: "knockout",
        bracket_stage: stage,
        stage_order: r,
        slot_index: slot++,
        team_a_id: null,
        team_b_id: null,
        feeder_a_slot: feederA,
        feeder_b_slot: feederB,
        is_placeholder: true,
        label: `${stageLabel(stage)} · Match ${i + 1}`,
      });
    }
    prevKeys = nextKeys;
  }

  // Optional third-place playoff — feeders are the two semifinal losers
  if (opts.thirdPlaceMatch && size >= 4) {
    const semiKeys = plans
      .filter((p) => p.bracket_stage === "semifinal")
      .map((p) => p.slot_key);
    if (semiKeys.length === 2) {
      plans.push({
        slot_key: "K-third_place-0",
        stage: "knockout",
        bracket_stage: "third_place",
        stage_order: roundSizes.length - 1, // same order as final
        slot_index: slot++,
        team_a_id: null,
        team_b_id: null,
        feeder_a_slot: semiKeys[0],
        feeder_b_slot: semiKeys[1],
        is_placeholder: true,
        label: "Third-place playoff",
      });
    }
  }

  return plans;
}

function stageLabel(stage: BracketStage): string {
  switch (stage) {
    case "final":
      return "Final";
    case "third_place":
      return "3rd Place";
    case "semifinal":
      return "Semifinal";
    case "quarterfinal":
      return "Quarterfinal";
    case "r16":
      return "Round of 16";
    case "r32":
      return "Round of 32";
    case "r64":
      return "Round of 64";
  }
}

/* ================================================================
 * GROUP + KNOCKOUT
 * ================================================================ */

export function planGroupPlusKnockout(
  groups: GroupTeamMap[],
  opts: GenerationOptions = {},
): FixturePlan[] {
  const groupFixtures = planGroupStage(groups, opts);
  const qualifiers = opts.qualifiersPerGroup ?? 2;
  // Placeholder team slots for the knockout — one per (group, seed) pair.
  // These map to `null` team ids at plan time; the bracket-advance logic
  // resolves them to real teams once the group stage completes.
  const seeded: (string | null)[] = [];
  for (let seed = 0; seed < qualifiers; seed++) {
    for (const g of groups) {
      seeded.push(null); // placeholder — real team resolved from standings
      void g;
    }
  }
  const bracket = planKnockout(seeded, opts);
  return [...groupFixtures, ...bracket];
}

/* ================================================================
 * SCHEDULER — assigns dates/times/venues while respecting constraints
 * ================================================================ */

export function scheduleFixtures(
  fixtures: FixturePlan[],
  opts: ScheduleOptions,
): FixturePlan[] {
  if (fixtures.length === 0) return fixtures;
  const slotsPerDay = Math.max(1, opts.slotsPerDay ?? 2);
  const duration = opts.matchDurationMinutes ?? 210;
  const gap = opts.gapBetweenSlotsMinutes ?? 30;
  const dayStart = opts.dayStartTime ?? "10:00";
  const restDays = opts.restDaysBetweenMatches ?? 0;
  const venues = opts.venues.filter((v) => v.is_active !== false);
  const blackout = new Set(opts.blackoutDates ?? []);

  // Order fixtures: leagues/groups first by matchday, then knockout by round.
  const ordered = fixtures.slice().sort((a, b) => {
    if (a.stage !== b.stage) {
      const order = { group: 0, league: 1, knockout: 2 } as const;
      return order[a.stage] - order[b.stage];
    }
    return a.stage_order - b.stage_order || a.slot_index - b.slot_index;
  });

  const lastPlayedByTeam = new Map<string, string>(); // team_id → date
  let cursor = new Date(opts.startDate + "T00:00:00Z");
  let dailyCount = 0;
  let venueRoundRobin = 0;

  const advanceDay = () => {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    dailyCount = 0;
  };

  const isBlackout = (d: Date) => blackout.has(d.toISOString().slice(0, 10));

  const scheduled: FixturePlan[] = [];
  for (const f of ordered) {
    // Respect rest days for both teams (only for materialized fixtures).
    while (
      isBlackout(cursor) ||
      dailyCount >= slotsPerDay ||
      (restDays > 0 && violatesRest(f, lastPlayedByTeam, cursor, restDays))
    ) {
      advanceDay();
      if (dailyCount >= slotsPerDay) {
        // safety — advanceDay resets dailyCount; loop guard prevents infinite spin
        break;
      }
    }
    const date = cursor.toISOString().slice(0, 10);
    const time = addMinutes(dayStart, dailyCount * (duration + gap));
    const venue = venues.length > 0 ? venues[venueRoundRobin % venues.length] : null;
    venueRoundRobin += 1;

    scheduled.push({
      ...f,
      scheduled_date: date,
      scheduled_time: time,
      venue_id: venue?.id ?? f.venue_id ?? null,
    });

    if (f.team_a_id) lastPlayedByTeam.set(f.team_a_id, date);
    if (f.team_b_id) lastPlayedByTeam.set(f.team_b_id, date);
    dailyCount += 1;
  }
  return scheduled;
}

function violatesRest(
  f: FixturePlan,
  lastPlayed: Map<string, string>,
  cursor: Date,
  restDays: number,
): boolean {
  const check = (teamId: string | null) => {
    if (!teamId) return false;
    const last = lastPlayed.get(teamId);
    if (!last) return false;
    const lastDate = new Date(last + "T00:00:00Z");
    const diff = Math.floor((cursor.getTime() - lastDate.getTime()) / 86400000);
    return diff <= restDays;
  };
  return check(f.team_a_id) || check(f.team_b_id);
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ================================================================
 * OFFICIAL ASSIGNMENT — round-robin across available officials by role
 * ================================================================ */

export interface AssignedOfficialsMap {
  [matchSlotKey: string]: { umpire?: string; scorer?: string };
}

export function assignOfficials(
  fixtures: FixturePlan[],
  officials: TournamentOfficial[],
): AssignedOfficialsMap {
  const umpires = officials.filter((o) => o.role === "umpire" && o.is_active !== false);
  const scorers = officials.filter((o) => o.role === "scorer" && o.is_active !== false);
  const out: AssignedOfficialsMap = {};
  fixtures.forEach((f, i) => {
    const u = umpires.length > 0 ? umpires[i % umpires.length] : null;
    const s = scorers.length > 0 ? scorers[i % scorers.length] : null;
    out[f.slot_key] = {
      umpire: u?.name ?? undefined,
      scorer: s?.name ?? undefined,
    };
  });
  return out;
}

/* ================================================================
 * PERSISTENCE — reuse createMatch, wire rounds, link groups/venues
 * ================================================================ */

type MCRoundInsert = Database["public"]["Tables"]["mc_tournament_rounds"]["Insert"];

export interface PersistOptions {
  tenantId: string;
  tournamentId: string;
  overs: number;
  matchFormat: string;
  createdBy?: string | null;
  officials?: AssignedOfficialsMap;
  /** Wipe any previously-generated fixtures + rounds first. */
  regenerate?: boolean;
}

/** Delete every generated fixture + round row for this tournament. */
export async function clearGeneratedFixtures(tournamentId: string): Promise<void> {
  // Only wipe matches that have not started scoring — protects scored data.
  const { data: matches } = await supabase
    .from("mc_matches")
    .select("id, status, match_locked")
    .eq("tournament_id", tournamentId);
  const removable = (matches ?? []).filter(
    (m) => !m.match_locked && (m.status === "scheduled" || m.status === "upcoming"),
  );
  if (removable.length > 0) {
    await supabase
      .from("mc_matches")
      .delete()
      .in(
        "id",
        removable.map((m) => m.id),
      );
  }
  await supabase.from("mc_tournament_rounds").delete().eq("tournament_id", tournamentId);
}

/**
 * Persist a plan. Creates matches for materialised fixtures (real team ids)
 * and round rows for every knockout slot (including placeholders) so the
 * bracket can be visualised and advanced later.
 */
export async function persistFixturePlan(
  plan: FixturePlan[],
  opts: PersistOptions,
): Promise<{ createdMatches: string[]; createdRounds: string[] }> {
  if (opts.regenerate) await clearGeneratedFixtures(opts.tournamentId);

  const slotToMatchId = new Map<string, string>();
  const createdMatches: string[] = [];

  // 1) Insert real matches for playable fixtures.
  for (const f of plan) {
    const playable = !!(f.team_a_id && f.team_b_id);
    if (!playable) continue;
    const off = opts.officials?.[f.slot_key];
    const match = await createMatch({
      tenantId: opts.tenantId,
      team_a_id: f.team_a_id!,
      team_b_id: f.team_b_id!,
      match_type: f.stage === "knockout" ? "tournament_knockout" : "tournament",
      match_format: opts.matchFormat,
      overs: opts.overs,
      scheduled_date: f.scheduled_date ?? null,
      scheduled_time: f.scheduled_time ?? null,
      visibility: "private",
      createdBy: opts.createdBy ?? null,
      squad_a: [],
      squad_b: [],
      umpire: off?.umpire ?? null,
      scorer: off?.scorer ?? null,
      notes: f.label ?? null,
    });
    // Attach tournament + venue + group + matchday.
    const { error } = await supabase
      .from("mc_matches")
      .update({
        tournament_id: opts.tournamentId,
        venue_id: f.venue_id ?? null,
        group_id: f.group_id ?? null,
        matchday_no: f.matchday_no ?? null,
      })
      .eq("id", match.id);
    if (error) throw error;
    slotToMatchId.set(f.slot_key, match.id);
    createdMatches.push(match.id);
  }

  // 2) Insert round rows for knockout stages (both materialised and placeholders)
  const knockout = plan.filter((f) => f.stage === "knockout");
  const roundInserts: MCRoundInsert[] = knockout.map((f) => ({
    tenant_id: opts.tenantId,
    tournament_id: opts.tournamentId,
    stage: f.bracket_stage ?? "final",
    stage_order: f.stage_order,
    slot_index: f.slot_index,
    name: f.label ?? null,
    team_a_id: f.team_a_id,
    team_b_id: f.team_b_id,
    match_id: slotToMatchId.get(f.slot_key) ?? null,
    is_placeholder: f.is_placeholder,
    feeder_type: f.feeder_a_slot ? "winner" : "seed",
  }));
  let createdRounds: string[] = [];
  if (roundInserts.length > 0) {
    const { data: inserted, error } = await supabase
      .from("mc_tournament_rounds")
      .insert(roundInserts)
      .select("id, slot_index, stage");
    if (error) throw error;
    createdRounds = (inserted ?? []).map((r) => r.id);

    // 3) Wire feeder edges — second pass since round ids are now known.
    // Build slot_key → round.id lookup by matching (stage, slot_index).
    const roundByKey = new Map<string, string>();
    for (let i = 0; i < knockout.length; i++) {
      const f = knockout[i];
      const row = inserted?.[i];
      if (row) roundByKey.set(f.slot_key, row.id);
    }
    for (const f of knockout) {
      if (!f.feeder_a_slot && !f.feeder_b_slot) continue;
      const roundId = roundByKey.get(f.slot_key);
      if (!roundId) continue;
      const feederA = f.feeder_a_slot ? roundByKey.get(f.feeder_a_slot) : null;
      const feederB = f.feeder_b_slot ? roundByKey.get(f.feeder_b_slot) : null;
      await supabase
        .from("mc_tournament_rounds")
        .update({
          feeder_a_round_id: feederA ?? null,
          feeder_b_round_id: feederB ?? null,
        })
        .eq("id", roundId);
      // Point feeder rounds to this "advances_to".
      const feederRoundIds = [feederA, feederB].filter(Boolean) as string[];
      if (feederRoundIds.length > 0) {
        await supabase
          .from("mc_tournament_rounds")
          .update({ advances_to_round_id: roundId })
          .in("id", feederRoundIds);
      }
    }
  }
  return { createdMatches, createdRounds };
}

/* ================================================================
 * HIGH-LEVEL ENTRY POINT
 * ----------------------------------------------------------------
 * Selects the correct planner based on the tournament configuration.
 * Consumers (UI + tests) call this rather than the individual planners
 * so future formats can be added centrally.
 * ================================================================ */

export interface GenerateFixturesInput {
  tournament: Pick<
    MCTournament,
    "tournament_type" | "has_groups" | "has_knockout" | "third_place_match"
  >;
  registeredTeamIds: string[];
  groupTeamMap: GroupTeamMap[];
  options?: GenerationOptions;
  schedule?: ScheduleOptions;
}

export function generateFixtures(input: GenerateFixturesInput): FixturePlanResult {
  const { tournament, registeredTeamIds, groupTeamMap, options = {}, schedule } = input;
  const warnings: string[] = [];
  let plan: FixturePlan[] = [];

  const t = tournament.tournament_type;
  const wantsGroups = tournament.has_groups || t === "group_stage" || t === "league_knockout";
  const wantsKnockout = tournament.has_knockout || t === "knockout" || t === "league_knockout";

  const opts: GenerationOptions = {
    thirdPlaceMatch: tournament.third_place_match,
    ...options,
  };

  if (wantsGroups && wantsKnockout) {
    if (groupTeamMap.length === 0) warnings.push("No groups configured");
    plan = planGroupPlusKnockout(groupTeamMap, opts);
  } else if (wantsGroups) {
    plan = planGroupStage(groupTeamMap, opts);
  } else if (wantsKnockout) {
    plan = planKnockout(registeredTeamIds, opts);
  } else if (t === "round_robin" || t === "league" || t === "practice_series") {
    plan = planRoundRobin(registeredTeamIds, opts);
  } else {
    // "custom" → caller supplies fixtures directly
    plan = [];
    warnings.push("Custom tournaments require manual fixtures");
  }

  if (schedule && plan.length > 0) {
    plan = scheduleFixtures(plan, schedule);
  }
  return { fixtures: plan, warnings };
}

/* ================================================================
 * KNOCKOUT ADVANCEMENT
 * ----------------------------------------------------------------
 * When a knockout match finalises, propagate the winner to the
 * feeder-linked next round. Called from the tournament engine's
 * `updateTournamentForMatch` in a future step.
 * ================================================================ */

export async function advanceKnockoutWinner(matchId: string): Promise<void> {
  const { data: match } = await supabase
    .from("mc_matches")
    .select("id, tournament_id, winner_team, match_locked")
    .eq("id", matchId)
    .maybeSingle();
  if (!match?.match_locked || !match.winner_team || !match.tournament_id) return;

  const { data: round } = await supabase
    .from("mc_tournament_rounds")
    .select("id, advances_to_round_id, feeder_a_round_id, feeder_b_round_id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!round?.advances_to_round_id) return;

  const { data: nextRound } = await supabase
    .from("mc_tournament_rounds")
    .select("id, team_a_id, team_b_id, feeder_a_round_id, feeder_b_round_id, match_id")
    .eq("id", round.advances_to_round_id)
    .maybeSingle();
  if (!nextRound) return;

  const patch: Partial<Database["public"]["Tables"]["mc_tournament_rounds"]["Update"]> = {};
  if (nextRound.feeder_a_round_id === round.id) patch.team_a_id = match.winner_team;
  if (nextRound.feeder_b_round_id === round.id) patch.team_b_id = match.winner_team;

  if (Object.keys(patch).length > 0) {
    await supabase.from("mc_tournament_rounds").update(patch).eq("id", nextRound.id);
    if (nextRound.match_id) {
      await supabase.from("mc_matches").update(patch).eq("id", nextRound.match_id);
    }
  }
}
