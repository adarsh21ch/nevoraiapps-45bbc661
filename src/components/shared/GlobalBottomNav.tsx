import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardOptional } from "@/lib/dashboard-context";
import { useNewRegistrationsCount } from "@/hooks/use-new-registrations";
import { useKeyboardOpen } from "@/hooks/use-visual-viewport";
import { useCurrentRole } from "@/hooks/use-current-role";
import { BottomNav } from "@/components/ds/BottomNav";
import { ScanStudentCardDialog } from "@/components/attendance/ScanStudentCardDialog";
import { ScanAttendanceDialog } from "@/components/attendance/ScanAttendanceDialog";
import { fetchStudentHome, studentKeys, fetchMyPortalContext } from "@/lib/student-app";
import { cn } from "@/lib/utils";

/**
 * Unified mobile bottom navigation. Delegates to the design-system `BottomNav`
 * which is role-aware (owner/admin/student). Kept as a wrapper so existing
 * shells (`DashboardShell`, `MatchCenterLayout`) don't need to change.
 */
export function GlobalBottomNav() {
  const dash = useDashboardOptional();
  const tenantId = dash?.tenant.id;
  const location = useLocation();
  const keyboardOpen = useKeyboardOpen();
  const role = useCurrentRole();
  const qc = useQueryClient();
  
  const [staffScanOpen, setStaffScanOpen] = useState(false);
  const [studentScanOpen, setStudentScanOpen] = useState(false);

  const newRegs = useNewRegistrationsCount(tenantId ?? "");
  const { data: studentCtx } = useQuery({ 
    queryKey: studentKeys.me, 
    queryFn: fetchMyPortalContext,
    enabled: role === "student"
  });
  
  const { data: studentHome } = useQuery({
    queryKey: studentCtx ? studentKeys.home(studentCtx.student_id) : ["student", "home", "none"],
    queryFn: () => fetchStudentHome(studentCtx!),
    enabled: role === "student" && !!studentCtx,
  });

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

  const hidden = keyboardOpen || location.pathname === "/dashboard/nevorai";

  const handleFabClick = () => {
    if (role === "student") {
      setStudentScanOpen(true);
    } else {
      setStaffScanOpen(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 md:hidden transition-transform duration-200",
          hidden && "translate-y-full pointer-events-none",
        )}
        aria-hidden={hidden}
      >
        {/* Floating Action Button (QR Scanner) */}
        <div className="absolute left-[50%] -translate-x-1/2 -top-6">
          <button
            onClick={handleFabClick}
            className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background active:scale-90 transition-transform"
            aria-label="Scan QR for attendance"
          >
            <QrCode className="size-6" />
          </button>
        </div>


        <BottomNav badges={badges} liveKeys={liveKeys} />
      </div>

      {role !== "student" && (
        <ScanStudentCardDialog
          open={staffScanOpen}
          onOpenChange={setStaffScanOpen}
        />
      )}

      {role === "student" && studentCtx && (
        <ScanAttendanceDialog
          open={studentScanOpen}
          onOpenChange={setStudentScanOpen}
          mode={studentHome?.todayVisit && !studentHome.todayVisit.check_out_at ? "out" : "in"}
          onRecorded={() => {
            void qc.invalidateQueries({ queryKey: studentKeys.home(studentCtx.student_id) });
          }}
        />
      )}
    </>
  );
}


