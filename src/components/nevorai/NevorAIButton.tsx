/**
 * ✨ NevorAI header button — global entry point for the AI panel.
 *
 * Shows a subtle badge when NevorAI has proactive priorities (overdue
 * invoices, automation failures, absent players, pending admissions, etc.).
 * Reuses the existing `getPriorities` server function.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPriorities } from "@/lib/nevorai/priorities.functions";
import { useNevorAI } from "@/components/nevorai/NevorAIProvider";
import { useT } from "@/lib/i18n";

export function NevorAIButton({ className }: { className?: string }) {
  const { open, close, isOpen } = useNevorAI();
  const { t } = useT();
  const fetchPriorities = useServerFn(getPriorities);
  const q = useQuery({
    queryKey: ["nevorai", "priorities-badge"],
    queryFn: () => fetchPriorities({ data: undefined as never }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const critical = (q.data ?? []).filter((p) => p.severity === "critical").length;
  const total = q.data?.length ?? 0;
  const showDot = total > 0;

  return (
    <button
      type="button"
      onClick={() => (isOpen ? close() : open())}
      aria-pressed={isOpen}
      aria-label={isOpen ? t("Close NevorAI") : t("Open NevorAI")}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-sm transition",
        "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]",
        className,
      )}
    >
      <Sparkles
        className="size-3.5"
        style={{ color: "var(--tenant-brand, var(--brand, #E8873C))" }}
      />
      <span className="hidden sm:inline">NevorAI</span>
      {showDot ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 grid min-w-[16px] h-[16px] place-items-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-background",
            critical > 0 ? "bg-rose-600" : "bg-sky-500",
          )}
        >
          {total > 9 ? "9+" : total}
        </span>
      ) : null}
    </button>
  );
}
