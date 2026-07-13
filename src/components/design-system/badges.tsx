import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { accentVar, type AccentTone } from "./tokens";

/**
 * Semantic status badges. Prefer these over ad-hoc bg-red-500 styling.
 * Tone maps to a CSS token — colors flex correctly across light and dark themes.
 */

export function StatusBadge({
  tone = "neutral",
  variant = "soft",
  pulse,
  children,
  className,
}: {
  tone?: AccentTone;
  variant?: "soft" | "solid" | "outline";
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const color = accentVar[tone];
  const style: React.CSSProperties =
    variant === "solid"
      ? { backgroundColor: color, color: "var(--background)" }
      : variant === "outline"
        ? {
            color,
            borderColor: `color-mix(in oklch, ${color} 50%, transparent)`,
            backgroundColor: "transparent",
          }
        : {
            color,
            backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
            borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
          };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        className,
      )}
      style={style}
    >
      {pulse && (
        <span className="relative flex size-1.5" aria-hidden>
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
          <span
            className="relative inline-flex size-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        </span>
      )}
      {children}
    </span>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="live" pulse className={className}>
      LIVE
    </StatusBadge>
  );
}
export function TournamentBadge({ children = "Tournament", className }: { children?: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="tournament" className={className}>
      {children}
    </StatusBadge>
  );
}
export function RecognitionBadge({ children = "Recognition", className }: { children?: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="award" className={className}>
      {children}
    </StatusBadge>
  );
}
export function AIBadge({ children = "AI", className }: { children?: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="ai" className={className}>
      {children}
    </StatusBadge>
  );
}
export function SuccessBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="success" className={className}>
      {children}
    </StatusBadge>
  );
}
export function WarningBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="warning" className={className}>
      {children}
    </StatusBadge>
  );
}
export function ErrorBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <StatusBadge tone="danger" className={className}>
      {children}
    </StatusBadge>
  );
}
