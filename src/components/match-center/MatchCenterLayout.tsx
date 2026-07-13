import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard,
  Radio,
  PlusCircle,
  Trophy,
  Users2,
  User,
  Medal,
  Award,
  ListOrdered,
  Settings,
  Search,
  Bell,
  LogOut,
  ArrowLeft,
  Swords,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/match-center/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/match-center/live", label: "Live Matches", icon: Radio },
  { to: "/match-center/create", label: "Create Match", icon: PlusCircle },
  { to: "/match-center/matches", label: "Matches", icon: Swords },
  { to: "/match-center/teams", label: "Teams", icon: Users2 },
  { to: "/match-center/players", label: "Players", icon: User },
  { to: "/match-center/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/match-center/leaderboards", label: "Leaderboards", icon: ListOrdered },
  { to: "/match-center/records", label: "Records", icon: Medal },
  { to: "/match-center/awards", label: "Awards", icon: Award },
  { to: "/match-center/recognition", label: "Recognition", icon: Award },
  { to: "/match-center/ai-insights", label: "AI Insights", icon: Award },
  { to: "/match-center/settings", label: "Settings", icon: Settings },

];

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
};

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3" />}
              {b.to ? (
                <Link to={b.to} className="hover:text-foreground transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground/80">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SearchBar({
  placeholder = "Search players, teams, matches, tournaments…",
  onQuery,
  className,
}: {
  placeholder?: string;
  onQuery?: (q: string) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onQuery?.(e.target.value);
        }}
        placeholder={placeholder}
        className="pl-9 h-10 bg-card"
      />
    </div>
  );
}

export function MatchCenterLayout({ children }: { children?: ReactNode }) {
  const { tenant, signOut } = useDashboard();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <button
            className="md:hidden -ml-1 p-2 rounded-lg hover:bg-accent/50"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Academy OS
          </button>
          <div className="hidden md:block w-px h-5 bg-border" />
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-8 rounded-lg grid place-items-center text-white text-base shrink-0"
              style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
            >
              🏏
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate leading-tight">Match Center</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                {tenant.name}
              </div>
            </div>
          </div>

          <div className="hidden lg:block flex-1 max-w-md mx-6">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="size-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-60 border-r border-border bg-card sticky top-[57px] h-[calc(100vh-57px)]">
          <SidebarInner onNavigate={() => {}} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside
              className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="text-sm font-semibold">Match Center</div>
                <button
                  className="p-1.5 rounded-md hover:bg-accent/50"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarInner onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom nav (top 5 items) */}
      <MobileBottomNav />
    </div>
  );
}

function SidebarInner({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto h-full">
      {NAV.map((n) => {
        const active = location.pathname === n.to || location.pathname.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              active
                ? "font-semibold text-foreground bg-accent/50"
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
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const tabs = [
    NAV[0],
    NAV[1],
    NAV[3],
    NAV[4],
    NAV[5],
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 md:hidden border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)", paddingTop: "6px" }}
    >
      <div className="grid grid-cols-5">
        {tabs.map((n) => {
          const active =
            location.pathname === n.to || location.pathname.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-2 min-h-[64px] text-[10px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate max-w-[68px] leading-none">{n.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full"
                  style={{ backgroundColor: "var(--brand)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
