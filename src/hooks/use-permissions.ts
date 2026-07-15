/**
 * Phase 3 — canonical permission hook.
 * Phase 6 — extended with coach / head_coach / assistant_coach / staff roles.
 *
 * Server-side truth: user_roles + has_role() / current_role() RPCs.
 * Client-side: this hook exposes a role plus a `can(feature)` predicate
 * consumed by existing screens.
 *
 * IMPORTANT: this is a UI-only gate. Every mutation and RPC MUST also
 * enforce the permission server-side via RLS or has_role().
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardOptional } from "@/lib/dashboard-context";

export type AppRole =
  | "owner"
  | "admin"
  | "platform_admin"
  | "head_coach"
  | "coach"
  | "assistant_coach"
  | "staff"
  | "student";

export type PermissionFeature =
  | "canViewFees"
  | "canScoreMatch"
  | "canMarkAttendance"
  | "canManageAdmins"
  | "canManageWebsite"
  | "canManageSubscription"
  | "canManageStaff"
  | "canInviteStaff"
  | "canViewCoachAnalytics"
  | "canManageAssignedBatches"
  | "canSendAnnouncements"
  | "canViewBilling"
  | "canManageTenantSettings";

const OWNER_ONLY: AppRole[] = ["owner"];
const OWNER_ADMIN: AppRole[] = ["owner", "admin"];
const OWNER_ADMIN_HEAD: AppRole[] = ["owner", "admin", "head_coach"];
const OWNER_ADMIN_COACHES: AppRole[] = [
  "owner",
  "admin",
  "head_coach",
  "coach",
  "assistant_coach",
];

const RULES: Record<PermissionFeature, AppRole[]> = {
  canViewFees: OWNER_ONLY,
  canScoreMatch: OWNER_ADMIN_COACHES,
  canMarkAttendance: OWNER_ADMIN_COACHES,
  canManageAdmins: OWNER_ONLY,
  canManageWebsite: OWNER_ONLY,
  canManageSubscription: OWNER_ONLY,
  canManageStaff: OWNER_ADMIN,
  canInviteStaff: OWNER_ADMIN,
  canViewCoachAnalytics: OWNER_ADMIN_HEAD,
  canManageAssignedBatches: OWNER_ADMIN_COACHES,
  canSendAnnouncements: OWNER_ADMIN_HEAD,
  canViewBilling: OWNER_ONLY,
  canManageTenantSettings: OWNER_ONLY,
};

const COACH_ROLES: ReadonlySet<AppRole> = new Set([
  "coach",
  "head_coach",
  "assistant_coach",
]);

function normalizeProfileRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  switch (role) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "platform_admin":
      return "platform_admin";
    case "head_coach":
      return "head_coach";
    case "coach":
      // Legacy profiles.role='coach' historically mapped to admin.
      // With Phase 6 the source of truth is user_roles/current_role RPC.
      // Return null so we hit the RPC and get the precise role.
      return null;
    case "assistant_coach":
      return "assistant_coach";
    case "staff":
      return "staff";
    case "student":
      return "student";
    default:
      return null;
  }
}

/**
 * `usePermissions()` with no args reads role from DashboardContext (the
 * pattern existing screens already use). Pass a `tenantId` to bypass the
 * context (e.g. platform-admin views operating on another tenant).
 */
export function usePermissions(tenantId?: string | null) {
  const ctx = useDashboardOptional();
  const ctxTenantId = ctx?.tenant?.id ?? null;
  const ctxProfileRole = normalizeProfileRole(ctx?.profile?.role);
  const effectiveTenantId = tenantId ?? ctxTenantId;

  // Only hit the RPC when we cannot derive the role from context.
  const q = useQuery({
    enabled: !!effectiveTenantId && !ctxProfileRole,
    queryKey: ["perm", "role", effectiveTenantId],
    queryFn: async (): Promise<AppRole> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("current_role", {
        _tenant_id: effectiveTenantId,
      });
      if (error) throw error;
      return (data as AppRole) ?? "student";
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const role: AppRole = ctxProfileRole ?? q.data ?? "student";

  const can = (feature: PermissionFeature): boolean =>
    RULES[feature]?.includes(role) ?? false;

  const isCoach = COACH_ROLES.has(role);

  return {
    role,
    can,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    isPlatformAdmin: role === "platform_admin",
    isStudent: role === "student",
    isStaff: role === "staff",
    isCoach,
    isHeadCoach: role === "head_coach",
    isAssistantCoach: role === "assistant_coach",
    isLoading: q.isLoading,
  };
}
