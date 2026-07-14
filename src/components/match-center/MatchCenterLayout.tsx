import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search, ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { DemoBadge } from "@/components/match-center/demo-badge";
import { MatchCenterBottomNav } from "@/components/match-center/MatchCenterBottomNav";
import { isOwner } from "@/lib/roles";

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
    </div>
  );
}

export function MatchCenterLayout({ children }: { children?: ReactNode }) {
  const { tenant, profile } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const owner = isOwner(profile);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Safe-area top spacer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-background"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      <div aria-hidden="true" className="bg-background" style={{ height: "env(safe-area-inset-top)" }} />

      {/* Compact native top bar — no hamburger, no sidebar. */}
      <header
        className="sticky z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl"
        style={{ top: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3 md:px-4">
          {owner && (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="-ml-1 grid size-10 place-items-center rounded-full hover:bg-accent/50 no-tap-highlight"
              aria-label="Back to Academy"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="grid size-7 shrink-0 place-items-center rounded-lg text-white text-sm"
              style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
            >
              🏏
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-tight truncate">Match Center</div>
              <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground truncate">
                {tenant.name}
              </div>
            </div>
          </div>

          <DemoBadge />
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-10 px-3"
            onClick={() => navigate({ to: "/match-center/create" })}
            aria-label="New match"
          >
            <PlusCircle className="size-[18px]" />
          </Button>
        </div>
      </header>

      <main
        key={location.pathname}
        className="mx-auto w-full max-w-2xl px-3 pt-5 pb-[calc(env(safe-area-inset-bottom)+82px)] sm:px-4 no-tap-highlight page-enter"
      >
        {children ?? <Outlet />}
      </main>

      <MatchCenterBottomNav />
    </div>
  );
}
