import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarDays,
  Wallet,
  LogOut,
  ExternalLink,
  IndianRupee,
  BarChart3,
  ClipboardCheck,
  BellRing,
  UserCircle,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFeatures, tenantSiteUrl } from "@/lib/tenant";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
import { useT } from "@/lib/i18n";
import { StoragedImage } from "@/components/site/StoragedImage";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  requiresFeature?: "fee_tracking";
};

// Primary nav — 5 tabs: Home, Students (incl. Registrations), Match Center, Fees, Profile.
const primaryNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dashboard/students", label: "Students", icon: Users },
  { to: "/match-center", label: "Match Center", icon: Swords },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

// Mobile bottom tabs mirror the primary nav (5 tabs, one-hand friendly).
const mobilePrimary: NavItem[] = primaryNav;

// Secondary — reached from Profile page or desktop sidebar Settings section.
const secondaryNav: NavItem[] = [
  { to: "/dashboard/registrations", label: "Registrations", icon: Inbox },
  { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/dashboard/reminders", label: "Reminders", icon: BellRing, requiresFeature: "fee_tracking" },
  { to: "/dashboard/batches", label: "Batches", icon: CalendarDays },
  { to: "/dashboard/fee-plans", label: "Fee plans", icon: Wallet, requiresFeature: "fee_tracking" },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, requiresFeature: "fee_tracking" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, profile, signOut } = useDashboard();
  const { t } = useT();

  // Combined "new to action" count — registrations + leads (leads folded in).
  const newRegCount = useQuery({
    queryKey: ["d", "regs-plus-leads-count", tenant.id],
    queryFn: async () => {
      const [regs, leads] = await Promise.all([
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "new"),
        supabase
          .from("leads" as never)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "new"),
      ]);
      return (regs.count ?? 0) + (leads.count ?? 0);
    },
    refetchInterval: 30_000,
  });

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
        if (n.to === "/dashboard/students" && newRegCount.data) badge = newRegCount.data;
        if (n.to === "/dashboard/registrations" && newRegCount.data) badge = newRegCount.data;
        if (n.to === "/match-center" && (liveMatchCount.data ?? 0) > 0) live = true;
        return { ...n, label, badge, live };
      });

  const primary = withBadges(primaryNav);
  const secondary = withBadges(secondaryNav);
  const mobileTabs = withBadges(mobilePrimary);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
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
            <LanguageToggle />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="size-4 mr-1" /> {t("Sign out")}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-60 border-r border-border bg-card sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarInner
            tenant={tenant}
            primary={primary}
            secondary={secondary}
            onSignOut={signOut}
            role={profile.role}
          />
        </aside>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-32 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom tab bar — 5 tabs, safe-area padded. */}
      <MobileTabBar items={mobileTabs} />
    </div>
  );
}

function MobileTabBar({
  items,
}: {
  items: (NavItem & { badge?: number; live?: boolean })[];
}) {
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)", paddingTop: "6px" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {items.map((n) => {
          const active =
            n.to === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-2 min-h-[68px] text-[10.5px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="relative inline-flex">
                <Icon className="size-[22px]" />
                {n.live ? (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-1 size-2 rounded-full bg-rose-600 ring-2 ring-background animate-pulse"
                  />
                ) : null}
              </span>
              <span className="truncate max-w-[68px] leading-none">{n.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-b-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
              {n.badge ? (
                <span className="absolute top-1.5 right-[calc(50%-20px)] min-w-[16px] rounded-full px-1 text-[9px] font-bold text-white bg-rose-600">
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
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
  secondary,
  onSignOut,
  role,
}: {
  tenant: { name: string };
  primary: (NavItem & { badge?: number })[];
  secondary: (NavItem & { badge?: number })[];
  onSignOut: () => void;
  role: string;
}) {
  const location = useLocation();
  const { t } = useT();
  const renderItem = (n: NavItem & { badge?: number }) => {
    const active =
      n.to === "/dashboard"
        ? location.pathname === "/dashboard"
        : location.pathname.startsWith(n.to);
    const Icon = n.icon;
    return (
      <Link
        key={n.to}
        to={n.to}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
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
        <Icon className="size-4" />
        <span className="flex-1">{n.label}</span>
        {n.badge ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-rose-600">
            {n.badge}
          </span>
        ) : null}
      </Link>
    );
  };
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-border">
        <div className="text-sm font-semibold truncate">{tenant.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{role}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {primary.map(renderItem)}
        <div className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {t("Settings")}
        </div>
        {secondary.map(renderItem)}
      </nav>
      <div className="p-2 border-t border-border">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="size-4 mr-2" /> {t("Sign out")}
        </Button>
      </div>
    </div>
  );
}
