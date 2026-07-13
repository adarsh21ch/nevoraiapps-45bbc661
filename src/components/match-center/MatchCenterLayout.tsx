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
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { DemoBadge } from "@/components/match-center/demo-badge";
import { GlobalBottomNav } from "@/components/shared/GlobalBottomNav";

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
      { to: "/match-center/performance", label: "Performance", icon: LineChart },
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
    <div className="mb-5 sm:mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mb-3 overflow-x-auto whitespace-nowrap">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3 shrink-0" />}
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[19px] sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight sm:whitespace-normal sm:[text-wrap:balance]">
            {title}
          </h1>
          {description && (
            <p
              className="mt-0.5 sm:mt-1.5 text-[12.5px] sm:text-sm text-muted-foreground max-w-2xl overflow-hidden"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center justify-end gap-2">{actions}</div>
        )}
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
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center gap-2 px-3 md:h-auto md:gap-3 md:px-6 md:py-3">
          <button
            className="md:hidden -ml-1 grid size-11 place-items-center rounded-lg hover:bg-accent/50 no-tap-highlight"
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
          <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial">
            <div
              className="size-7 md:size-8 rounded-lg grid place-items-center text-white text-sm md:text-base shrink-0"
              style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
            >
              🏏
            </div>
            <div className="min-w-0">
              <div className="text-[13px] md:text-sm font-semibold truncate leading-tight">
                <span className="md:hidden">{tenant.name}</span>
                <span className="hidden md:inline">Match Center</span>
              </div>
              <div className="hidden md:block text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                {tenant.name}
              </div>
            </div>
          </div>

          <div className="hidden lg:block flex-1 max-w-md mx-6">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-0.5 md:gap-1.5">
            <DemoBadge />
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
              className="size-11 rounded-full"
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
            role="dialog"
            aria-modal="true"
            aria-label="Match Center navigation"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <aside
              className="absolute left-0 top-0 flex h-dvh w-[86vw] max-w-[320px] flex-col border-r border-border bg-card shadow-xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
                <div className="text-sm font-semibold truncate">Match Center</div>
                <button
                  className="tap-target no-tap-highlight grid place-items-center rounded-lg hover:bg-accent/50 -mr-1"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <SidebarInner onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <main
          key={location.pathname}
          className="flex-1 min-w-0 px-3 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)] sm:px-4 sm:pt-6 md:p-8 md:pb-8 max-w-7xl mx-auto w-full no-tap-highlight page-enter"
        >
          {children ?? <Outlet />}
        </main>

      </div>

      {/* Unified mobile bottom nav — shared with Academy OS shell. */}
      <GlobalBottomNav />
    </div>
  );
}

function SidebarInner({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation();
  return (
    <nav className="px-2 py-3 space-y-5 md:h-full md:overflow-y-auto">
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
