/**
 * Staff management — client-side queries and cache keys.
 * Realtime updates via existing supabase channels.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StaffMember = {
  user_id: string;
  tenant_id: string;
  profile_role: string;
  primary_role: Database["public"]["Enums"]["app_role"];
  all_roles: Database["public"]["Enums"]["app_role"][];
  created_at: string;
  last_sign_in_at: string | null;
  active: boolean;
  assignments: { batch_id: string; batch_name: string; coach_role: string }[];
};

export type StaffInvitation =
  Database["public"]["Tables"]["staff_invitations"]["Row"];

export type CoachAssignmentRow =
  Database["public"]["Tables"]["coach_assignments"]["Row"] & {
    batch_name?: string | null;
    coach_email?: string | null;
  };

export const staffKeys = {
  members: (tenantId: string) => ["staff", "members", tenantId] as const,
  invitations: (tenantId: string) => ["staff", "invitations", tenantId] as const,
  assignments: (tenantId: string) => ["staff", "assignments", tenantId] as const,
  activity: (tenantId: string) => ["staff", "activity", tenantId] as const,
};

const ROLE_PRIORITY: Record<string, number> = {
  owner: 100,
  admin: 90,
  head_coach: 80,
  coach: 70,
  assistant_coach: 60,
  staff: 50,
  student: 10,
  platform_admin: 0,
};

function pickPrimary(
  roles: Database["public"]["Enums"]["app_role"][],
): Database["public"]["Enums"]["app_role"] {
  if (roles.length === 0) return "staff";
  return [...roles].sort((a, b) => (ROLE_PRIORITY[b] ?? 0) - (ROLE_PRIORITY[a] ?? 0))[0];
}

export async function fetchStaffMembers(tenantId: string): Promise<StaffMember[]> {
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, tenant_id, role, created_at")
    .eq("tenant_id", tenantId);
  if (profErr) throw profErr;

  const { data: userRoles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  if (rolesErr) throw rolesErr;

  const { data: assignments, error: aErr } = await supabase
    .from("coach_assignments")
    .select("id, coach_user_id, batch_id, coach_role, active, batches(name)")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  if (aErr) throw aErr;

  const rolesByUser = new Map<string, Database["public"]["Enums"]["app_role"][]>();
  (userRoles ?? []).forEach((r) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  });

  const assignByUser = new Map<
    string,
    { batch_id: string; batch_name: string; coach_role: string }[]
  >();
  (assignments ?? []).forEach((a: {
    coach_user_id: string;
    batch_id: string;
    coach_role: string;
    batches: { name: string } | null;
  }) => {
    const arr = assignByUser.get(a.coach_user_id) ?? [];
    arr.push({
      batch_id: a.batch_id,
      batch_name: a.batches?.name ?? "Batch",
      coach_role: a.coach_role,
    });
    assignByUser.set(a.coach_user_id, arr);
  });

  return (profiles ?? []).map((p) => {
    const roles = rolesByUser.get(p.user_id) ?? [];
    // Fall back to legacy profile.role if user_roles has no entry.
    if (roles.length === 0) {
      if (p.role === "owner") roles.push("owner");
      else if (p.role === "admin") roles.push("admin");
      else if (p.role === "coach") roles.push("coach");
    }
    return {
      user_id: p.user_id,
      tenant_id: p.tenant_id,
      profile_role: p.role,
      primary_role: pickPrimary(roles),
      all_roles: roles,
      created_at: p.created_at,
      last_sign_in_at: null,
      active: roles.length > 0,
      assignments: assignByUser.get(p.user_id) ?? [],
    };
  });
}

export async function fetchStaffInvitations(tenantId: string): Promise<StaffInvitation[]> {
  const { data, error } = await supabase
    .from("staff_invitations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCoachAssignments(tenantId: string): Promise<CoachAssignmentRow[]> {
  const { data, error } = await supabase
    .from("coach_assignments")
    .select("*, batches(name)")
    .eq("tenant_id", tenantId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: CoachAssignmentRow & { batches?: { name: string } | null }) => ({
    ...r,
    batch_name: r.batches?.name ?? null,
  }));
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export function invitationStatus(inv: StaffInvitation): InvitationStatus {
  if (inv.revoked_at) return "revoked";
  if (inv.accepted_at) return "accepted";
  if (new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

export const ROLE_LABELS: Record<Database["public"]["Enums"]["app_role"], string> = {
  owner: "Owner",
  admin: "Admin",
  platform_admin: "Platform Admin",
  head_coach: "Head Coach",
  coach: "Coach",
  assistant_coach: "Assistant Coach",
  staff: "Staff",
  student: "Student",
};
