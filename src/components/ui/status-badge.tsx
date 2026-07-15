import { cn } from "@/lib/utils";

/**
 * Unified status token used across match cards, list rows, and headers.
 * Keeps colour semantics consistent everywhere so users learn the palette
 * once: red = live, blue = upcoming, neutral = finalized, amber = paused.
 */
export type MatchStatusTone = "live" | "upcoming" | "finalized" | "paused" | "scheduled";

const TONES: Record<MatchStatusTone, { wrap: string; dot: string; pulse: boolean; label: string }> =
  {
    live: {
      wrap: "border-destructive/40 bg-destructive/10 text-destructive",
      dot: "bg-destructive",
      pulse: true,
      label: "Live",
    },
    upcoming: {
      wrap: "border-primary/35 bg-primary/10 text-primary",
      dot: "bg-primary",
      pulse: false,
      label: "Upcoming",
    },
    scheduled: {
      wrap: "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
      dot: "bg-muted-foreground",
      pulse: false,
      label: "Scheduled",
    },
    finalized: {
      wrap: "border-foreground/15 bg-foreground/5 text-foreground/70",
      dot: "bg-foreground/60",
      pulse: false,
      label: "Result",
    },
    paused: {
      wrap: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      pulse: true,
      label: "Paused",
    },
  };

export function StatusBadge({
  tone,
  label,
  className,
  compact = false,
}: {
  tone: MatchStatusTone;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-black uppercase leading-none tracking-wider",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
        t.wrap,
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full",
          compact ? "size-1.5" : "size-2",
          t.dot,
          t.pulse && "animate-pulse",
        )}
      />
      {label ?? t.label}
    </span>
  );
}
