import {
  LayoutDashboard,
  ClipboardCheck,
  IndianRupee,
  Users,
  UserCircle,
  Swords,
  Activity,
  TrendingUp,
  Building2,
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
 * Role-based bottom nav configs. Each role gets 5 tabs (one-hand thumb reach).
 */
export const navByRole: Record<AppRole, NavItem[]> = {
  owner: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
    { to: "/dashboard/academy", label: "Academy", icon: Building2 },
    { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
  ],
  admin: [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/dashboard/academy", label: "Academy", icon: Building2 },
    { to: "/dashboard/students", label: "Players", icon: Users },
    { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
  ],
  student: [
    { to: "/parent-portal", label: "Home", icon: LayoutDashboard },
    { to: "/match-center/matches", label: "Matches", icon: Swords },
    { to: "/parent-portal", label: "Activity", icon: Activity },
    { to: "/parent-portal", label: "Progress", icon: TrendingUp },
    { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
  ],
};
