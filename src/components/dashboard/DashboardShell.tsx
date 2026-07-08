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
  MessageSquareText,
  ClipboardCheck,
  BellRing,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFeatures } from "@/lib/tenant";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
import { useT } from "@/lib/i18n";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: "main" | "manage";
};

const nav: (NavItem & { requiresFeature?: "fee_tracking" })[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, section: "main" },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking", section: "main" },
  { to: "/dashboard/students", label: "Students", icon: Users, section: "main" },
  { to: "/dashboard/registrations", label: "Registrations", icon: Inbox, section: "manage" },
  { to: "/dashboard/leads", label: "Leads", icon: MessageSquareText, section: "manage" },
  { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, section: "manage" },
  { to: "/dashboard/reminders", label: "Reminders", icon: BellRing, requiresFeature: "fee_tracking", section: "manage" },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, requiresFeature: "fee_tracking", section: "manage" },
  { to: "/dashboard/batches", label: "Batches", icon: CalendarDays, section: "manage" },
  { to: "/dashboard/fee-plans", label: "Fee plans", icon: Wallet, section: "manage" },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle, section: "manage" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, profile, signOut } = useDashboard();
  const { t } = useT();

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
  const navWithBadges = nav
    .filter((n) => !n.requiresFeature || features[n.requiresFeature] !== false)
    .map((n) => {
      const label = t(n.label);
      if (n.to === "/dashboard/registrations" && newRegCount.data && newRegCount.data > 0) {
        return { ...n, label, badge: newRegCount.data };
      }
      if (n.to === "/dashboard/leads" && newLeadCount.data && newLeadCount.data > 0) {
        return { ...n, label, badge: newLeadCount.data };
      }
      return { ...n, label };
    });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
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
        <aside className="hidden md:block w-64 border-r border-border bg-sidebar text-sidebar-foreground sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarInner tenant={tenant} items={navWithBadges} onSignOut={signOut} role={profile.role} />
        </aside>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-32 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar items={navWithBadges} />
    </div>
  );
}

function MobileTabBar({ items }: { items: (NavItem & { badge?: number })[] }) {
  const location = useLocation();
  const priority = [
    "/dashboard",
    "/dashboard/fees",
    "/dashboard/students",
    "/dashboard/registrations",
    "/dashboard/profile",
  ];
  const primary = priority
    .map((p) => items.find((i) => i.to === p))
    .filter((x): x is NavItem & { badge?: number } => !!x);
  return (
    <nav
      className="fixed inset-x-3 z-30 md:hidden rounded-2xl border border-border bg-card/95 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="grid px-1 py-1.5"
        style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}
      >
        {primary.map((n) => {
          const active =
            n.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-[22px]" />
              <span className="truncate max-w-[64px]">{n.label}</span>
              {n.badge ? (
                <span className="absolute top-1 right-1/4 min-w-[16px] rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
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
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="size-9 rounded-xl grid place-items-center text-primary-foreground text-xs font-black shrink-0 shadow-sm"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt="" className="size-9 rounded-xl object-cover" />
        ) : (
          tenant.name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-sm font-bold truncate">{tenant.name}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
          {t("Dashboard")}
        </div>
      </div>
    </div>
  );
}

function SidebarInner({
  tenant,
  items,
  onNavigate,
  onSignOut,
  role,
}: {
  tenant: { name: string };
  items: (NavItem & { badge?: number })[];
  onNavigate?: () => void;
  onSignOut: () => void;
  role: string;
}) {
  const location = useLocation();
  const { t } = useT();
  const mainItems = items.filter((i) => i.section !== "manage");
  const manageItems = items.filter((i) => i.section === "manage");

  const renderItem = (n: NavItem & { badge?: number }) => {
    const active =
      n.to === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(n.to);
    const Icon = n.icon;
    return (
      <Link
        key={n.to}
        to={n.to}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" />
        <span className="flex-1 truncate">{n.label}</span>
        {n.badge ? (
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
              active
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-destructive text-destructive-foreground",
            )}
          >
            {n.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <div className="text-sm font-bold truncate">{tenant.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{role}</div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainItems.map(renderItem)}
        {manageItems.length > 0 ? (
          <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground">
            {t("Manage")}
          </div>
        ) : null}
        {manageItems.map(renderItem)}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="size-4 mr-2" /> {t("Sign out")}
        </Button>
      </div>
    </div>
  );
}
