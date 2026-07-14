/**
 * AcademyOS V2 — Capability layer.
 *
 * Navigation is role-based (stable, hardcoded per role — see nav-config.ts).
 * Actions inside modules are capability-based.
 *
 * Capabilities are derived from (role × tenant plan). They do NOT drive
 * menu visibility — that is `nav-config` + `getFeatures(tenant)`. They
 * gate buttons, forms, and mutations.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can("canManageFees")) { ... }
 */

import { useMemo } from "react";
import { useCurrentRole, type AppRole } from "@/hooks/use-current-role";
import { useDashboardOptional } from "@/lib/dashboard-context";
import { getFeatures } from "@/lib/tenant";

export type Capability =
  | "canManagePlayers"
  | "canViewFees"
  | "canManageFees"
  | "canManageAdmins"
  | "canManageWebsite"
  | "canManageReports"
  | "canViewReports"
  | "canScoreMatch"
  | "canManageAttendance"
  | "canMarkAttendance"
  | "canManageBatches"
  | "canManageSettings"
  | "canManageTenant";

const roleCaps: Record<AppRole, ReadonlySet<Capability>> = {
  owner: new Set<Capability>([
    "canManagePlayers",
    "canViewFees",
    "canManageFees",
    "canManageAdmins",
    "canManageWebsite",
    "canManageReports",
    "canViewReports",
    "canScoreMatch",
    "canManageAttendance",
    "canMarkAttendance",
    "canManageBatches",
    "canManageSettings",
    "canManageTenant",
  ]),
  admin: new Set<Capability>([
    "canManagePlayers",
    "canViewReports",
    "canScoreMatch",
    "canManageAttendance",
    "canMarkAttendance",
    "canManageBatches",
  ]),
  student: new Set<Capability>([]),
};

export interface PermissionResult {
  role: AppRole;
  can: (cap: Capability) => boolean;
  all: (...caps: Capability[]) => boolean;
  any: (...caps: Capability[]) => boolean;
}

export function usePermissions(): PermissionResult {
  const role = useCurrentRole();
  const ctx = useDashboardOptional();
  const features = ctx?.tenant ? getFeatures(ctx.tenant) : null;

  return useMemo(() => {
    const base = roleCaps[role];
    const can = (cap: Capability): boolean => {
      if (!base.has(cap)) return false;
      // Tenant plan gates — action is only exposed when the module is enabled.
      if ((cap === "canViewFees" || cap === "canManageFees") && features && features.fee_tracking === false) {
        return false;
      }
      return true;
    };
    return {
      role,
      can,
      all: (...caps: Capability[]) => caps.every(can),
      any: (...caps: Capability[]) => caps.some(can),
    };
  }, [role, features]);
}
