import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

export function SectionTitle({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <div className="size-8 rounded-lg grid place-items-center bg-accent/40 text-muted-foreground group-hover:text-foreground transition-colors">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="text-3xl font-bold tracking-tight">{value}</div>
      )}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
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
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  onClick?: () => void;
  accent?: "brand" | "muted";
}) {
  const inner = (
    <div className="group relative flex h-full flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md">
      <div
        className={cn(
          "size-11 rounded-xl grid place-items-center transition-transform group-hover:scale-105",
          accent === "brand" ? "text-white" : "bg-accent/50 text-foreground",
        )}
        style={
          accent === "brand"
            ? { backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }
            : undefined
        }
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 py-14 px-6 text-center">
      <div
        className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl text-white"
        style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
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
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
