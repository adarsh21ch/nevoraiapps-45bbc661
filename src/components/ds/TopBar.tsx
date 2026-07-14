import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * TopBar — page header with optional back action, title, and trailing slot.
 *
 * Sits inside AppShell's sticky top slot. Height is fixed at h-14 to match
 * the safe-area-aware spacer.
 */
export function TopBar({
  title,
  subtitle,
  onBack,
  showBack,
  leading,
  trailing,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const back = () => {
    if (onBack) return onBack();
    router.history.back();
  };

  return (
    <header
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 h-14 px-3",
        className,
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="inline-grid place-items-center size-9 -ml-1 rounded-full hover:bg-accent"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}
        {leading}
      </div>
      <div className="min-w-0 text-center">
        {title ? <div className="truncate text-base font-semibold leading-tight">{title}</div> : null}
        {subtitle ? <div className="truncate text-xs text-muted-foreground leading-tight">{subtitle}</div> : null}
      </div>
      <div className="flex items-center justify-end gap-1">{trailing}</div>
    </header>
  );
}
