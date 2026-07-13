import { useDashboard } from "@/lib/dashboard-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDemoMode, setDemoMode, resetDemoData } from "@/lib/mc-demo/store";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Sparkles } from "lucide-react";

export function DemoSettingsCard() {
  const { tenant } = useDashboard();
  const on = useDemoMode(tenant.id);
  const qc = useQueryClient();

  const toggle = (value: boolean) => {
    setDemoMode(tenant.id, value);
    qc.invalidateQueries();
    toast.success(value ? "Demo data is now visible" : "Demo data hidden");
  };

  const reset = () => {
    resetDemoData(tenant.id);
    qc.invalidateQueries();
    toast.success("Demo data regenerated");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Demo Data</h3>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-lg">
            Populate every Match Center screen with realistic sample players, teams,
            tournaments, matches and records — including a live match currently in
            progress. Real academy data is never modified. Turn off any time.
          </p>
        </div>
        <Switch checked={on} onCheckedChange={toggle} aria-label="Toggle demo data" />
      </div>

      {on && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
            Demo data is layered on top of your academy — visible only to you on this device.
          </div>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="size-3.5 mr-1.5" />
            Reset demo data
          </Button>
        </div>
      )}
    </div>
  );
}
