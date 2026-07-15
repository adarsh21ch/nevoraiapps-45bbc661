import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DashboardEmptyState — the canonical empty state.
 * Structure: illustration → title → subtitle → primary/secondary action.
 * Every module must use this instead of a bespoke empty layout.
 */
export function DashboardEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-10 md:py-14 px-4",
        className,
      )}
    >
      <div className="grid place-items-center size-12 rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="max-w-md space-y-1">
        <div className="text-base font-semibold text-foreground">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center gap-2 flex-wrap justify-center pt-1">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/**
 * DashboardLoadingState — the canonical list-skeleton used across the app.
 * Copies the Students module's row skeleton verbatim.
 */
export function DashboardLoadingState({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * DashboardErrorState — the canonical error surface for a failed query.
 */
export function DashboardErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-10 px-4",
        className,
      )}
    >
      <div className="grid place-items-center size-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="size-5" />
      </div>
      <div className="max-w-md space-y-1">
        <div className="text-base font-semibold text-foreground">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
