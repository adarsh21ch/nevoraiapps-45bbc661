/**
 * Player photo + match captaincy server functions.
 * Auth-gated via requireSupabaseAuth; RLS applies through context.supabase.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Update a student's photo_url.
 * Authorization: caller must be same-tenant AND
 *   - owner/coach (profiles.role in ('owner','coach')), OR
 *   - the student themselves (students.user_id = caller.userId).
 */
export const updatePlayerPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { studentId: string; photoUrl: string | null }) => {
    if (!data?.studentId) throw new Error("studentId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load student's tenant + user_id, respecting RLS.
    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, tenant_id, user_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (sErr || !student) throw new Error("Student not found or not accessible");

    // Determine caller's role in this tenant.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    const isStaff =
      !!profile &&
      profile.tenant_id === student.tenant_id &&
      (profile.role === "owner" || profile.role === "coach" || profile.role === "admin");
    const isSelf = student.user_id === userId;

    if (!isStaff && !isSelf) throw new Error("Forbidden");

    const { error: uErr } = await supabase
      .from("students")
      .update({ photo_url: data.photoUrl })
      .eq("id", data.studentId);
    if (uErr) throw uErr;

    return { ok: true, photoUrl: data.photoUrl };
  });

/**
 * Set match-level captain / vice-captain for a specific team's squad rows.
 * Radio-style: clears any existing captain/vc for that (match_id, team_id) first,
 * then sets the chosen squad_row_id.
 *
 * Authorization: owner/coach in the match's tenant.
 */
export const setMatchCaptains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      matchId: string;
      teamId: string;
      captainSquadRowId: string | null;
      viceCaptainSquadRowId: string | null;
    }) => {
      if (!data?.matchId || !data?.teamId) throw new Error("matchId + teamId required");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: match, error: mErr } = await supabase
      .from("mc_matches")
      .select("id, tenant_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr || !match) throw new Error("Match not found or not accessible");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    const isStaff =
      !!profile &&
      profile.tenant_id === match.tenant_id &&
      (profile.role === "owner" || profile.role === "coach" || profile.role === "admin");
    if (!isStaff) throw new Error("Forbidden");

    // Clear existing captain / VC for this (match, team) before setting new one.
    // Two updates keep the partial unique indexes happy.
    const { error: c1 } = await supabase
      .from("mc_match_squads")
      .update({ is_captain: false })
      .eq("match_id", data.matchId)
      .eq("team_id", data.teamId);
    if (c1) throw c1;
    const { error: c2 } = await supabase
      .from("mc_match_squads")
      .update({ is_vice_captain: false })
      .eq("match_id", data.matchId)
      .eq("team_id", data.teamId);
    if (c2) throw c2;

    if (data.captainSquadRowId) {
      const { error } = await supabase
        .from("mc_match_squads")
        .update({ is_captain: true })
        .eq("id", data.captainSquadRowId)
        .eq("match_id", data.matchId)
        .eq("team_id", data.teamId);
      if (error) throw error;
    }
    if (
      data.viceCaptainSquadRowId &&
      data.viceCaptainSquadRowId !== data.captainSquadRowId
    ) {
      const { error } = await supabase
        .from("mc_match_squads")
        .update({ is_vice_captain: true })
        .eq("id", data.viceCaptainSquadRowId)
        .eq("match_id", data.matchId)
        .eq("team_id", data.teamId);
      if (error) throw error;
    }

    return { ok: true };
  });
