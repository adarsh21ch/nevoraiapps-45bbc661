import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardOptional } from "@/lib/dashboard-context";
import { useNewRegistrationsCount } from "@/hooks/use-new-registrations";
import { useKeyboardOpen } from "@/hooks/use-visual-viewport";
import { BottomNav } from "@/components/ds/BottomNav";
import { cn } from "@/lib/utils";

/**
 * Unified mobile bottom navigation. Delegates to the design-system `BottomNav`
 * which is role-aware (owner/admin/student). Kept as a wrapper so existing
 * shells (`DashboardShell`, `MatchCenterLayout`) don't need to change.
 *
 * Reuses shared React Query cache keys, so mounting this in both shells does
 * NOT re-query Supabase.
 */
export function GlobalBottomNav() {
  const dash = useDashboardOptional();
  const tenantId = dash?.tenant.id;
  const location = useLocation();
  const keyboardOpen = useKeyboardOpen();


  const newRegs = useNewRegistrationsCount(tenantId ?? "");

  const liveMatches = useQuery({
    queryKey: ["mc-live-count", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { count } = await supabase
        .from("matches" as never)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "live");
      return count ?? 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const badges: Record<string, number> = {};
  if (newRegs > 0) {
    badges["/dashboard/students"] = newRegs;
    badges["/dashboard/attendance"] = 0;
  }
  const liveKeys: string[] = (liveMatches.data ?? 0) > 0 ? ["/match-center"] : [];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <BottomNav badges={badges} liveKeys={liveKeys} />
    </div>
  );
}
