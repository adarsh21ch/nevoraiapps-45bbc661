import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listMatchSquad } from "./mc-matches";

/**
 * Validates that a match is editable (scheduled or live) and user is staff.
 */
async function assertMatchEditable(matchId: string, supabaseClient: any) {
  const { data: match, error } = await supabaseClient
    .from("mc_matches")
    .select("status, tenant_id")
    .eq("id", matchId)
    .single();

  if (error || !match) throw new Error("Match not found");
  if (match.status === "completed" || match.status === "archived") {
    throw new Error("Cannot edit squad of a finished or locked match.");
  }
  return match;
}

export const renameGuestSquadPlayer = createServerFn({ method: "POST" })
  .validator((data: { squadRowId: string, newName: string }) => 
    z.object({ squadRowId: z.string(), newName: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { squadRowId, newName } = data;
    
    const { data: row, error: rowErr } = await supabase
      .from("mc_match_squads")
      .select("athlete_profile_id, match_id")
      .eq("id", squadRowId)
      .single();

    if (rowErr || !row) throw new Error("Squad player not found");
    if (row.athlete_profile_id) throw new Error("Cannot rename an academy player. Rename them in the student record.");

    await assertMatchEditable(row.match_id, supabase);

    const { error } = await supabase
      .from("mc_match_squads")
      .update({ external_player_name: newName })
      .eq("id", squadRowId);

    if (error) throw error;
    return { success: true };
  });

export const replaceSquadPlayer = createServerFn({ method: "POST" })
  .validator((data: { 
    squadRowId: string, 
    replaceWith: { athleteProfileId: string } | { guestName: string } 
  }) => 
    z.object({ 
      squadRowId: z.string(), 
      replaceWith: z.union([
        z.object({ athleteProfileId: z.string() }),
        z.object({ guestName: z.string() })
      ])
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { squadRowId, replaceWith } = data;
    
    const { data: row, error: rowErr } = await supabase
      .from("mc_match_squads")
      .select("*")
      .eq("id", squadRowId)
      .single();

    if (rowErr || !row) throw new Error("Squad player not found");

    await assertMatchEditable(row.match_id, supabase);

    const update: any = {
      athlete_profile_id: "athleteProfileId" in replaceWith ? replaceWith.athleteProfileId : null,
      external_player_name: "guestName" in replaceWith ? replaceWith.guestName : null,
    };

    const { error } = await supabase
      .from("mc_match_squads")
      .update(update)
      .eq("id", squadRowId);

    if (error) throw error;
    return { success: true };
  });

export const removeSquadPlayer = createServerFn({ method: "POST" })
  .validator((data: { squadRowId: string }) => 
    z.object({ squadRowId: z.string() }).parse(data)
  )
  .handler(async ({ data }) => {
    const { squadRowId } = data;
    
    const { data: row, error: rowErr } = await supabase
      .from("mc_match_squads")
      .select("*")
      .eq("id", squadRowId)
      .single();

    if (rowErr || !row) throw new Error("Squad player not found");

    await assertMatchEditable(row.match_id, supabase);

    // Check for ball events
    const { data: balls, error: ballErr } = await supabase
      .from("mc_ball_events")
      .select("id")
      .eq("match_id", row.match_id)
      .or(`striker_athlete_id.eq.${row.athlete_profile_id},non_striker_athlete_id.eq.${row.athlete_profile_id},bowler_athlete_id.eq.${row.athlete_profile_id},fielder_athlete_id.eq.${row.athlete_profile_id},striker_name.eq.${row.external_player_name},non_striker_name.eq.${row.external_player_name},bowler_name.eq.${row.external_player_name},fielder_name.eq.${row.external_player_name}`)
      .limit(1);

    if (ballErr) throw ballErr;
    if (balls && balls.length > 0) {
      throw new Error("Cannot remove player who has already participated in the match (has ball events).");
    }

    const { error } = await supabase
      .from("mc_match_squads")
      .delete()
      .eq("id", squadRowId);

    if (error) throw error;
    return { success: true };
  });

export const addSquadPlayer = createServerFn({ method: "POST" })
  .validator((data: { 
    matchId: string, 
    teamId: string, 
    player: { athleteProfileId: string } | { guestName: string } 
  }) => 
    z.object({ 
      matchId: z.string(), 
      teamId: z.string(), 
      player: z.union([
        z.object({ athleteProfileId: z.string() }),
        z.object({ guestName: z.string() })
      ])
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { matchId, teamId, player } = data;
    const match = await assertMatchEditable(matchId, supabase);

    const squad = await listMatchSquad(matchId, teamId);
    const maxOrder = Math.max(0, ...squad.map(p => p.batting_order || 0));

    const { error } = await supabase
      .from("mc_match_squads")
      .insert({
        match_id: matchId,
        team_id: teamId,
        tenant_id: match.tenant_id,
        athlete_profile_id: "athleteProfileId" in player ? player.athleteProfileId : null,
        external_player_name: "guestName" in player ? player.guestName : null,
        batting_order: maxOrder + 1,
        is_playing: true,
        is_substitute: false
      });

    if (error) throw error;
    return { success: true };
  });

export const renameMatchTeam = createServerFn({ method: "POST" })
  .validator((data: { matchId: string, teamId: string, newName: string }) => 
    z.object({ matchId: z.string(), teamId: z.string(), newName: z.string().min(1) }).parse(data)
  )
  .handler(async ({ data }) => {
    const { matchId, teamId, newName } = data;
    await assertMatchEditable(matchId, supabase);

    const { error } = await supabase
      .from("mc_teams")
      .update({ name: newName })
      .eq("id", teamId);

    if (error) throw error;
    return { success: true };
  });

export const reorderSquad = createServerFn({ method: "POST" })
  .validator((data: { matchId: string, teamId: string, orderedRowIds: string[] }) => 
    z.object({ 
      matchId: z.string(), 
      teamId: z.string(), 
      orderedRowIds: z.array(z.string()) 
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { matchId, teamId, orderedRowIds } = data;
    await assertMatchEditable(matchId, supabase);

    const updates = orderedRowIds.map((id: string, idx: number) => 
      supabase.from("mc_match_squads").update({ batting_order: idx + 1 }).eq("id", id)
    );

    await Promise.all(updates);
    return { success: true };
  });
