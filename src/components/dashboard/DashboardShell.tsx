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

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const nav: (NavItem & { requiresFeature?: "fee_tracking" })[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dashboard/fees", label: "Fees", icon: IndianRupee, requiresFeature: "fee_tracking" },
  { to: "/dashboard/students", label: "Students", icon: Users },
  { to: "/dashboard/registrations", label: "Registrations", icon: Inbox },
  { to: "/dashboard/leads", label: "Leads", icon: MessageSquareText },
  { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/dashboard/reminders", label: "Reminders", icon: BellRing, requiresFeature: "fee_tracking" },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, requiresFeature: "fee_tracking" },
  { to: "/dashboard/batches", label: "Batches", icon: CalendarDays },
  { to: "/dashboard/fee-plans", label: "Fee plans", icon: Wallet },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle },
];



export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant, profile, signOut } = useDashboard();

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
      if (n.to === "/dashboard/registrations" && newRegCount.data && newRegCount.data > 0) {
        return { ...n, badge: newRegCount.data };
      }
      if (n.to === "/dashboard/leads" && newLeadCount.data && newLeadCount.data > 0) {
        return { ...n, badge: newLeadCount.data };
      }
      return n;
    });


  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <TenantMark tenant={tenant} />
          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/?tenant=${tenant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View site <ExternalLink className="size-3" />
            </a>
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="size-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 border-r bg-background sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarInner
            tenant={tenant}
            items={navWithBadges}
            onSignOut={signOut}
            role={profile.role}
          />
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
  // Fixed 5-slot bottom bar: Home · Fees · Students · Registrations · Profile
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
      className="fixed inset-x-3 z-30 md:hidden rounded-2xl border border-border bg-background/85 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl"
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
                active ? "text-foreground bg-[color-mix(in_oklab,var(--brand)_14%,transparent)]" : "text-muted-foreground",
              )}
              style={active ? { color: "var(--brand-ink, var(--brand))" } : undefined}
            >
              <Icon className="size-[22px]" />
              <span className="truncate max-w-[64px]">{n.label}</span>

              {n.badge ? (
                <span
                  className="absolute top-1 right-1/4 min-w-[16px] rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ backgroundColor: "var(--brand, #0ea5e9)" }}
                >
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
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="size-8 rounded-md grid place-items-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: "var(--brand, #0ea5e9)" }}
      >
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt="" className="size-8 rounded-md object-cover" />
        ) : (
          tenant.name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{tenant.name}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dashboard</div>
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
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b">
        <div className="text-sm font-semibold truncate">{tenant.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{role}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
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
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-[var(--brand)]/10 text-[var(--brand-ink)] font-medium"
                  : "text-muted-foreground hover:bg-muted",
              )}
              style={active ? { color: "var(--brand-ink, currentColor)" } : undefined}
            >
              <Icon className="size-4" />
              <span className="flex-1">{n.label}</span>
              {n.badge ? (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: "var(--brand, #0ea5e9)" }}
                >
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onSignOut}>
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}
