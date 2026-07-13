import { isDemoId } from "@/lib/mc-demo/store";
import { useDashboard } from "@/lib/dashboard-context";
import { useDemoMode } from "@/lib/mc-demo/store";

/** Global Demo Academy indicator — visible whenever Demo Mode is on. */
export function DemoBadge() {
  const { tenant } = useDashboard();
  const on = useDemoMode(tenant.id);
  if (!on) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
      title="Match Center is showing Demo Academy data. Turn off in Settings."
      aria-label="Demo Academy is active"
    >
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      Demo Academy
    </span>
  );
}

type EntityKind = "Match" | "Player" | "Tournament" | "Team" | "Scorebook";

/**
 * Inline demo indicator for a specific entity. Renders only when the given
 * id is a demo-* id, so it can be dropped anywhere without a mode check.
 */
export function DemoEntityBadge({
  id,
  kind,
  className,
}: {
  id: string | null | undefined;
  kind: EntityKind;
  className?: string;
}) {
  if (!isDemoId(id)) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 " +
        (className ?? "")
      }
      title={`This ${kind.toLowerCase()} is part of the Demo Academy — data is local to this device.`}
      aria-label={`Demo ${kind}`}
    >
      <span className="size-1 rounded-full bg-amber-500" aria-hidden />
      Demo {kind}
    </span>
  );
}
