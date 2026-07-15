import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DashboardHeader — the standard page header row.
 *
 * Extracted from the Students module. Shows page title + optional subtitle on
 * the left and an actions cluster on the right. Every dashboard route must
 * use this component instead of hand-rolling a header.
 */
export function DashboardHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground truncate">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * DashboardToolbar — a horizontal row that hosts search + filter toggle +
 * inline actions. Sits directly beneath the header/tabs. Use instead of
 * hand-rolling a flex-row wrapper.
 */
export function DashboardToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {children}
    </div>
  );
}

/**
 * DashboardActionBar — sticky bar at the bottom of a page or dialog holding
 * primary/secondary actions. Reuses the Students save-flow pattern.
 */
export function DashboardActionBar({
  children,
  className,
  sticky = false,
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 flex-wrap",
        sticky &&
          "sticky bottom-0 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-3 bg-card/85 backdrop-blur border-t border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}
