import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, Swords, IndianRupee, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { getFeatures } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { useNewRegistrationsCount } from "@/hooks/use-new-registrations";

type Tab = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresFeature?: "fee_tracking";
};

const TABS: Tab[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dashboard/students", label: "Students", icon: Users },
  { to: "/match-center", label: "Match Center", icon: Swords },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

/**
 * Unified bottom navigation shared between Academy OS (DashboardShell) and
 * Match Center. Reuses the same React Query cache keys so no extra Supabase
 * queries are issued when both shells mount in a session.
 */
export function GlobalBottomNav() {
  const { tenant } = useDashboard();
  const location = useLocation();
  const features = getFeatures(tenant);

  const newRegs = useNewRegistrationsCount(tenant.id);


  const liveMatches = useQuery({
    queryKey: ["mc-live-count", tenant.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("matches" as never)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "live");
      return count ?? 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const tabs = TABS.filter(
    (t) => !t.requiresFeature || features[t.requiresFeature] !== false,
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "2px" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {tabs.map((n) => {
          const active =
            n.to === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname === n.to || location.pathname.startsWith(n.to + "/");
          const Icon = n.icon;
          const badge = n.to === "/dashboard/students" ? newRegs : 0;
          const live = n.to === "/match-center" && (liveMatches.data ?? 0) > 0;
          const ariaLabel = live
            ? `${n.label} (live)`
            : badge > 0
              ? `${n.label}, ${badge} pending`
              : n.label;
          return (
            <Link
              key={n.to}
              to={n.to}
              aria-current={active ? "page" : undefined}
              aria-label={ariaLabel}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1.5 min-h-[56px] text-[10.5px] font-medium",
                "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:rounded-md",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative inline-flex">
                <Icon className="size-[22px]" />
                {live ? (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-1 size-2 rounded-full bg-rose-600 ring-2 ring-background animate-pulse"
                  />
                ) : null}
              </span>
              <span className="truncate max-w-[68px] leading-none">{n.label}</span>
              {active && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-b-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
              {badge > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-[calc(50%-20px)] min-w-[16px] rounded-full px-1 text-[9px] font-bold text-white bg-rose-600"
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
