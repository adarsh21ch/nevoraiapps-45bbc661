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
  Sparkles,
  Globe,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [{ to: "/match-center/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Live",
    items: [
      { to: "/match-center/live", label: "Live Matches", icon: Radio },
      { to: "/match-center/create", label: "Create Match", icon: PlusCircle },
    ],
  },
  {
    label: "Matches",
    items: [
      { to: "/match-center/matches", label: "Matches", icon: Swords },
      { to: "/match-center/teams", label: "Teams", icon: Users2 },
      { to: "/match-center/players", label: "Players", icon: User },
    ],
  },
  {
    label: "Competitions",
    items: [
      { to: "/match-center/tournaments", label: "Tournaments", icon: Trophy },
      { to: "/match-center/leaderboards", label: "Leaderboards", icon: ListOrdered },
      { to: "/match-center/records", label: "Records", icon: Medal },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/match-center/recognition", label: "Recognition", icon: Award },
      { to: "/match-center/awards", label: "Awards", icon: Medal },
      { to: "/match-center/ai-insights", label: "AI Insights", icon: Sparkles },
    ],
  },
  {
    label: "Public",
    items: [
      { to: "/match-center/website", label: "Website", icon: Globe },
      { to: "/parent-portal", label: "Parent Portal", icon: HeartHandshake },
    ],
  },
  {
    label: "System",
    items: [{ to: "/match-center/settings", label: "Settings", icon: Settings }],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);


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
    <div className={cn("relative group", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onQuery?.(e.target.value);
        }}
        placeholder={placeholder}
        className="pl-9 pr-14 h-10 rounded-full bg-card border-border/70 focus-visible:border-foreground/30"
      />
      <kbd className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground pointer-events-none">
        ⌘K
      </kbd>
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
        <div className="flex items-center gap-3 px-3 py-2.5 md:px-6 md:py-3">
          <button
            className="md:hidden -ml-1 grid tap-target place-items-center rounded-lg hover:bg-accent/50 no-tap-highlight"
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
            <Button
              size="sm"
              className="hidden md:inline-flex rounded-full h-9"
              onClick={() => navigate({ to: "/match-center/create" })}
            >
              <PlusCircle className="size-4 mr-1.5" /> New match
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hidden md:inline-flex"
            >
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

        <main className="flex-1 min-w-0 p-4 md:p-8 max-w-7xl mx-auto w-full pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-8 no-tap-highlight">
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
    <nav className="flex-1 px-2 py-3 space-y-5 overflow-y-auto h-full">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
            {group.label}
          </div>
          {group.items.map((n) => {
            const active =
              location.pathname === n.to || location.pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
                style={
                  active
                    ? {
                        backgroundColor:
                          "color-mix(in oklch, var(--tenant-brand, var(--brand, #E8873C)) 12%, transparent)",
                      }
                    : undefined
                }
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full"
                    style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
                  />
                )}
                <Icon className={cn("size-4 transition-colors", active && "text-foreground")} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
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
      className="fixed inset-x-0 bottom-0 z-30 md:hidden border-t border-border bg-background/95 backdrop-blur no-tap-highlight"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)", paddingTop: "4px" }}
      aria-label="Primary"
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
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 min-h-[56px] text-[10px] font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-[22px]", active && "scale-110")} />
              <span className="truncate max-w-[68px] leading-none">{n.label}</span>
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-9 rounded-b-full"
                  style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
