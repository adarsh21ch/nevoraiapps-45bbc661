import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

/** Semantic accent tone — maps to CSS custom properties defined in styles.css. */
export type AccentTone =
  | "live"
  | "success"
  | "tournament"
  | "ai"
  | "award"
  | "wicket"
  | "analytics"
  | "neutral";

const toneVar: Record<AccentTone, string> = {
  live: "var(--accent-live)",
  success: "var(--accent-success)",
  tournament: "var(--accent-tournament)",
  ai: "var(--accent-ai)",
  award: "var(--accent-award)",
  wicket: "var(--accent-wicket)",
  analytics: "var(--accent-analytics)",
  neutral: "var(--muted-foreground)",
};

export function SectionTitle({
  title,
  action,
  className,
  eyebrow,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-1">
            {eyebrow}
          </div>
        )}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
  pulse,
  className,
}: {
  tone?: AccentTone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        className,
      )}
      style={{
        borderColor: `color-mix(in oklch, ${toneVar[tone]} 40%, transparent)`,
        color: toneVar[tone],
        backgroundColor: `color-mix(in oklch, ${toneVar[tone]} 12%, transparent)`,
      }}
    >
      {pulse && (
        <span
          className="relative flex size-1.5"
          aria-hidden
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: toneVar[tone] }}
          />
          <span
            className="relative inline-flex size-1.5 rounded-full"
            style={{ backgroundColor: toneVar[tone] }}
          />
        </span>
      )}
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  tone = "neutral",
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  tone?: AccentTone;
  trend?: { value: string; direction: "up" | "down" | "flat" };
}) {
  const TrendIcon =
    trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;
  const trendColor =
    trend?.direction === "up"
      ? "var(--accent-success)"
      : trend?.direction === "down"
        ? "var(--accent-wicket)"
        : "var(--muted-foreground)";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/15 hover:-translate-y-[1px] hover:shadow-[var(--shadow-elev)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <div
            className="size-8 rounded-lg grid place-items-center transition-colors"
            style={{
              backgroundColor: `color-mix(in oklch, ${toneVar[tone]} 12%, transparent)`,
              color: toneVar[tone],
            }}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="text-[28px] sm:text-[32px] font-bold tracking-tight tabular-nums leading-none">
          {value}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 min-h-[16px]">
        {trend && !loading && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums"
            style={{ color: trendColor }}
          >
            <TrendIcon className="size-3" />
            {trend.value}
          </span>
        )}
        {hint && <span className="text-xs text-muted-foreground truncate">{hint}</span>}
      </div>
    </div>
  );
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  to,
  onClick,
  accent = "brand",
  tone,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
  accent?: "brand" | "muted";
  tone?: AccentTone;
}) {
  const iconStyle: React.CSSProperties =
    tone !== undefined
      ? {
          backgroundColor: `color-mix(in oklch, ${toneVar[tone]} 14%, transparent)`,
          color: toneVar[tone],
        }
      : accent === "brand"
        ? { backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))", color: "#fff" }
        : {};
  const inner = (
    <div className="group relative flex h-full flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:-translate-y-[1px] hover:shadow-[var(--shadow-elev)]">
      <div
        className={cn(
          "size-11 rounded-xl grid place-items-center transition-transform group-hover:scale-105",
          !tone && accent === "muted" && "bg-accent/50 text-foreground",
        )}
        style={iconStyle}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</div>
      </div>
      <ArrowRight className="absolute top-5 right-5 size-4 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="block h-full w-full text-left">
      {inner}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryHelp,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryHelp?: string;
  tone?: AccentTone;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 py-14 px-6 text-center">
      <div
        className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl"
        style={
          tone === "neutral"
            ? {
                backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))",
                color: "#fff",
              }
            : {
                backgroundColor: `color-mix(in oklch, ${toneVar[tone]} 16%, transparent)`,
                color: toneVar[tone],
              }
        }
      >
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && (actionTo || onAction) && (
        <div className="mt-6">
          {actionTo ? (
            <Button asChild>
              <Link to={actionTo}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
      {secondaryHelp && (
        <p className="mt-3 text-xs text-muted-foreground/80">{secondaryHelp}</p>
      )}
    </div>
  );
}

export function LoadingSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function DashboardCard({
  title,
  action,
  children,
  className,
  tone,
  icon: Icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: AccentTone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div
              className="size-6 shrink-0 rounded-md grid place-items-center"
              style={
                tone
                  ? {
                      backgroundColor: `color-mix(in oklch, ${toneVar[tone]} 14%, transparent)`,
                      color: toneVar[tone],
                    }
                  : undefined
              }
            >
              <Icon className="size-3.5" />
            </div>
          )}
          <h3 className="text-sm font-semibold tracking-tight truncate">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** Sticky bottom action bar for mobile forms. Renders inline on md+. */
export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-20 -mx-4 md:mx-0 mt-6 border-t border-border bg-background/95 backdrop-blur px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0",
        className,
      )}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
