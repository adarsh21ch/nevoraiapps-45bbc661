import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Ensures a student is correctly wired up with a student ID and card token.
 * This is the final safety net for the "SAI0001" style IDs and QR card scanning.
 */
export const auditStudentIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    studentId: z.string().uuid(),
    tenantId: z.string().uuid(),
    prefix: z.string().optional().default("SAI")
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { studentId, tenantId, prefix } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertManager } = await import("@/lib/staff/staff.functions");
    
    // 1. Fetch current state
    const { data: student, error: fetchErr } = await supabaseAdmin
      .from("students")
      .select("player_id, card_token")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !student) return { success: false, error: "Student not found" };

    const isSelf = student.user_id === context.userId;
    if (!isSelf) {
      await assertManager(context.supabase, context.userId, tenantId);
    }

    const updates: any = {};

    // 2. Ensure ID exists (SAI0001 format)
    if (!student.player_id) {
      const { count } = await supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      
      const nextNum = (count ?? 0) + 1;
      updates.player_id = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    // 3. Ensure card token exists for QR scanning
    if (!student.card_token) {
      updates.card_token = crypto.randomUUID();
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("students")
        .update(updates)
        .eq("id", studentId)
        .eq("tenant_id", tenantId);
      if (updErr) throw updErr;
    }

    return { success: true, player_id: updates.player_id || student.player_id };
  });
