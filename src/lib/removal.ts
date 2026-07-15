import { supabase } from "@/integrations/supabase/client";

/** Platform-admin only. Permanently removes a tenant and cascades all its data. */
export async function removeTenant(tenantId: string, confirmName: string) {
  const { error } = await supabase.rpc("platform_delete_tenant" as any, {
    _tenant_id: tenantId,
    _confirm_name: confirmName,
  });
  if (error) throw error;
}

/** Owner (or platform admin). Permanently removes a player and all their academy data. */
export async function removeStudent(studentId: string, confirmName: string) {
  const { error } = await supabase.rpc("owner_delete_student" as any, {
    _student_id: studentId,
    _confirm_name: confirmName,
  });
  if (error) throw error;
}

/** Owner (or platform admin). Removes an academy member (coach/admin/staff). */
export async function removeMember(profileId: string) {
  const { error } = await supabase.rpc("owner_delete_member" as any, {
    _profile_id: profileId,
  });
  if (error) throw error;
}
