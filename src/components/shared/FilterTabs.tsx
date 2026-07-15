import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Universal Filter Tabs — the golden standard used across every dashboard
 * module (Students, Attendance, Fees, Communications, Staff, Reports…).
 *
 * Extracted from Students' proven `TabBtn` design so every module shares the
 * exact same typography, spacing, height, pill radius, selected black state,
 * hover animation, and shadow. Do NOT re-implement this pattern per module —
 * always import this component.
 */
export type FilterTabItem<T extends string = string> = {
  key: T;
  label: string;
  count?: number;
  icon?: ReactNode;
};

export function FilterTabs<T extends string = string>({
  value,
  onChange,
  items,
  ariaLabel,
  className,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  items: readonly FilterTabItem<T>[];
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1",
        className,
      )}
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-card border border-border shadow-sm p-1">
        {items.map((it) => {
          const active = it.key === value;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.key)}
              className={cn(
                "shrink-0 rounded-full font-medium transition-colors whitespace-nowrap",
                "inline-flex items-center gap-1.5",
                size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3 text-sm",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )}
            >
              {it.icon ? <span className="shrink-0">{it.icon}</span> : null}
              <span>{it.label}</span>
              {typeof it.count === "number" ? (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    active ? "opacity-70" : "text-muted-foreground/70",
                  )}
                >
                  {it.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
