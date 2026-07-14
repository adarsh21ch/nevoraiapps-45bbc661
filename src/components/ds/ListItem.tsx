import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** ListItem — Apple-style row for lists (contacts, players, matches). */
export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  href,
  showChevron,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  showChevron?: boolean;
  className?: string;
}) {
  const Tag = href ? "a" : onClick ? "button" : "div";
  const interactive = Boolean(onClick || href);
  return (
    <Tag
      {...(href ? { href } : {})}
      onClick={onClick}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 w-full text-left",
        "px-3 py-2.5 rounded-xl",
        interactive && "hover:bg-accent/40 active:bg-accent/60 transition-colors",
        className,
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : <span />}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        {trailing}
        {showChevron ? <ChevronRight className="size-4" /> : null}
      </div>
    </Tag>
  );
}
