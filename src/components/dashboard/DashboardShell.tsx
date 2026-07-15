import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarDays,
  LogOut,
  ExternalLink,
  IndianRupee,
  BarChart3,
  ClipboardCheck,
  UserCircle,
  Swords,
  Building2,
  Globe,
  Megaphone,
  Settings as SettingsIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFeatures, tenantSiteUrl } from "@/lib/tenant";
import { useT } from "@/lib/i18n";
import { StoragedImage } from "@/components/site/StoragedImage";
import { GlobalBottomNav } from "@/components/shared/GlobalBottomNav";
import { useNewRegistrationsCount } from "@/hooks/use-new-registrations";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TrialBanner } from "@/components/dashboard/TrialBanner";


type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  requiresFeature?: "fee_tracking";
};

// Unified IA — matches mobile bottom nav (Home · Attendance · Fees · Operations · Profile).
// Owner/Admin sidebar top-level:
const primaryNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

// Operations — expands to expose the full academy toolset. Single source of
// truth: nothing here is repeated in `primaryNav`.
const operationsNav: NavItem[] = [
  { to: "/dashboard/students", label: "Players", icon: Users },
  { to: "/match-center", label: "Match Center", icon: Swords },
  { to: "/dashboard/registrations", label: "Registrations", icon: Inbox },
  { to: "/dashboard/batches", label: "Batches", icon: CalendarDays },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { to: "/dashboard/site", label: "Website", icon: Globe },
  { to: "/dashboard/communications", label: "Communications", icon: Megaphone },
  { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, profile, signOut } = useDashboard();
  const { t } = useT();

  // Single source of truth for the "new registration" badge — status='new'.
  const newRegCount = useNewRegistrationsCount(tenant.id);

  // Live match indicator for the Match Center tab.
  const liveMatchCount = useQuery({
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

  const features = getFeatures(tenant);
  const withBadges = (items: NavItem[]) =>
    items
      .filter((n) => !n.requiresFeature || features[n.requiresFeature] !== false)
      .map((n) => {
        const label = t(n.label);
        let badge: number | undefined;
        let live = false;
        if (n.to === "/dashboard/students" && newRegCount) badge = newRegCount;
        if (n.to === "/dashboard/registrations" && newRegCount) badge = newRegCount;
        if (n.to === "/match-center" && (liveMatchCount.data ?? 0) > 0) live = true;
        return { ...n, label, badge, live };
      });


  const primary = withBadges(primaryNav);
  const operations = withBadges(operationsNav);




  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-background"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      <div aria-hidden="true" className="bg-background" style={{ height: "env(safe-area-inset-top)" }} />
      <header
        className="sticky z-40 border-b border-border bg-background/95 backdrop-blur"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <TenantMark tenant={tenant} />
          <div className="ml-auto flex items-center gap-2">
            <a
              href={tenantSiteUrl(tenant)}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mr-1"
            >
              {t("View site")} <ExternalLink className="size-3" />
            </a>
            <Link
              to="/dashboard/registrations"
              aria-label={
                newRegCount > 0
                  ? `Registrations, ${newRegCount} new`
                  : "Registrations"
              }
              className="relative inline-grid place-items-center size-9 rounded-full hover:bg-accent transition-colors"
            >
              <Inbox className="size-4" />
              {newRegCount > 0 ? (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold text-white bg-rose-600 ring-2 ring-background"
                >
                  {newRegCount > 99 ? "99+" : newRegCount}
                </span>
              ) : null}
            </Link>

            <NotificationBell />


            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="size-4 mr-1" /> {t("Sign out")}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-60 border-r border-border bg-card sticky top-[calc(env(safe-area-inset-top)+3.5rem)] h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)]">
          <SidebarInner
            tenant={tenant}
            primary={primary}
            operations={operations}
            onSignOut={signOut}
            role={profile.role}
          />
        </aside>


        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-32 md:pb-8">
          <div className="mb-4"><TrialBanner /></div>
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Unified mobile bottom nav — shared with Match Center for a seamless experience. */}
      <GlobalBottomNav />
    </div>
  );
}


