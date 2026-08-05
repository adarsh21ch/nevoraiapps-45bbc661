import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteStudentPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { studentId: string }) => v)
  .handler(async ({ data, context }) => {
    // Call the SECURITY DEFINER RPC which bypasses RLS safely and checks ownership internally
    const { error } = await context.supabase.rpc("delete_student_data_v2", {
      _student_id: data.studentId,
    });
    
    if (error) throw error;
    return { ok: true };
  });

export const deleteAllArchivedStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { tenantId: string }) => v)
  .handler(async ({ data, context }) => {
    // Call the SECURITY DEFINER RPC which bypasses RLS safely and checks ownership internally
    const { data: count, error } = await context.supabase.rpc("delete_all_archived_students_v2", {
      _tenant_id: data.tenantId,
    });
    
    if (error) throw error;
    return { count };
  });