import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card — consistent surface with border + soft shadow. */
export function Card({
  children,
  className,
  onClick,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button" | "article";
}) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground",
        "shadow-[var(--shadow-soft)]",
        onClick && "cursor-pointer transition-transform active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** StatCard — compact KPI tile. */
export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = "default",
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    default: "",
    success: "text-[color:var(--accent-success)]",
    warning: "text-[color:var(--accent-award)]",
    danger: "text-[color:var(--accent-wicket)]",
  };
  return (
    <Card
      onClick={onClick}
      as={onClick ? "button" : "div"}
      className={cn("p-3 text-left w-full", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground shrink-0">{icon}</span> : null}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums leading-tight", toneClass[tone])}>
        {value}
      </div>
      {delta ? <div className="mt-0.5 text-[11px] text-muted-foreground">{delta}</div> : null}
    </Card>
  );
}
