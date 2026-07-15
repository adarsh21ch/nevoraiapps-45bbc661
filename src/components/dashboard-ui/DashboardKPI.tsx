import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DashboardKPIRow — responsive grid for KPI cards. Mirrors the Students KPI
 * strip. Every dashboard route must use this instead of hand-rolling a grid.
 */
export function DashboardKPIRow({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
}) {
  const cols =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-2 md:grid-cols-3"
        : columns === 5
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          : columns === 6
            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            : "grid-cols-2 md:grid-cols-4";
  return <div className={cn("grid gap-2 md:gap-3", cols, className)}>{children}</div>;
}

/**
 * DashboardKPICard — single KPI. Reuses the exact card token
 * (rounded-2xl / bg-card / border / shadow-sm) from Students.
 */
export function DashboardKPICard({
  label,
  value,
  delta,
  tone = "default",
  icon,
  onClick,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : tone === "info"
            ? "text-sky-600 dark:text-sky-400"
            : "text-foreground";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-card border border-border shadow-sm p-3 md:p-4 text-left transition-colors",
        onClick && "hover:bg-accent/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
          {label}
        </div>
        {icon ? <div className="text-muted-foreground shrink-0">{icon}</div> : null}
      </div>
      <div className={cn("mt-1 text-xl md:text-2xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {delta ? <div className="text-xs text-muted-foreground mt-0.5">{delta}</div> : null}
    </Tag>
  );
}

/**
 * DashboardStat — compact inline stat, used inside cards or side panels.
 */
export function DashboardStat({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
        {label}
      </div>
      <div className="text-sm md:text-base font-semibold text-foreground tabular-nums truncate">
        {value}
      </div>
    </div>
  );
}
