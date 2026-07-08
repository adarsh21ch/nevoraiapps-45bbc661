import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
  MessageSquareText,
  ClipboardCheck,
  BellRing,
  UserCircle,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFeatures } from "@/lib/tenant";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
import { useT } from "@/lib/i18n";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  requiresFeature?: "fee_tracking";
};

// Primary nav — the 5 things owners use every day.
const primaryNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
  { to: "/dashboard/students", label: "Students", icon: Users },
  { to: "/dashboard/registrations", label: "Registrations", icon: Inbox },
  { to: "/dashboard/leads", label: "Leads", icon: MessageSquareText },
];

// Secondary — moved into "More" / Settings.
const secondaryNav: NavItem[] = [
  { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/dashboard/reminders", label: "Reminders", icon: BellRing, requiresFeature: "fee_tracking" },
  { to: "/dashboard/batches", label: "Batches", icon: CalendarDays },
  { to: "/dashboard/fee-plans", label: "Fee plans", icon: Wallet, requiresFeature: "fee_tracking" },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, requiresFeature: "fee_tracking" },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, profile, signOut } = useDashboard();
  const { t } = useT();
  const [moreOpen, setMoreOpen] = useState(false);

  const newRegCount = useQuery({
    queryKey: ["d", "regs-new-count", tenant.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "new");
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const newLeadCount = useQuery({
    queryKey: ["d", "leads-new-count", tenant.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("leads" as never)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "new");
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const features = getFeatures(tenant);
  const withBadges = (items: NavItem[]) =>
    items
      .filter((n) => !n.requiresFeature || features[n.requiresFeature] !== false)
      .map((n) => {
        const label = t(n.label);
        let badge: number | undefined;
        if (n.to === "/dashboard/registrations" && newRegCount.data) badge = newRegCount.data;
        if (n.to === "/dashboard/leads" && newLeadCount.data) badge = newLeadCount.data;
        return { ...n, label, badge };
      });

  const primary = withBadges(primaryNav);
  const secondary = withBadges(secondaryNav);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">

        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <TenantMark tenant={tenant} />
          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/?tenant=${tenant.slug}`}
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

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-28 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom tab bar — 5 slots incl. More */}
      <MobileTabBar
        items={primary}
        onMore={() => setMoreOpen(true)}
        moreBadge={0}
      />

      {/* More sheet — settings and secondary items */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 border-0 max-h-[80vh] overflow-y-auto"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/10" />
          <div className="p-5 pt-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-3 inline-flex items-center gap-1.5">
              <Settings className="size-3.5" /> {t("Settings")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondary.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <Icon className="size-5" style={{ color: "var(--brand)" }} />
                    <span className="text-center leading-tight">{n.label}</span>
                  </Link>
                );
              })}
            </div>
            <Button
              variant="outline"
              className="mt-5 w-full rounded-xl h-11"
              onClick={() => {
                setMoreOpen(false);
                signOut();
              }}
            >
              <LogOut className="size-4 mr-1.5" /> {t("Sign out")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileTabBar({
  items,
  onMore,
  moreBadge,
}: {
  items: (NavItem & { badge?: number })[];
  onMore: () => void;
  moreBadge?: number;
}) {
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 z-30 md:hidden border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
                "relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-[20px]" style={active ? { color: "var(--brand)" } : undefined} />
              <span className="truncate max-w-[64px]">{n.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-t-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
              {n.badge ? (
                <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] rounded-full px-1 text-[9px] font-bold text-white bg-rose-600">
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-medium text-muted-foreground"
        >
          <MoreHorizontal className="size-[20px]" />
          <span>More</span>
          {moreBadge ? (
            <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] rounded-full px-1 text-[9px] font-bold text-white bg-rose-600">
              {moreBadge}
            </span>
          ) : null}
        </button>
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
        style={{ backgroundColor: "var(--tenant-brand, var(--brand, #ff9f43))" }}
      >
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt="" className="size-8 rounded-md object-cover" />
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
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          active
            ? "font-semibold text-foreground bg-accent border border-border"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
        style={
          active
            ? { boxShadow: "inset 3px 0 0 var(--brand)" }
            : undefined
        }
      >
        <Icon className="size-4" style={active ? { color: "var(--brand)" } : undefined} />
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
