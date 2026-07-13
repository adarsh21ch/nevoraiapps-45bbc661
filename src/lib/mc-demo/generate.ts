/* Deterministic demo fixture generator.
 * NO writes to Supabase — pure in-memory data cast to the shapes the UI reads.
 *
 * Ball-by-ball completed & live matches are produced by a small simulator
 * that emits real `mc_ball_events` rows and `mc_innings` totals. The
 * existing Ball Event Engine / Statistics Engine derives batting cards,
 * bowling cards, fall of wickets, partnerships, over summaries, extras
 * and every other number from these events — no duplicated stats.
 */
import { makeRng, type Rng } from "./rng";
import type { MatchWithTeams } from "@/lib/mc-matches";
import type { TeamWithCount } from "@/lib/mc-teams";
import type { AthleteWithStudent } from "@/lib/mc-athletes";
import type { MCTournament } from "@/lib/mc-tournaments";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";

/* ---------- name / photo pools ---------- */
const FIRST_NAMES = [
  "Arjun", "Rohan", "Kabir", "Aarav", "Vihaan", "Aditya", "Ishaan", "Reyansh", "Krishna", "Rudra",
  "Yash", "Rehan", "Dev", "Manav", "Aryan", "Karan", "Nitin", "Sanjay", "Rahul", "Vikram",
  "Priya", "Ananya", "Kavya", "Diya", "Ishita", "Meera", "Riya", "Sanya", "Tanvi", "Zara",
  "Sai", "Advait", "Neel", "Ved", "Aayan", "Farhan", "Zayn", "Kunal", "Rohit", "Aakash",
  "Siddharth", "Varun", "Nikhil", "Harsh", "Parth", "Ayush", "Om", "Shivansh", "Atharv", "Raghav",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Reddy", "Iyer", "Nair", "Menon", "Patel", "Shah", "Rao", "Kumar",
  "Singh", "Kapoor", "Malhotra", "Chopra", "Bansal", "Gupta", "Mehta", "Joshi", "Desai", "Bhatt",
  "Khan", "Ahmed", "Naidu", "Pillai", "Das", "Ghosh", "Roy", "Banerjee", "Sen", "Mitra",
];
const CITIES = ["Bengaluru", "Mumbai", "Chennai", "Delhi", "Hyderabad", "Pune", "Kolkata", "Ahmedabad"];
const GROUNDS = [
  "Sai Main Ground",
  "Practice Ground",
  "Indoor Nets",
  "Chinnaswamy Ground",
  "Wankhede Practice Field",
  "Sardar Patel Ground",
];
const TEAM_COLORS = ["#E8873C", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899", "#22C55E", "#F97316", "#14B8A6", "#A855F7"];
const ROLES = ["batter", "bowler", "all_rounder", "wicket_keeper"] as const;

/** Named players that must always appear in the demo dataset so search
 * behaves predictably (e.g. typing "rah" surfaces Rahul Sharma → U16). */
const NAMED_U16_PLAYERS = [
  "Rahul Sharma", "Aman Patel", "Aryan Singh", "Mohit Verma", "Rohit Yadav",
] as const;

function photo(seed: string) {
  return `https://i.pravatar.cc/240?u=${encodeURIComponent(seed)}`;
}
function name(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

/* ---------- types ---------- */
export type DemoPerfRow = {
  athleteId: string;
  matches: number;
  runs: number;
  wickets: number;
  average: number;
  strikeRate: number;
  economy: number;
  fifties: number;
  hundreds: number;
  bestBat: string;
  bestBowl: string;
};

export type DemoAIReport = {
  id: string;
  report_type: "match" | "player" | "team" | "tournament" | "academy_monthly";
  title: string;
  summary: string;
  generated_at: string;
  key_findings: Array<{ label: string; detail?: string }>;
  strengths: Array<{ label: string; detail?: string }>;
};

export type DemoLiveState = {
  matchId: string;
  inningsId: string;
  strikerId: string;
  strikerName: string;
  nonStrikerId: string;
  nonStrikerName: string;
  bowlerId: string;
  bowlerName: string;
  currentOver: number;
  ballInOver: number;
  runs: number;
  wickets: number;
  overs: string;
};

export type DemoSquadPlayer = { id: string; name: string };
export type DemoMatchSquads = Record<string, DemoSquadPlayer[]>;

export type DemoData = {
  __v: number;
  tenantId: string;
  players: AthleteWithStudent[];
  teams: TeamWithCount[];
  tournaments: MCTournament[];
  matches: MatchWithTeams[];
  liveMatch: MatchWithTeams;
  innings: MCInnings[];
  ballEvents: MCBallEvent[];
  liveState: DemoLiveState;
  matchSquads: Record<string, DemoMatchSquads>;
  records: Array<{ id: string; record_type: string; title: string; player_name: string; value: string }>;
  recognitions: Array<{ id: string; title: string; recognition_type: string; player_name: string; awarded_at: string }>;
  hallOfFame: Array<{ id: string; player_name: string; era: string; note: string }>;
  perfRows: DemoPerfRow[];
  aiReports: DemoAIReport[];
};

/* ---------- ball-by-ball simulator ---------- */
type Player = { id: string; name: string };

type SimOptions = {
  rng: Rng;
  tenantId: string;
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  batters: Player[];
  bowlers: Player[];
  maxOvers: number;
  target?: number;
  /** Stop mid-innings at exactly this many legal balls (for the live match). */
  stopAtLegalBalls?: number;
  seqStart: number;
  startedAt: string;
};

type SimResult = {
  innings: MCInnings;
  events: MCBallEvent[];
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  striker: Player | null;
  nonStriker: Player | null;
  bowler: Player | null;
};

/**
 * Weighted delivery outcome. Realistic T20-ish distribution.
 * Returns fields that map directly onto an MCBallEvent (before naming).
 */
function rollOutcome(rng: Rng): {
  legal: boolean;
  runs_off_bat: number;
  extra_runs: number;
  extra_type: string | null;
  wicket: null | "bowled" | "caught" | "lbw" | "run_out" | "stumped";
} {
  const r = rng.next();
  // 4% wide, 2% no-ball
  if (r < 0.04) return { legal: false, runs_off_bat: 0, extra_runs: 1, extra_type: "wide", wicket: null };
  if (r < 0.06) {
    // no ball + off-bat runs
    const off = rng.chance(0.35) ? rng.pick([0, 1, 2, 4]) : 0;
    return { legal: false, runs_off_bat: off, extra_runs: 1, extra_type: "no_ball", wicket: null };
  }
  // wicket ~4.5%
  if (r < 0.105) {
    const wType = rng.pick(["bowled", "caught", "caught", "lbw", "run_out", "stumped"] as const);
    return { legal: true, runs_off_bat: 0, extra_runs: 0, extra_type: null, wicket: wType };
  }
  // byes/leg-byes ~2%
  if (r < 0.125) {
    return { legal: true, runs_off_bat: 0, extra_runs: rng.pick([1, 1, 1, 2, 4]), extra_type: rng.chance(0.5) ? "bye" : "leg_bye", wicket: null };
  }
  // scoring runs distribution over remaining ~87.5%
  const s = rng.next();
  let runs = 0;
  if (s < 0.36) runs = 0;
  else if (s < 0.68) runs = 1;
  else if (s < 0.79) runs = 2;
  else if (s < 0.82) runs = 3;
  else if (s < 0.94) runs = 4;
  else runs = 6;
  return { legal: true, runs_off_bat: runs, extra_runs: 0, extra_type: null, wicket: null };
}

function simulateInnings(opts: SimOptions): SimResult {
  const {
    rng, tenantId, matchId, inningsNumber, battingTeamId, bowlingTeamId,
    batters, bowlers, maxOvers, target, stopAtLegalBalls, seqStart, startedAt,
  } = opts;

  const events: MCBallEvent[] = [];
  const inningsId = `demo-innings-${matchId}-${inningsNumber}`;

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatter = 2;
  let bowlerIdx = rng.int(0, Math.max(0, bowlers.length - 1));
  let lastBowlerIdx = -1;
  let wickets = 0;
  let runs = 0;
  let extras = 0;
  let legalBalls = 0;
  let ballInOver = 0;
  let overNumber = 1;
  let seq = seqStart;

  const maxBalls = maxOvers * 6;
  const outer = () => {
    if (stopAtLegalBalls !== undefined && legalBalls >= stopAtLegalBalls) return false;
    if (legalBalls >= maxBalls) return false;
    if (wickets >= batters.length - 1) return false;
    if (target !== undefined && runs >= target) return false;
    return true;
  };

  while (outer()) {
    const striker = batters[strikerIdx];
    const nonStriker = batters[nonStrikerIdx];
    const bowler = bowlers[bowlerIdx];

    const o = rollOutcome(rng);
    const total = o.runs_off_bat + o.extra_runs;

    // wicket resolution: pick a fielder for caught / stumped / run_out
    let fielderName: string | null = null;
    if (o.wicket === "caught" || o.wicket === "stumped" || o.wicket === "run_out") {
      // fielders are the bowling team's players — reuse `bowlers` pool for names
      const f = bowlers[rng.int(0, bowlers.length - 1)];
      fielderName = f.name;
    }

    ballInOver += 1;
    seq += 1;

    events.push({
      id: `demo-ev-${matchId}-${inningsNumber}-${seq}`,
      tenant_id: tenantId,
      match_id: matchId,
      innings_id: inningsId,
      sequence_number: seq,
      over_number: overNumber,
      ball_number: ballInOver,
      is_legal_delivery: o.legal,
      runs_off_bat: o.runs_off_bat,
      extra_runs: o.extra_runs,
      extra_type: o.extra_type,
      striker_athlete_id: striker.id,
      striker_name: striker.name,
      non_striker_athlete_id: nonStriker.id,
      non_striker_name: nonStriker.name,
      bowler_athlete_id: bowler.id,
      bowler_name: bowler.name,
      dismissal_type: o.wicket,
      dismissed_athlete_id: o.wicket ? striker.id : null,
      dismissed_name: o.wicket ? striker.name : null,
      fielder_athlete_id: null,
      fielder_name: fielderName,
      comment: null,
      created_at: startedAt,
      created_by: null,
    } as unknown as MCBallEvent);

    runs += total;
    extras += o.extra_runs;
    if (o.legal) legalBalls += 1;

    if (o.wicket) {
      wickets += 1;
      // bring in next batter on strike
      if (nextBatter < batters.length) {
        strikerIdx = nextBatter;
        nextBatter += 1;
      } else {
        break;
      }
    } else if (o.runs_off_bat % 2 === 1) {
      // rotate strike on odd runs
      const t = strikerIdx; strikerIdx = nonStrikerIdx; nonStrikerIdx = t;
    }

    // end of over
    if (o.legal && ballInOver >= 6) {
      // rotate strike
      const t = strikerIdx; strikerIdx = nonStrikerIdx; nonStrikerIdx = t;
      overNumber += 1;
      ballInOver = 0;
      // change bowler (avoid same as previous)
      let next = rng.int(0, bowlers.length - 1);
      if (bowlers.length > 1 && next === bowlerIdx) next = (next + 1) % bowlers.length;
      lastBowlerIdx = bowlerIdx;
      bowlerIdx = next;
    } else if (!o.legal && ballInOver >= 8) {
      // safety hatch — shouldn't happen but avoid runaway
      ballInOver = 0;
      overNumber += 1;
      const t = strikerIdx; strikerIdx = nonStrikerIdx; nonStrikerIdx = t;
      let next = rng.int(0, bowlers.length - 1);
      if (bowlers.length > 1 && next === bowlerIdx) next = (next + 1) % bowlers.length;
      lastBowlerIdx = bowlerIdx;
      bowlerIdx = next;
    }
  }
  void lastBowlerIdx;

  const finalOvers = Math.floor(legalBalls / 6);
  const finalBalls = legalBalls % 6;
  const isLive = stopAtLegalBalls !== undefined;
  const isChase = target !== undefined;

  const innings: MCInnings = {
    id: inningsId,
    tenant_id: tenantId,
    match_id: matchId,
    innings_number: inningsNumber,
    batting_team_id: battingTeamId,
    bowling_team_id: bowlingTeamId,
    runs,
    wickets,
    overs: finalOvers,
    balls: finalBalls,
    extras,
    target: target ?? null,
    status: isLive ? "in_progress" : "completed",
    started_at: startedAt,
    completed_at: isLive ? null : startedAt,
    created_at: startedAt,
    updated_at: startedAt,
  } as unknown as MCInnings;

  return {
    innings,
    events,
    runs,
    wickets,
    legalBalls,
    extras,
    striker: batters[strikerIdx] ?? null,
    nonStriker: batters[nonStrikerIdx] ?? null,
    bowler: bowlers[bowlerIdx] ?? null,
  };
  void isChase;
}

/* ---------- generator ---------- */
export function generateDemoData(tenantId: string): DemoData {
  const rng = makeRng(`demo:${tenantId}`);
  const now = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  };
  const isoDate = (offsetDays: number) => iso(offsetDays).slice(0, 10);

  /* --- 150 players. Slots 0..4 are the pre-planted named U16 stars so
     * search "rah" / "aman" / "aryan" / "mohit" / "rohit" surfaces them and
     * (through the squad assignment below) the U16 team. */
  const players: AthleteWithStudent[] = Array.from({ length: 150 }, (_, i) => {
    const pn = i < NAMED_U16_PLAYERS.length ? NAMED_U16_PLAYERS[i] : name(rng);
    const role = rng.pick(ROLES);
    const age = rng.int(11, 24);
    const dob = `${now.getFullYear() - age}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
    const playerId = `DEMO${String(i + 1).padStart(3, "0")}`;
    const id = `demo-athlete-${i + 1}`;
    return {
      id,
      tenant_id: tenantId,
      student_id: `demo-student-${i + 1}`,
      primary_sport: "cricket",
      created_at: iso(-rng.int(30, 900)),
      updated_at: iso(-rng.int(0, 20)),
      student: {
        id: `demo-student-${i + 1}`,
        name: pn,
        photo_url: photo(pn + i),
        dob,
        gender: rng.chance(0.75) ? "male" : "female",
        batch_id: null,
        status: "active",
        player_id: playerId,
        phone: null,
      },
      cricket: {
        athlete_profile_id: id,
        playing_role: role,
        batting_style: rng.chance(0.8) ? "right_hand" : "left_hand",
        bowling_style: rng.pick(["Right-arm fast", "Right-arm medium", "Off-spin", "Leg-spin", "Left-arm orthodox"]),
      } as unknown as AthleteWithStudent["cricket"],
      team: null,
    } as unknown as AthleteWithStudent;
  });

  const asPlayer = (p: AthleteWithStudent): Player => ({ id: p.id, name: p.student?.name ?? "Player" });

  /* --- 11 teams: 6 academy + 5 external opponents --- */
  const teamDefs: Array<{
    name: string; short: string; age: string; color: string;
    coach: string; city: string; external: boolean;
  }> = [
    // teams[0] is the live-match academy team. Keep the id "demo-team-live-a".
    { name: "Sai Sports Academy U16", short: "SAI_U16", age: "U16", color: "#3B82F6", coach: "Coach V. Menon", city: "Bengaluru", external: false },
    // teams[1] is the live-match opponent. Keep the id "demo-team-live-b".
    { name: "Sky Cricket Academy", short: "SKY", age: "U16", color: "#EF4444", coach: "Coach P. Sharma", city: "Mumbai", external: true },
    { name: "Sai Sports Academy U12", short: "SAI_U12", age: "U12", color: "#10B981", coach: "Coach R. Kulkarni", city: "Bengaluru", external: false },
    { name: "Sai Sports Academy U14", short: "SAI_U14", age: "U14", color: "#F59E0B", coach: "Coach S. Iyer", city: "Bengaluru", external: false },
    { name: "Sai Sports Academy U19", short: "SAI_U19", age: "U19", color: "#0EA5E9", coach: "Coach A. Khan", city: "Bengaluru", external: false },
    { name: "Sai Sports Academy Senior Team", short: "SAI_SEN", age: "Senior", color: "#22C55E", coach: "Coach R. Kulkarni", city: "Bengaluru", external: false },
    { name: "Sai Sports Academy Girls Team", short: "SAI_GIR", age: "Girls", color: "#EC4899", coach: "Coach A. Khan", city: "Bengaluru", external: false },
    { name: "Royal Cricket Club", short: "ROY", age: "Senior", color: "#8B5CF6", coach: "Coach D. Rao", city: "Mumbai", external: true },
    { name: "City Cricket Academy", short: "CIT", age: "U19", color: "#E8873C", coach: "Coach N. Gupta", city: "Chennai", external: true },
    { name: "Lions CC", short: "LIO", age: "Senior", color: "#F97316", coach: "Coach A. Bhatt", city: "Pune", external: true },
    { name: "Warriors CC", short: "WAR", age: "Senior", color: "#A855F7", coach: "Coach K. Malhotra", city: "Delhi", external: true },
  ];
  const teams: TeamWithCount[] = teamDefs.map((t, i) => ({
    id: i === 0 ? "demo-team-live-a" : i === 1 ? "demo-team-live-b" : `demo-team-${i + 1}`,
    tenant_id: tenantId,
    name: t.name,
    short_name: t.short,
    age_group: t.age,
    logo_url: null,
    team_color: t.color,
    coach_name: t.coach,
    city: t.city,
    status: "active",
    season: "2026",
    is_external: t.external,
    created_at: iso(-rng.int(200, 700)),
    updated_at: iso(-rng.int(0, 30)),
    player_count: 14 + rng.int(0, 4),
  } as unknown as TeamWithCount));

  // 14 players per team so squads look real. First team (U16) uses the
  // pre-planted named players (Rahul Sharma, Aman Patel, ...) which live at
  // players[0..4], so search "rah" / "aman" surfaces the U16 squad.
  const teamSquads: Record<string, Player[]> = {};
  const SQUAD_SIZE = 14;
  teams.forEach((t, ti) => {
    const start = (ti * SQUAD_SIZE) % players.length;
    const squad: Player[] = [];
    for (let k = 0; k < SQUAD_SIZE; k++) squad.push(asPlayer(players[(start + k) % players.length]));
    teamSquads[t.id] = squad;
  });

  /* ============================================================
   * COMPLETED MATCH 1 — Senior Squad vs Under-19 Kings
   * Full ball-by-ball, 20 overs each side, decided on runs.
   * ============================================================ */
  const m1 = {
    id: "demo-match-1",
    teamA: teams.find((t) => t.short_name === "SAI_SEN")!,
    teamB: teams.find((t) => t.short_name === "SAI_U19")!,
    date: isoDate(-4),
    ground: "Chinnaswamy Ground",
    tournamentId: "demo-tournament-1",
  };
  const m1_i1 = simulateInnings({
    rng, tenantId, matchId: m1.id, inningsNumber: 1,
    battingTeamId: m1.teamA.id, bowlingTeamId: m1.teamB.id,
    batters: teamSquads[m1.teamA.id], bowlers: teamSquads[m1.teamB.id].slice(0, 6),
    maxOvers: 20, seqStart: 0, startedAt: iso(-4),
  });
  const m1_i2 = simulateInnings({
    rng, tenantId, matchId: m1.id, inningsNumber: 2,
    battingTeamId: m1.teamB.id, bowlingTeamId: m1.teamA.id,
    batters: teamSquads[m1.teamB.id], bowlers: teamSquads[m1.teamA.id].slice(0, 6),
    maxOvers: 20, target: m1_i1.runs + 1, seqStart: 0, startedAt: iso(-4),
  });
  const m1_winner = m1_i1.runs >= m1_i2.runs ? m1.teamA : m1.teamB;
  const m1_margin = m1_i1.runs >= m1_i2.runs
    ? m1_i1.runs - m1_i2.runs
    : 10 - m1_i2.wickets;
  const m1_marginType = m1_i1.runs >= m1_i2.runs ? "runs" : "wickets";
  const m1_pom = players[3];

  /* ============================================================
   * COMPLETED MATCH 2 — Under-17 Titans vs Under-15 Blues
   * ============================================================ */
  const m2 = {
    id: "demo-match-2",
    teamA: teams.find((t) => t.short_name === "SAI_U19")!,
    teamB: teams.find((t) => t.short_name === "SAI_U14")!,
    date: isoDate(-10),
    ground: "Sardar Patel Ground",
    tournamentId: "demo-tournament-2",
  };
  const m2_i1 = simulateInnings({
    rng, tenantId, matchId: m2.id, inningsNumber: 1,
    battingTeamId: m2.teamA.id, bowlingTeamId: m2.teamB.id,
    batters: teamSquads[m2.teamA.id], bowlers: teamSquads[m2.teamB.id].slice(0, 6),
    maxOvers: 20, seqStart: 0, startedAt: iso(-10),
  });
  const m2_i2 = simulateInnings({
    rng, tenantId, matchId: m2.id, inningsNumber: 2,
    battingTeamId: m2.teamB.id, bowlingTeamId: m2.teamA.id,
    batters: teamSquads[m2.teamB.id], bowlers: teamSquads[m2.teamA.id].slice(0, 6),
    maxOvers: 20, target: m2_i1.runs + 1, seqStart: 0, startedAt: iso(-10),
  });
  const m2_winner = m2_i1.runs >= m2_i2.runs ? m2.teamA : m2.teamB;
  const m2_margin = m2_i1.runs >= m2_i2.runs
    ? m2_i1.runs - m2_i2.runs
    : 10 - m2_i2.wickets;
  const m2_marginType = m2_i1.runs >= m2_i2.runs ? "runs" : "wickets";
  const m2_pom = players[17];

  /* ============================================================
   * LIVE MATCH — Sky Cricket Academy U16 vs Royal Cricket Academy
   * Stopped mid-innings so the scorer can naturally continue.
   * Target: 10.5 overs, ~126/4 (target range enforced by loop cap).
   * ============================================================ */
  const liveTeamA = teams[0];
  const liveTeamB = teams[1];
  const liveMatchId = "demo-match-live";
  // Stop at 65 legal balls == 10 overs + 5 balls == 10.5 overs display
  const live_i1 = simulateInnings({
    rng, tenantId, matchId: liveMatchId, inningsNumber: 1,
    battingTeamId: liveTeamA.id, bowlingTeamId: liveTeamB.id,
    batters: teamSquads[liveTeamA.id], bowlers: teamSquads[liveTeamB.id].slice(0, 6),
    maxOvers: 20, stopAtLegalBalls: 65, seqStart: 0, startedAt: iso(0),
  });

  const liveMatch = {
    id: liveMatchId,
    tenant_id: tenantId,
    team_a_id: liveTeamA.id,
    team_b_id: liveTeamB.id,
    match_type: "friendly",
    match_format: "T20",
    overs: 20,
    scheduled_date: isoDate(0),
    scheduled_time: "15:00",
    ground_name: "Chinnaswamy Ground",
    status: "live",
    toss_winner: liveTeamA.id,
    toss_decision: "bat",
    winner_team: null,
    result: null,
    winning_margin: null,
    winning_margin_type: null,
    victory_type: null,
    player_of_match_athlete_id: null,
    match_locked: false,
    created_at: iso(-1),
    updated_at: iso(0),
    current_score: `${live_i1.runs}/${live_i1.wickets}`,
    current_overs: `${Math.floor(live_i1.legalBalls / 6)}.${live_i1.legalBalls % 6}`,
    team_a: liveTeamA,
    team_b: liveTeamB,
  } as unknown as MatchWithTeams;

  const liveState: DemoLiveState = {
    matchId: liveMatchId,
    inningsId: live_i1.innings.id,
    strikerId: live_i1.striker?.id ?? "",
    strikerName: live_i1.striker?.name ?? "",
    nonStrikerId: live_i1.nonStriker?.id ?? "",
    nonStrikerName: live_i1.nonStriker?.name ?? "",
    bowlerId: live_i1.bowler?.id ?? "",
    bowlerName: live_i1.bowler?.name ?? "",
    currentOver: Math.floor(live_i1.legalBalls / 6) + 1,
    ballInOver: live_i1.legalBalls % 6,
    runs: live_i1.runs,
    wickets: live_i1.wickets,
    overs: `${Math.floor(live_i1.legalBalls / 6)}.${live_i1.legalBalls % 6}`,
  };

  /* --- assemble match rows for the two completed matches --- */
  const completedMatch = (
    def: typeof m1,
    winner: TeamWithCount,
    margin: number,
    marginType: string,
    pomId: string,
  ): MatchWithTeams => ({
    id: def.id,
    tenant_id: tenantId,
    team_a_id: def.teamA.id,
    team_b_id: def.teamB.id,
    match_type: "tournament",
    match_format: "T20",
    overs: 20,
    scheduled_date: def.date,
    scheduled_time: "14:30",
    ground_name: def.ground,
    status: "completed",
    toss_winner: def.teamA.id,
    toss_decision: "bat",
    winner_team: winner.id,
    result: `${winner.name} won by ${margin} ${marginType}`,
    winning_margin: margin,
    winning_margin_type: marginType,
    victory_type: marginType,
    player_of_match_athlete_id: pomId,
    match_locked: true,
    tournament_id: def.tournamentId,
    umpire: "R. Menon",
    created_at: def.date,
    updated_at: def.date,
    team_a: def.teamA,
    team_b: def.teamB,
  } as unknown as MatchWithTeams);

  const featuredMatches: MatchWithTeams[] = [
    liveMatch,
    completedMatch(m1, m1_winner, m1_margin, m1_marginType, m1_pom.id),
    completedMatch(m2, m2_winner, m2_margin, m2_marginType, m2_pom.id),
  ];

  /* --- additional summary-only matches to make the list look busy --- */
  const backgroundMatches: MatchWithTeams[] = [];
  for (let i = 0; i < 30; i++) {
    const a = teams[2 + rng.int(0, teams.length - 3)];
    let b = teams[2 + rng.int(0, teams.length - 3)];
    while (b.id === a.id) b = teams[2 + rng.int(0, teams.length - 3)];
    const scoreA = rng.int(110, 190);
    const scoreB = rng.int(95, 185);
    const winner = scoreA > scoreB ? a : b;
    const margin = Math.abs(scoreA - scoreB);
    backgroundMatches.push({
      id: `demo-match-bg-${i + 1}`,
      tenant_id: tenantId,
      team_a_id: a.id,
      team_b_id: b.id,
      match_type: rng.pick(["practice", "friendly", "tournament", "league"]),
      match_format: "T20",
      overs: 20,
      scheduled_date: isoDate(-rng.int(15, 300)),
      scheduled_time: "15:00",
      ground_name: rng.pick(GROUNDS),
      status: "completed",
      toss_winner: a.id,
      toss_decision: rng.chance(0.5) ? "bat" : "bowl",
      winner_team: winner.id,
      result: `${winner.name} won by ${margin} runs`,
      winning_margin: margin,
      winning_margin_type: "runs",
      victory_type: "runs",
      player_of_match_athlete_id: players[rng.int(0, players.length - 1)].id,
      match_locked: true,
      created_at: iso(-rng.int(15, 300)),
      updated_at: iso(-rng.int(0, 5)),
      team_a: a,
      team_b: b,
    } as unknown as MatchWithTeams);
  }
  const upcoming: MatchWithTeams[] = Array.from({ length: 3 }, (_, i) => {
    const a = teams[2 + rng.int(0, teams.length - 3)];
    let b = teams[2 + rng.int(0, teams.length - 3)];
    while (b.id === a.id) b = teams[2 + rng.int(0, teams.length - 3)];
    return {
      id: `demo-match-upcoming-${i + 1}`,
      tenant_id: tenantId,
      team_a_id: a.id,
      team_b_id: b.id,
      match_type: "league",
      match_format: "T20",
      overs: 20,
      scheduled_date: isoDate(rng.int(1, 30)),
      scheduled_time: "15:00",
      ground_name: rng.pick(GROUNDS),
      status: "scheduled",
      toss_winner: null,
      toss_decision: null,
      winner_team: null,
      result: null,
      winning_margin: null,
      winning_margin_type: null,
      victory_type: null,
      player_of_match_athlete_id: null,
      match_locked: false,
      created_at: iso(-rng.int(1, 5)),
      updated_at: iso(0),
      team_a: a,
      team_b: b,
    } as unknown as MatchWithTeams;
  });

  const matches: MatchWithTeams[] = [...featuredMatches, ...backgroundMatches, ...upcoming];

  const innings: MCInnings[] = [m1_i1.innings, m1_i2.innings, m2_i1.innings, m2_i2.innings, live_i1.innings];
  const ballEvents: MCBallEvent[] = [...m1_i1.events, ...m1_i2.events, ...m2_i1.events, ...m2_i2.events, ...live_i1.events];

  /* --- 5 tournaments --- */
  const tournamentNames = [
    { name: "Summer Cup", type: "league", season: "Summer 2026" },
    { name: "Academy League", type: "league", season: "2026" },
    { name: "Weekend Practice", type: "practice_series", season: "2026" },
    { name: "District Championship", type: "knockout", season: "2026" },
    { name: "State Qualifier", type: "league_knockout", season: "2026" },
  ];
  const tournaments: MCTournament[] = tournamentNames.map((t, i) => ({
    id: `demo-tournament-${i + 1}`,
    tenant_id: tenantId,
    name: t.name,
    season: t.season,
    age_group: rng.pick(["Senior", "U19", "U16"]),
    tournament_type: t.type,
    format: "T20",
    overs: 20,
    status: i < 2 ? "ongoing" : "completed",
    start_date: isoDate(-rng.int(30, 200)),
    end_date: isoDate(rng.int(-10, 40)),
    ground_name: rng.pick(GROUNDS),
    max_teams: 8,
    points_for_win: 2,
    points_for_tie: 1,
    points_for_loss: 0,
    points_for_no_result: 1,
    description: `${t.name} — demo tournament with sample fixtures.`,
    logo_url: null,
    visibility: "academy",
    created_at: iso(-rng.int(60, 200)),
    updated_at: iso(-rng.int(0, 5)),
    created_by: null,
  } as unknown as MCTournament));

  /* --- Records / recognitions / hall of fame --- */
  const records = [
    { id: "demo-rec-1", record_type: "highest_score", title: "Highest individual score", player_name: m1_pom.student!.name, value: `${Math.max(m1_i1.runs, m1_i2.runs, 90)}*` },
    { id: "demo-rec-2", record_type: "best_bowling", title: "Best bowling figures", player_name: players[5].student!.name, value: "6/12" },
    { id: "demo-rec-3", record_type: "highest_total", title: "Highest team total", player_name: m1.teamA.name, value: `${m1_i1.runs}/${m1_i1.wickets}` },
    { id: "demo-rec-4", record_type: "most_sixes", title: "Most sixes in an innings", player_name: players[12].student!.name, value: "11" },
    { id: "demo-rec-5", record_type: "fastest_fifty", title: "Fastest fifty", player_name: players[8].student!.name, value: "19 balls" },
  ];
  const recognitions = Array.from({ length: 12 }, (_, i) => ({
    id: `demo-recognition-${i + 1}`,
    title: rng.pick(["Player of the Week", "Rising Star", "Batter of the Month", "Bowler of the Month", "Team Player Award"]),
    recognition_type: rng.pick(["performance", "achievement", "milestone"]),
    player_name: players[rng.int(0, players.length - 1)].student!.name,
    awarded_at: iso(-rng.int(1, 90)),
  }));
  const hallOfFame = Array.from({ length: 6 }, (_, i) => ({
    id: `demo-hof-${i + 1}`,
    player_name: players[rng.int(0, players.length - 1)].student!.name,
    era: rng.pick(["2018–2020", "2020–2022", "2022–2024"]),
    note: "Represented the academy at state level. Legendary contribution.",
  }));

  /* --- perf rows (per-athlete rollup used by Performance Analysis) --- */
  const perfRows: DemoPerfRow[] = players.map((p) => {
    const role = p.cricket?.playing_role ?? "batter";
    const matchesPlayed = rng.int(4, 28);
    const bat = role === "bowler" ? rng.chance(0.3) : true;
    const bowl = role === "batter" ? rng.chance(0.3) : true;
    const runs = bat ? rng.int(matchesPlayed * 8, matchesPlayed * 55) : rng.int(0, matchesPlayed * 8);
    const wkts = bowl ? rng.int(0, Math.round(matchesPlayed * 1.8)) : rng.int(0, 2);
    const notOuts = rng.int(0, Math.max(1, Math.round(matchesPlayed * 0.2)));
    const dismissed = Math.max(1, matchesPlayed - notOuts);
    const average = runs / dismissed;
    const strikeRate = 80 + rng.int(0, 80);
    const economy = 4 + rng.next() * 4;
    return {
      athleteId: p.id,
      matches: matchesPlayed,
      runs,
      wickets: wkts,
      average: Math.round(average * 10) / 10,
      strikeRate: Math.round(strikeRate * 10) / 10,
      economy: Math.round(economy * 100) / 100,
      fifties: Math.max(0, Math.floor(runs / 250)),
      hundreds: runs > 900 ? rng.int(1, 3) : 0,
      bestBat: `${rng.int(35, 145)}${rng.chance(0.3) ? "*" : ""}`,
      bestBowl: `${rng.int(2, 6)}/${rng.int(8, 34)}`,
    };
  });

  /* --- AI reports --- */
  const aiReports: DemoAIReport[] = [
    {
      id: "demo-ai-academy",
      report_type: "academy_monthly",
      title: "Academy Monthly Review",
      summary:
        "Strong month across senior and U16 squads. Batting depth improved; new-ball bowling remains the growth area.",
      generated_at: iso(-2),
      key_findings: [
        { label: "Top run scorer", detail: `${players[0].student!.name} — ${perfRows[0].runs} runs` },
        { label: "Leading wicket taker", detail: `${players[5].student!.name} — ${perfRows[5].wickets} wickets` },
        { label: "Win rate", detail: "62% across recent matches" },
      ],
      strengths: [
        { label: "Middle-order stability" },
        { label: "Spin bowling in death overs" },
      ],
    },
    {
      id: "demo-ai-match-1",
      report_type: "match",
      title: `${m1.teamA.name} vs ${m1.teamB.name} — Match Report`,
      summary: `${m1_winner.name} secured a decisive win. First innings total of ${m1_i1.runs}/${m1_i1.wickets} set the tone.`,
      generated_at: iso(-3),
      key_findings: [
        { label: `${m1.teamA.name}: ${m1_i1.runs}/${m1_i1.wickets}` },
        { label: `${m1.teamB.name}: ${m1_i2.runs}/${m1_i2.wickets}` },
        { label: "Player of the Match", detail: m1_pom.student!.name },
      ],
      strengths: [{ label: "Powerplay execution" }, { label: "Death-overs discipline" }],
    },
    ...players.slice(0, 6).map((p, i): DemoAIReport => ({
      id: `demo-ai-player-${i + 1}`,
      report_type: "player",
      title: `${p.student!.name} — Player Report`,
      summary: `Consistent performer averaging ${perfRows[i].average.toFixed(1)} across ${perfRows[i].matches} matches.`,
      generated_at: iso(-rng.int(3, 40)),
      key_findings: [
        { label: `${perfRows[i].runs} runs`, detail: `SR ${perfRows[i].strikeRate.toFixed(0)}` },
        { label: `${perfRows[i].wickets} wickets`, detail: `Econ ${perfRows[i].economy.toFixed(2)}` },
      ],
      strengths: [{ label: "Composed under pressure" }, { label: "High conversion rate on starts" }],
    })),
  ];

  const matchSquads: Record<string, DemoMatchSquads> = {
    [m1.id]: { [m1.teamA.id]: teamSquads[m1.teamA.id], [m1.teamB.id]: teamSquads[m1.teamB.id] },
    [m2.id]: { [m2.teamA.id]: teamSquads[m2.teamA.id], [m2.teamB.id]: teamSquads[m2.teamB.id] },
    [liveMatchId]: { [liveTeamA.id]: teamSquads[liveTeamA.id], [liveTeamB.id]: teamSquads[liveTeamB.id] },
  };

  return {
    __v: 0,
    tenantId,
    players,
    teams,
    tournaments,
    matches,
    liveMatch,
    innings,
    ballEvents,
    liveState,
    matchSquads,
    records,
    recognitions,
    hallOfFame,
    perfRows,
    aiReports,
  };
}
