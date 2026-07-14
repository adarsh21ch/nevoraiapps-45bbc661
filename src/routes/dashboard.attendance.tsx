/**
 * AcademyOS V2 — Attendance module (Phase 02.2)
 *
 * Full check-in / check-out lifecycle. Append-only history.
 * Realtime updates across all devices via the shared channel registry.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { LogIn, LogOut, Clock } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchStudents, qk } from "@/lib/dashboard-queries";
import { usePermissions } from "@/hooks/use-permissions";
import {
  AppShell,
  TopBar,
  Section,
  Card,
  StatCard,
  ListItem,
  EmptyState,
  LoadingState,
  ErrorState,
  Skeleton,
  SegmentedControl,
  LiveBadge,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import {
  attendanceKeys,
  fetchAttendanceToday,
  useAttendanceRealtime,
  useCheckIn,
  useCheckOut,
} from "@/lib/attendance/queries";
import {
  attendanceStateLabels,
  attendanceStateTone,
  formatDuration,
  type AttendanceState,
} from "@/lib/attendance/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance · AcademyOS" },
      { name: "description", content: "Check students in and out. Live academy roster and append-only attendance history." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canMark = can("canMarkAttendance");

  const [batchId, setBatchId] = useState<string>("");

  const batchesQ = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const studentsQ = useQuery({ queryKey: qk.students(tenant.id), queryFn: () => fetchStudents(tenant.id) });
  const todayQ = useQuery({
    queryKey: attendanceKeys.today(tenant.id),
    queryFn: () => fetchAttendanceToday(tenant.id),
    staleTime: 15_000,
  });

  // Single realtime subscription — updates every card + list on this page.
  useAttendanceRealtime(tenant.id, qc);

  const activeBatches = useMemo(
    () => (batchesQ.data ?? []).filter((b: { active: boolean }) => b.active),
    [batchesQ.data],
  );

  // Default to first batch once loaded
  const effectiveBatchId = batchId || activeBatches[0]?.id || "";

  const batchStudents = useMemo(
    () =>
      (studentsQ.data ?? []).filter(
        (s: { batch_id: string | null; status: string }) =>
          s.batch_id === effectiveBatchId && s.status === "active",
      ),
    [studentsQ.data, effectiveBatchId],
  );

  // Map: student_id → current state row
  const stateByStudent = useMemo(() => {
    const m = new Map<string, ReturnType<typeof fetchAttendanceToday> extends Promise<infer T> ? T extends Array<infer R> ? R : never : never>();
    for (const row of todayQ.data ?? []) {
      if (row.batch_id === effectiveBatchId) m.set(row.student_id, row);
    }
    return m;
  }, [todayQ.data, effectiveBatchId]);

  // KPIs across this batch. Attendance supports multiple visits per player per
  // day. All summary values are DERIVED from raw visit rows — never stored.
  const kpis = useMemo(() => {
    let inAcademy = 0;      // players currently checked in (open visit)
    let present = 0;        // players with ≥1 visit today
    let checkedOutToday = 0;// players whose latest state is checked_out
    let visitsCheckIn = 0;  // total check-ins today (all visits)
    let visitsCheckOut = 0; // total check-outs today (all visits)
    for (const s of batchStudents) {
      const row = stateByStudent.get(s.id);
      const state: AttendanceState = row?.current_state ?? "not_marked";
      const visits = row?.visit_count ?? 0;
      if (state === "in_academy") { inAcademy++; present++; visitsCheckIn += visits; visitsCheckOut += Math.max(visits - 1, 0); }
      else if (state === "checked_out") { checkedOutToday++; present++; visitsCheckIn += visits; visitsCheckOut += visits; }
    }
    const notArrived = batchStudents.length - present;
    return { inAcademy, present, checkedOutToday, notArrived, visitsCheckIn, visitsCheckOut, total: batchStudents.length };
  }, [batchStudents, stateByStudent]);

  const isLoading = batchesQ.isLoading || studentsQ.isLoading || todayQ.isLoading;
  const isError = batchesQ.isError || studentsQ.isError || todayQ.isError;

  return (
    <AppShell>
      <TopBar
        title="Attendance"
        subtitle={format(new Date(), "EEE, d MMM · h:mm a")}
        trailing={<LiveBadge state="live" />}
      />

      {isError ? (
        <ErrorState
          title="Couldn't load attendance"
          description="Please try again."
          onRetry={() => {
            batchesQ.refetch();
            studentsQ.refetch();
            todayQ.refetch();
          }}
        />
      ) : null}

      {isLoading ? (
        <Section>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </Section>
      ) : activeBatches.length === 0 ? (
        <EmptyState
          title="No active batches"
          description="Create a batch to start taking attendance."
        />
      ) : (
        <>
          {/* Batch selector — only if more than one */}
          {activeBatches.length > 1 ? (
            <Section>
              <SegmentedControl
                value={effectiveBatchId}
                onChange={setBatchId}
                options={activeBatches.map((b: { id: string; name: string }) => ({ value: b.id, label: b.name }))}
              />
            </Section>
          ) : null}

          {/* KPI strip — live sports-academy counts. Absent is derived at EOD. */}
          <Section>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="In Academy Now" value={kpis.inAcademy} tone="success" />
              <StatCard label="Checked Out" value={kpis.checkedOut} tone="default" />
              <StatCard label="Not Marked" value={kpis.notMarked} tone="default" />
              <StatCard label="Total" value={kpis.total} tone="default" />
            </div>
          </Section>

          {/* Roster */}
          <Section title="Roster">
            {batchStudents.length === 0 ? (
              <EmptyState title="No students" description="Add students to this batch." />
            ) : (
              <Card className="p-1 divide-y divide-border/60">
                {batchStudents.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    row={stateByStudent.get(s.id)}
                    canMark={canMark}
                    tenantId={tenant.id}
                    batchId={effectiveBatchId}
                  />
                ))}
              </Card>
            )}
          </Section>
        </>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface StudentLite {
  id: string;
  name: string;
  photo_url: string | null;
  player_id: string | null;
}