function TenantMark({ tenant }: { tenant: { name: string; logo_url: string | null } }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="size-8 rounded-md grid place-items-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
      >
        {tenant.logo_url ? (
          <StoragedImage
            path={tenant.logo_url}
            alt={tenant.name}
            className="size-8 rounded-md object-cover"
            fallback={<span>{tenant.name.slice(0, 2).toUpperCase()}</span>}
          />
        ) : (
          tenant.name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{tenant.name}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("Dashboard")}</div>
      </div>
    </div>
  );
}

function SidebarInner({
  tenant,
  primary,
  operations,
  onSignOut,
  role,
}: {
  tenant: { name: string };
  primary: (NavItem & { badge?: number; live?: boolean })[];
  operations: (NavItem & { badge?: number; live?: boolean })[];
  onSignOut: () => void;
  role: string;
}) {
  const location = useLocation();
  const { t } = useT();

  const isItemActive = (to: string) =>
    to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname === to || location.pathname.startsWith(to + "/");

  // Operations aggregate badge count (e.g. new registrations while collapsed).
  const opsBadge = useMemo(
    () => operations.reduce((s, n) => s + (n.badge ?? 0), 0),
    [operations],
  );
  const opsLive = operations.some((n) => n.live);
  const opsActive = operations.some((n) => isItemActive(n.to));
  const [opsOpen, setOpsOpen] = useState(opsActive);

  const renderItem = (n: NavItem & { badge?: number; live?: boolean }, indent = false) => {
    const active = isItemActive(n.to);
    const Icon = n.icon;
    return (
      <Link
        key={n.to}
        to={n.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]",
          indent && "ml-4 pl-3 border-l border-border/70",
          active
            ? "font-semibold text-foreground bg-accent/40"
            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        )}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full"
            style={{ backgroundColor: "var(--brand)" }}
          />
        )}
        <span className="relative inline-flex">
          <Icon className="size-4" />
          {n.live ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-rose-600 ring-2 ring-background animate-pulse"
            />
          ) : null}
        </span>
        <span className="flex-1">{n.label}</span>
        {n.live ? (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full text-white bg-rose-600">
            LIVE
          </span>
        ) : null}
        {n.badge ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-rose-600">
            {n.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  // Insert Operations group after Attendance/Fees, before Profile.
  const homeAttendanceFees = primary.filter((n) => n.to !== "/dashboard/profile");
  const profile = primary.find((n) => n.to === "/dashboard/profile");

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-border">
        <div className="text-sm font-semibold truncate">{tenant.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{role}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {homeAttendanceFees.map((n) => renderItem(n))}

        {/* Operations — expandable group */}
        <button
          type="button"
          onClick={() => setOpsOpen((v) => !v)}
          aria-expanded={opsOpen}
          className={cn(
            "w-full relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]",
            opsActive
              ? "font-semibold text-foreground bg-accent/40"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          <span className="relative inline-flex">
            <Building2 className="size-4" />
            {opsLive ? (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-rose-600 ring-2 ring-background animate-pulse"
              />
            ) : null}
          </span>
          <span className="flex-1 text-left">{t("Operations")}</span>
          {!opsOpen && opsBadge > 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-rose-600">
              {opsBadge}
            </span>
          ) : null}
          <ChevronDown
            className={cn("size-4 transition-transform", opsOpen && "rotate-180")}
          />
        </button>
        {opsOpen ? (
          <div className="space-y-1 pt-0.5">
            {operations.map((n) => renderItem(n, true))}
          </div>
        ) : null}

        {profile ? renderItem(profile) : null}
      </nav>
      <div className="p-2 border-t border-border">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="size-4 mr-2" /> {t("Sign out")}
        </Button>
      </div>
    </div>
  );
}

}
