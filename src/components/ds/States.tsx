import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** EmptyState — every list should render one when there's no data. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center gap-2 py-10 px-6", className)}>
      <div className="grid place-items-center size-12 rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {description ? (
        <div className="text-xs text-muted-foreground max-w-xs">{description}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** ErrorState — friendly, always offers a retry. */
export function ErrorState({
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
    <div className={cn("flex flex-col items-center text-center gap-2 py-10 px-6", className)}>
      <div className="grid place-items-center size-12 rounded-full bg-[color:var(--accent-wicket)]/12 text-[color:var(--accent-wicket)]">
        <AlertTriangle className="size-5" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {description ? (
        <div className="text-xs text-muted-foreground max-w-xs">{description}</div>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 gap-1">
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Skeleton — placeholder shape while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("animate-pulse rounded-md bg-muted/70", className)}
    />
  );
}

/** LoadingState — page-level skeleton shapes. */
export function LoadingState({
  variant = "list",
  rows = 4,
}: {
  variant?: "list" | "cards" | "detail" | "stats";
  rows?: number;
}) {
  if (variant === "stats") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (variant === "cards") {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (variant === "detail") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
