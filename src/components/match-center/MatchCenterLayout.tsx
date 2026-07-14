import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { PlusCircle, Search, ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { DemoBadge } from "@/components/match-center/demo-badge";
import { MatchCenterBottomNav } from "@/components/match-center/MatchCenterBottomNav";
import { isOwner } from "@/lib/roles";

/* -------------------------------------------------------------------------- */
/* Shared page bits                                                           */
/* -------------------------------------------------------------------------- */

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
};

/**
 * Compact page header. On mobile it is intentionally minimal — the bottom-nav
 * label already tells the user which tab they are on. Breadcrumbs and long
 * descriptions only render from `sm:` upward.
 */
export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-3 sm:mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mb-2 overflow-x-auto whitespace-nowrap">
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] sm:text-2xl font-bold tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="hidden sm:block mt-1 text-sm text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** iOS-style search input (44px, rounded, muted background). */
export function SearchBar({
  placeholder = "Search",
  onQuery,
  className,
}: {
  placeholder?: string;
  onQuery?: (q: string) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-[17px] text-muted-foreground/80" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onQuery?.(e.target.value);
        }}
        placeholder={placeholder}
        className="h-11 w-full min-w-0 rounded-xl border border-transparent bg-muted/70 pl-9 pr-3 text-[15px] leading-none placeholder:text-muted-foreground/70 focus:border-border focus:bg-card focus:outline-none"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function MatchCenterLayout({ children }: { children?: ReactNode }) {
  const { tenant, profile } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const owner = isOwner(profile);

  return (
    <div className="mc-shell min-h-screen w-full bg-background text-foreground">
      {/* Safe-area top spacer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-background"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      <div aria-hidden="true" className="bg-background" style={{ height: "env(safe-area-inset-top)" }} />

      {/* Compact top bar — one row, ~56px */}
      <header
        className="sticky z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-1.5 px-3">
          {owner && (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="-ml-1.5 grid size-10 shrink-0 place-items-center rounded-full active:bg-accent/60 no-tap-highlight"
              aria-label="Back to Academy"
            >
              <ArrowLeft className="size-[20px]" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white text-[15px]"
              style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
            >
              🏏
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight">Match Center</div>
              <div className="truncate text-[10.5px] uppercase tracking-wide text-muted-foreground leading-tight">
                {tenant.name}
              </div>
            </div>
          </div>

          <DemoBadge />
          <button
            type="button"
            onClick={() => navigate({ to: "/match-center/create" })}
            className="grid size-10 shrink-0 place-items-center rounded-full active:bg-accent/60 no-tap-highlight"
            aria-label="New match"
          >
            <PlusCircle className="size-[22px]" />
          </button>
        </div>
      </header>

      <main
        key={location.pathname}
        className="mx-auto w-full max-w-2xl min-w-0 px-3 pt-4 pb-[calc(env(safe-area-inset-bottom)+76px)] no-tap-highlight page-enter"
      >
        {children ?? <Outlet />}
      </main>

      <MatchCenterBottomNav />
    </div>
  );
}
