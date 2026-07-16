import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Clock,
  Swords,
  MessageSquareQuote,
  ChevronRight,
  IndianRupee,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStudentHome, studentKeys } from "@/lib/student-app";
import {
  fetchChildBillingSummary,
  parentKeys,
  type ChildContext,
  type ParentChildRow,
} from "@/lib/parent-app";
import { useParentChild } from "@/hooks/use-parent-child";

export const Route = createFileRoute("/parent/")({
  component: ParentHomePage,
});

function ParentHomePage() {
  const { child, childRow } = useParentChild();
  return <ParentHomeInner child={child} childRow={childRow} />;
}

function ParentHomeInner({
  child,
  childRow,
}: {
  child: ChildContext | null | undefined;
  childRow: ParentChildRow;
}) {
  const homeQ = useQuery({
    queryKey: child ? studentKeys.home(child.student_id) : ["parent", "home", "none"],
    queryFn: () => fetchStudentHome(child!),
    enabled: !!child,
  });
  const billQ = useQuery({
    queryKey: child ? parentKeys.billing(child.student_id) : ["parent", "billing", "none"],
    queryFn: () => fetchChildBillingSummary(child!.student_id, child!.tenant_id),
    enabled: !!child,
  });

  const attendancePct = useMemo(() => {
    if (!homeQ.data) return null;
    // rough month attendance %: presentDays / distinct dates in visits
    const dates = new Set(homeQ.data.visitsThisMonth.map((v) => v.session_date));
    const present = new Set(
      homeQ.data.visitsThisMonth.filter((v) => v.status === "present").map((v) => v.session_date),
    );
    if (dates.size === 0) return 0;
    return Math.round((present.size / dates.size) * 100);
  }, [homeQ.data]);

  if (!child || homeQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  const home = homeQ.data!;

  const inAcademy = !!(home.todayVisit && !home.todayVisit.check_out_at);
  const checkIn = home.todayVisit?.check_in_at
    ? new Date(home.todayVisit.check_in_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const checkOut = home.todayVisit?.check_out_at
    ? new Date(home.todayVisit.check_out_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* Hero card — warm, child-first */}
      <Card className="p-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-primary/20 grid place-items-center overflow-hidden shrink-0">
            {childRow.photo_url ? (
              <img src={childRow.photo_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-primary">
                {childRow.student_name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">How is</p>
            <h1 className="text-xl font-semibold truncate">{childRow.student_name}</h1>
            <p
              className={`text-xs mt-0.5 inline-flex items-center gap-1.5 ${
                inAcademy ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  inAcademy ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                }`}
              />
              {inAcademy
                ? "In the academy right now"
                : home.todayVisit
                  ? "Practice complete today"
                  : "Not at the academy today"}
            </p>
          </div>
        </div>

        {(checkIn || checkOut) && (
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
            <TimePill label="Check in" value={checkIn} />
            <TimePill label="Check out" value={checkOut} />
          </div>
        )}
      </Card>

      {/* Snapshot */}
      <div className="grid grid-cols-2 gap-3">
        <MiniCard
          icon={<Clock className="size-4" />}
          label="Practice this month"
          value={`${home.hoursThisMonth.toFixed(1)} hrs`}
        />
        <MiniCard
          icon={<Activity className="size-4" />}
          label="Attendance"
          value={attendancePct !== null ? `${attendancePct}%` : "—"}
        />
      </div>

      {/* Upcoming match */}
      {home.upcomingMatch?.match && (
        <Link to="/parent/timeline" className="block">
          <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
            <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
              <Swords className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Upcoming Match
              </p>
              <p className="text-sm font-medium truncate">
                {home.upcomingMatch.match.match_format ?? "Match"} ·{" "}
                {home.upcomingMatch.match.ground_name ?? "TBD"}
              </p>
              <p className="text-xs text-muted-foreground">
                {home.upcomingMatch.match.scheduled_date
                  ? new Date(home.upcomingMatch.match.scheduled_date).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )
                  : "Date TBD"}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      {/* Coach note */}
      {home.latestRemark && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareQuote className="size-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Coach's Latest Note
            </p>
          </div>
          <p className="text-sm leading-relaxed">"{home.latestRemark.remark}"</p>
          <p className="text-xs text-muted-foreground mt-2">
            {home.latestRemark.author_name ?? "Coach"} ·{" "}
            {new Date(home.latestRemark.created_at).toLocaleDateString()}
          </p>
        </Card>
      )}

      {/* Outstanding fees (opt-in per academy) */}
      {billQ.data?.enabled && billQ.data.outstanding > 0 && (
        <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-amber-500/20 grid place-items-center text-amber-600 dark:text-amber-400">
              <IndianRupee className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Outstanding Fees
              </p>
              <p className="text-lg font-semibold">
                {billQ.data.currency} {billQ.data.outstanding.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {billQ.data.invoices.length} invoice
                {billQ.data.invoices.length === 1 ? "" : "s"} pending
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cross-link to Match Center parent experience (kept separate; supports demo tenants) */}
      <div className="pt-1 text-center">
        <Link
          to="/parent-portal"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Open Match Center parent view →
        </Link>
      </div>
    </div>
  );

}

function TimePill({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Card>
  );
}
