import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Ensures a student is correctly wired up with a student ID and card token.
 * This is the final safety net for the "SAI0001" style IDs and QR card scanning.
 */
export const auditStudentIdentity = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    studentId: z.string(),
    tenantId: z.string(),
    prefix: z.string().optional().default("SAI")
  }).parse(data))
  .handler(async ({ data }) => {
    const { studentId, tenantId, prefix } = data;
    
    // 1. Fetch current state
    const { data: student, error: fetchErr } = await supabaseAdmin
      .from("students")
      .select("student_id_alt, card_token")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !student) return { success: false, error: "Student not found" };

    const updates: Record<string, string> = {};

    // 2. Ensure ID exists (SAI0001 format)
    if (!student.student_id_alt) {
      const { data: countData } = await supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      
      const nextNum = (countData?.length || 0) + 1;
      updates.student_id_alt = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    // 3. Ensure card token exists for QR scanning
    if (!student.card_token) {
      updates.card_token = crypto.randomUUID();
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("students")
        .update(updates)
        .eq("id", studentId);
    }

    return { success: true, student_id_alt: updates.student_id_alt || student.student_id_alt };
  });
