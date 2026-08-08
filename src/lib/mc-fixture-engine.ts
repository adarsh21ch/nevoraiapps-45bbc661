import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/* ================================================================
 * MATCH CENTER FIXTURE ENGINE
 * ----------------------------------------------------------------
 * Handles tournament schedule generation, knockout advancement,
 * and round-robin point calculations.
 *
 *   • Bracket wiring lives in mc_tournament_rounds (feeder_a/b → advances_to).
 *   • Matches are children of rounds.
 * ================================================================ */

export interface FixtureDraft {
  round_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  scheduled_date: string;
  slot_key: string;
  feeder_a_slot?: string;
  feeder_b_slot?: string;
}

export type MCRoundInsert = Database["public"]["Tables"]["mc_tournament_rounds"]["Insert"];

export async function generateFixtures(
  tournamentId: string,
  tenantId: string,
  matches: FixtureDraft[],
) {
  // 1. Clear existing
  const { data: oldRounds } = await supabase
    .from("mc_tournament_rounds")
    .select("id, match_id")
    .eq("tournament_id", tournamentId);

  if (oldRounds?.length) {
    const matchIds = oldRounds.map((r) => r.match_id).filter(Boolean) as string[];
    if (matchIds.length) {
      await supabase.from("mc_matches").delete().in("id", matchIds);
    }
    await supabase.from("mc_tournament_rounds").delete().eq("tournament_id", tournamentId);
  }

  // 2. Insert rounds and matches
  const createdRounds: any[] = [];
  const createdMatches: any[] = [];

  for (const m of matches) {
    // Create match first
    const { data: match, error: matchError } = await supabase
      .from("mc_matches")
      .insert({
        tenant_id: tenantId,
        tournament_id: tournamentId,
        home_team_id: m.team_a_id,
        away_team_id: m.team_b_id,
        scheduled_date: m.scheduled_date,
        status: "upcoming",
      })
      .select()
      .single();

    if (matchError) throw matchError;
    createdMatches.push(match);

    // Create round
    const { data: round, error: roundError } = await supabase
      .from("mc_tournament_rounds")
      .insert({
        tournament_id: tournamentId,
        round_number: m.round_number,
        match_id: match.id,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        slot_key: m.slot_key,
      })
      .select()
      .single();

    if (roundError) throw roundError;
    createdRounds.push(round);
  }

  // 3. Link knockout slots if applicable
  const knockout = matches.filter((m) => m.slot_key);
  if (knockout.length > 0) {
    const roundByKey = new Map<string, string>();
    for (let i = 0; i < knockout.length; i++) {
      const f = knockout[i];
      const matchInCreated = createdMatches.find(
        (cm) => cm.scheduled_date === f.scheduled_date && cm.home_team_id === f.team_a_id,
      );
      const row = createdRounds.find((r) => r.match_id === matchInCreated?.id);
      if (row) roundByKey.set(f.slot_key, row.id);
    }

    for (const f of knockout) {
      if (!f.feeder_a_slot && !f.feeder_b_slot) continue;
      const roundId = roundByKey.get(f.slot_key);
      if (!roundId) continue;
      const feederA = f.feeder_a_slot ? roundByKey.get(f.feeder_a_slot) : null;
      const feederB = f.feeder_b_slot ? roundByKey.get(f.feeder_b_slot) : null;

      const { error: updateAError } = await supabase
        .from("mc_tournament_rounds")
        .update({
          feeder_a_round_id: feederA ?? null,
          feeder_b_round_id: feederB ?? null,
        })
        .eq("id", roundId);

      if (updateAError) throw updateAError;

      const feederRoundIds = [feederA, feederB].filter(Boolean) as string[];
      if (feederRoundIds.length > 0) {
        const { error: updateBError } = await supabase
          .from("mc_tournament_rounds")
          .update({ advances_to_round_id: roundId })
          .in("id", feederRoundIds);

        if (updateBError) throw updateBError;
      }
    }
  }

  return { createdMatches, createdRounds };
}

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
    const { error: roundError } = await supabase
      .from("mc_tournament_rounds")
      .update(patch)
      .eq("id", nextRound.id);
    if (roundError) throw roundError;

    if (nextRound.match_id) {
      const matchPatch: Database["public"]["Tables"]["mc_matches"]["Update"] = {};
      if (patch.team_a_id) matchPatch.home_team_id = patch.team_a_id;
      if (patch.team_b_id) matchPatch.away_team_id = patch.team_b_id;

      if (Object.keys(matchPatch).length > 0) {
        const { error: matchError } = await supabase
          .from("mc_matches")
          .update(matchPatch)
          .eq("id", nextRound.match_id);
        if (matchError) throw matchError;
      }
    }
  }
}
