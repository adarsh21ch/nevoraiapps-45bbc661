import { useDashboard } from "@/lib/dashboard-context";
import { useDemoMode } from "@/lib/mc-demo/store";

export function DemoBadge() {
  const { tenant } = useDashboard();
  const on = useDemoMode(tenant.id);
  if (!on) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
      title="Match Center is showing demo data. Turn off in Settings."
      aria-label="Demo data is active"
    >
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      Demo Data
    </span>
  );
}
