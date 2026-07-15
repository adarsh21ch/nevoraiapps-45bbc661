/**
 * Phase 3 — canonical permission hook.
 *
 * Server-side truth: user_roles + has_role() / current_role() RPCs.
 * Client-side: this hook exposes a role (owner / admin / platform_admin /
 * student) plus a legacy `can(feature)` predicate consumed by existing
 * screens. Feature gates:
 *
 *   canViewFees         → owner only
 *   canScoreMatch       → owner + admin
 *   canMarkAttendance   → owner + admin
 *
 * IMPORTANT: this is a UI-only gate. Every mutation and RPC MUST also
 * enforce the permission server-side via RLS or has_role().
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardOptional } from "@/lib/dashboard-context";

export type AppRole = "owner" | "admin" | "platform_admin" | "student";

export type PermissionFeature =
  | "canViewFees"
  | "canScoreMatch"
  | "canMarkAttendance"
  | "canManageAdmins"
  | "canManageWebsite"
  | "canManageSubscription";

const RULES: Record<PermissionFeature, AppRole[]> = {
  canViewFees:           ["owner"],
  canScoreMatch:         ["owner", "admin"],
  canMarkAttendance:     ["owner", "admin"],
  canManageAdmins:       ["owner"],
  canManageWebsite:      ["owner"],
  canManageSubscription: ["owner"],
};

/**
 * `usePermissions()` with no args reads role from DashboardContext (the
 * pattern existing screens already use). Pass a `tenantId` to bypass the
 * context (e.g. platform-admin views operating on another tenant).
 */
export function usePermissions(tenantId?: string | null) {
  const ctx = useDashboardOptional();
  const ctxTenantId = ctx?.tenant?.id ?? null;
  const ctxProfileRole = ctx?.profile?.role ?? null;
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

  const role: AppRole = ctxProfileRole
    ? ctxProfileRole === "owner" ? "owner" : "admin"
    : (q.data ?? "student");

  const can = (feature: PermissionFeature): boolean =>
    RULES[feature]?.includes(role) ?? false;

  return {
    role,
    can,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    isPlatformAdmin: role === "platform_admin",
    isStudent: role === "student",
    isLoading: q.isLoading,
  };
}
