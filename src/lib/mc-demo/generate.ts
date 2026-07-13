/* Deterministic demo fixture generator.
 * NO writes to Supabase — pure in-memory data cast to the shapes the UI reads.
 * Uses `as unknown as T` because Supabase Row types have many nullable columns
 * we don't populate; the UI never reads those columns.
 */
import { makeRng, type Rng } from "./rng";
import type { MatchWithTeams } from "@/lib/mc-matches";
import type { TeamWithCount } from "@/lib/mc-teams";
import type { AthleteWithStudent } from "@/lib/mc-athletes";
import type { MCTournament } from "@/lib/mc-tournaments";

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
  "Chinnaswamy Ground", "Wankhede Practice Field", "Feroz Shah Nets", "Eden Turf",
  "MA Chidambaram Practice", "Rajiv Gandhi Stadium", "Sardar Patel Ground", "Green Park",
];
const TEAM_COLORS = ["#E8873C", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899", "#22C55E", "#F97316"];
const ROLES = ["batter", "bowler", "all_rounder", "wicket_keeper"] as const;

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

export type DemoData = {
  __v: number;
  tenantId: string;
  players: AthleteWithStudent[];
  teams: TeamWithCount[];
  tournaments: MCTournament[];
  matches: MatchWithTeams[];
  liveMatch: MatchWithTeams;
  records: Array<{ id: string; record_type: string; title: string; player_name: string; value: string }>;
  recognitions: Array<{ id: string; title: string; recognition_type: string; player_name: string; awarded_at: string }>;
  hallOfFame: Array<{ id: string; player_name: string; era: string; note: string }>;
  perfRows: DemoPerfRow[];
  aiReports: DemoAIReport[];
};

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

  /* --- 150 players --- */
  const players: AthleteWithStudent[] = Array.from({ length: 150 }, (_, i) => {
    const pn = name(rng);
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

  /* --- 10 teams --- */
  const teamDefs = [
    { name: "Junior Development", short: "JDV", age: "U12" },
    { name: "Senior Squad", short: "SEN", age: "Senior" },
    { name: "Girls Elite", short: "GIR", age: "Girls" },
    { name: "Under-13 Colts", short: "U13", age: "U14" },
    { name: "Under-15 Blues", short: "U15", age: "U16" },
    { name: "Under-17 Titans", short: "U17", age: "U16" },
    { name: "Under-19 Kings", short: "U19", age: "U19" },
    { name: "Practice XI", short: "PRA", age: "Senior" },
    { name: "Tournament Squad", short: "TRN", age: "Senior" },
    { name: "Representative XI", short: "REP", age: "Senior" },
  ];
  const coaches = ["Coach R. Kulkarni", "Coach V. Menon", "Coach S. Iyer", "Coach P. Sharma", "Coach A. Khan"];
  const teams: TeamWithCount[] = teamDefs.map((t, i) => ({
    id: `demo-team-${i + 1}`,
    tenant_id: tenantId,
    name: t.name,
    short_name: t.short,
    age_group: t.age,
    logo_url: null,
    team_color: TEAM_COLORS[i % TEAM_COLORS.length],
    coach_name: coaches[i % coaches.length],
    city: rng.pick(CITIES),
    status: "active",
    season: "2026",
    is_external: false,
    created_at: iso(-rng.int(100, 700)),
    updated_at: iso(-rng.int(0, 30)),
    player_count: 15 + rng.int(0, 5),
  } as unknown as TeamWithCount));

  /* --- Live demo match (Sky Cricket Academy U16 vs Royal) --- */
  const liveTeamA = {
    id: "demo-team-live-a",
    tenant_id: tenantId,
    name: "Sky Cricket Academy U16",
    short_name: "SKY",
    age_group: "U16",
    logo_url: null,
    team_color: "#3B82F6",
    coach_name: "Coach V. Menon",
    city: "Bengaluru",
    status: "active",
    season: "2026",
    is_external: false,
    created_at: iso(-400),
    updated_at: iso(-1),
    player_count: 15,
  } as unknown as TeamWithCount;
  const liveTeamB = {
    id: "demo-team-live-b",
    tenant_id: tenantId,
    name: "Royal Cricket Academy",
    short_name: "RCA",
    age_group: "U16",
    logo_url: null,
    team_color: "#EF4444",
    coach_name: "Coach P. Sharma",
    city: "Mumbai",
    status: "active",
    season: "2026",
    is_external: true,
    created_at: iso(-350),
    updated_at: iso(-1),
    player_count: 14,
  } as unknown as TeamWithCount;
  teams.unshift(liveTeamA, liveTeamB);

  const liveMatch = {
    id: "demo-match-live",
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
    // Convenience fields the scorecard reads
    current_score: "126/4",
    current_overs: "10.5",
    team_a: liveTeamA,
    team_b: liveTeamB,
  } as unknown as MatchWithTeams;

  /* --- 80 completed + 3 upcoming --- */
  const matches: MatchWithTeams[] = [];
  for (let i = 0; i < 80; i++) {
    const a = teams[rng.int(2, teams.length - 1)];
    let b = teams[rng.int(2, teams.length - 1)];
    while (b.id === a.id) b = teams[rng.int(2, teams.length - 1)];
    const scoreA = rng.int(80, 210);
    const scoreB = rng.int(70, 205);
    const winner = scoreA > scoreB ? a : b;
    const margin = Math.abs(scoreA - scoreB);
    matches.push({
      id: `demo-match-${i + 1}`,
      tenant_id: tenantId,
      team_a_id: a.id,
      team_b_id: b.id,
      match_type: rng.pick(["practice", "friendly", "tournament", "league"]),
      match_format: "T20",
      overs: 20,
      scheduled_date: isoDate(-rng.int(3, 400)),
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
      created_at: iso(-rng.int(3, 400)),
      updated_at: iso(-rng.int(0, 3)),
      team_a: a,
      team_b: b,
    } as unknown as MatchWithTeams);
  }
  for (let i = 0; i < 3; i++) {
    const a = teams[rng.int(2, teams.length - 1)];
    let b = teams[rng.int(2, teams.length - 1)];
    while (b.id === a.id) b = teams[rng.int(2, teams.length - 1)];
    matches.push({
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
    } as unknown as MatchWithTeams);
  }
  matches.unshift(liveMatch);

  /* --- 5 tournaments --- */
  const tournamentNames = [
    { name: "Summer Cup 2026", type: "league", season: "Summer 2026" },
    { name: "Winter Cup 2025", type: "knockout", season: "Winter 2025" },
    { name: "Practice League", type: "practice_series", season: "2026" },
    { name: "District League", type: "league", season: "2026" },
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
    { id: "demo-rec-1", record_type: "highest_score", title: "Highest individual score", player_name: players[0].student!.name, value: "184*" },
    { id: "demo-rec-2", record_type: "best_bowling", title: "Best bowling figures", player_name: players[5].student!.name, value: "6/12" },
    { id: "demo-rec-3", record_type: "highest_total", title: "Highest team total", player_name: "Senior Squad", value: "241/5" },
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

  return {
    __v: 0, // set by writer
    tenantId,
    players,
    teams,
    tournaments,
    matches,
    liveMatch,
    records,
    recognitions,
    hallOfFame,
  };
}