interface TodayRow {
  mark_id: string;
  current_state: AttendanceState;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
}

function StudentRow({
  student,
  row,
  canMark,
  tenantId,
  batchId,
}: {
  student: StudentLite;
  row: TodayRow | undefined;
  canMark: boolean;
  tenantId: string;
  batchId: string;
}) {
  const state: AttendanceState = row?.current_state ?? "not_marked";
  const checkIn = useCheckIn();
  const checkOut = useCheckOut(tenantId);
  const busy = checkIn.isPending || checkOut.isPending;

  const onCheckIn = () => {
    checkIn.mutate(
      { tenantId, batchId, studentId: student.id },
      {
        onSuccess: () => toast.success(`${student.name} checked in`),
        onError: (e: Error) => toast.error(e.message || "Check-in failed"),
      },
    );
  };
  const onCheckOut = () => {
    if (!row) return;
    checkOut.mutate(
      { markId: row.mark_id },
      {
        onSuccess: () => toast.success(`${student.name} checked out`),
        onError: (e: Error) => toast.error(e.message || "Check-out failed"),
      },
    );
  };

  return (
    <ListItem
      leading={<PersonAvatar name={student.name} src={student.photo_url} className="size-10" />}
      title={student.name}
      subtitle={<StateSummary state={state} row={row} />}
      trailing={
        canMark ? (
          <div className="flex items-center gap-1.5">
            {state === "not_marked" ? (
              <Button
                size="sm"
                onClick={onCheckIn}
                disabled={busy}
                className="min-h-9"
                aria-label={`Check in ${student.name}`}
              >
                <LogIn className="size-4" /> In
              </Button>
            ) : state === "in_academy" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onCheckOut}
                disabled={busy}
                className="min-h-9"
                aria-label={`Check out ${student.name}`}
              >
                <LogOut className="size-4" /> Out
              </Button>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}

function StateSummary({ state, row }: { state: AttendanceState; row: TodayRow | undefined }) {
  const tone = attendanceStateTone[state];
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "info" ? "text-sky-600 dark:text-sky-400"
    : tone === "danger" ? "text-destructive"
    : "text-muted-foreground";

  if (state === "in_academy" && row?.check_in_at) {
    return (
      <span className={cn("inline-flex items-center gap-1", toneClass)}>
        <span className="size-1.5 rounded-full bg-current animate-pulse" aria-hidden />
        In since {format(new Date(row.check_in_at), "h:mm a")}
      </span>
    );
  }
  if (state === "checked_out" && row?.check_in_at && row?.check_out_at) {
    return (
      <span className={cn("inline-flex items-center gap-1", toneClass)}>
        <Clock className="size-3" />
        {format(new Date(row.check_in_at), "h:mm a")} – {format(new Date(row.check_out_at), "h:mm a")} · {formatDuration(row.duration_minutes)}
      </span>
    );
  }
  return <span className={toneClass}>{attendanceStateLabels[state]}</span>;
}
