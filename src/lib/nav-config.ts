import {
  LayoutDashboard,
  ClipboardCheck,
  IndianRupee,
  UserCircle,
  TrendingUp,
  Building2,
  Trophy,
  CreditCard,
} from "lucide-react";
import type { ComponentType } from "react";
import type { AppRole } from "@/hooks/use-current-role";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Optional tenant feature flag gate — matches `getFeatures(tenant)` keys. */
  requiresFeature?: "fee_tracking";
};

/**
 * Role-based bottom nav configs. Reflects the user's daily workflow —
 * Owner: operations + finance. Admin: operations + performance (no finance).
 * Player/Parent: personal progress.
 */
export const navByRole: Record<AppRole, NavItem[]> = {
  owner: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
    { to: "/dashboard/academy", label: "Manage", icon: Building2 },
    { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
  ],
  admin: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/match-center/live", label: "Match Center", icon: Trophy },
    { to: "/dashboard/academy", label: "Manage", icon: Building2 },
    { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
  ],
  student: [
    { to: "/student", label: "Home", icon: LayoutDashboard },
    { to: "/student/progress", label: "Performance", icon: TrendingUp },
    { to: "/student/matches", label: "Matches", icon: Trophy },
    { to: "/student/fees", label: "Fees", icon: CreditCard },
    { to: "/student/profile", label: "Profile", icon: UserCircle },
  ],
};
