/**
 * <AskNevorAI /> — an inline chip that opens NevorAI with a pre-filled
 * prompt about the current page/entity.
 *
 * Any page can drop this into its header/toolbar. Reuses the global
 * NevorAI panel (no new AI runtime).
 */

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNevorAI } from "@/components/nevorai/NevorAIProvider";

export function AskNevorAI({
  prompt,
  label = "Ask NevorAI",
  className,
}: {
  prompt: string;
  label?: string;
  className?: string;
}) {
  const { open } = useNevorAI();
  return (
    <button
      type="button"
      onClick={() => open({ prompt })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground transition",
        "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
        className,
      )}
    >
      <Sparkles
        className="size-3"
        style={{ color: "var(--tenant-brand, var(--brand, #E8873C))" }}
      />
      {label}
    </button>
  );
}
