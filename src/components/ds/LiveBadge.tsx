/**
 * LiveBadge — realtime connection / liveness indicator.
 *
 * States:
 *  - "live"       → pulsing dot, "LIVE"
 *  - "connecting" → static amber dot, "…"
 *  - "stale"      → static muted dot, "OFFLINE"
 */

import { cn } from "@/lib/utils";

export type LiveState = "live" | "connecting" | "stale";

export interface LiveBadgeProps {
  state?: LiveState;
  label?: string;
  className?: string;
}

export function LiveBadge({ state = "live", label, className }: LiveBadgeProps) {
  const text =
    label ?? (state === "live" ? "LIVE" : state === "connecting" ? "SYNCING" : "OFFLINE");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        state === "live" && "bg-destructive/10 text-destructive",
        state === "connecting" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        state === "stale" && "bg-muted text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          state === "live" && "bg-destructive animate-pulse",
          state === "connecting" && "bg-amber-500",
          state === "stale" && "bg-muted-foreground/60",
        )}
        aria-hidden
      />
      {text}
    </span>
  );
}
