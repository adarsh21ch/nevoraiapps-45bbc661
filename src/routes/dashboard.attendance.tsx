/**
 * AcademyOS V2 — Attendance module
 *
 * Speed-optimised UX. All summary values are DERIVED from the shared
 * attendance lifecycle (append-only history + attendance_today view).
 * No new writes, no new tables — every metric here reuses the existing
 * queries, realtime channel and timeline used by the dashboard, student app,
 * parent portal and reports.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, ChevronDown, CheckCircle2 } from "lucide-react";
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
  SearchBar,
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

type SessionFilter = "all" | "morning" | "evening" | "night";

/**
 * Classify a batch by its free-text timing into the session buckets used by
 * coaches. Mapping (per product spec):
 *   Morning → morning + both
 *   Evening → evening + both
 *   Night   → night   + personal coaching
 *   All     → everyone
 */
function batchMatchesSession(timing: string | null | undefined, session: SessionFilter): boolean {
  if (session === "all") return true;
  const t = (timing ?? "").toLowerCase();
  const isMorning = /morn/.test(t);
  const isEvening = /even/.test(t);
  const isNight = /night/.test(t);
  const isBoth = /both/.test(t);
  const isPersonal = /personal|coaching/.test(t);
  if (session === "morning") return isMorning || isBoth;
  if (session === "evening") return isEvening || isBoth;
  if (session === "night") return isNight || isPersonal;
  return true;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function AttendancePage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canMark = can("canMarkAttendance");

  const [session, setSession] = useState<SessionFilter>("all");
  const [query, setQuery] = useState("");

  const batchesQ = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const studentsQ = useQuery({ queryKey: qk.students(tenant.id), queryFn: () => fetchStudents(tenant.id) });
  const todayQ = useQuery({
    queryKey: attendanceKeys.today(tenant.id),
    queryFn: () => fetchAttendanceToday(tenant.id),
    staleTime: 15_000,
  });

  // Single realtime subscription — updates every card + list on this page,
  // and reuses the same channel that drives the dashboard KPIs.
  useAttendanceRealtime(tenant.id, qc);

  const activeBatches = useMemo(
    () => (batchesQ.data ?? []).filter((b: { active: boolean }) => b.active),
    [batchesQ.data],
  );

  // Batches inside the currently-selected session.
  const sessionBatches = useMemo(
    () => activeBatches.filter((b: { timing: string | null }) => batchMatchesSession(b.timing, session)),
    [activeBatches, session],
  );
  const sessionBatchIds = useMemo(() => new Set(sessionBatches.map((b: { id: string }) => b.id)), [sessionBatches]);
  const batchNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of activeBatches) m.set(b.id, b.name);
    return m;
  }, [activeBatches]);

  // Students in the selected session (all matching batches), then filter by search.
  const rosterStudents = useMemo(() => {
    const q = normalize(query);
    return (studentsQ.data ?? []).filter((s: {
      batch_id: string | null;
      status: string;
      name: string;
      player_id: string | null;
      phone: string | null;
      guardian_phone: string | null;
    }) => {
      if (s.status !== "active") return false;
      if (!s.batch_id || !sessionBatchIds.has(s.batch_id)) return false;
      if (!q) return true;
      const hay = [s.name, s.player_id, s.phone, s.guardian_phone].map(normalize).join(" ");
      return hay.includes(q);
    });
  }, [studentsQ.data, sessionBatchIds, query]);

  // Map: student_id → today's derived state row (from attendance_today view).
  const stateByStudent = useMemo(() => {
    const m = new Map<string, TodayRow>();
    for (const row of todayQ.data ?? []) {
      if (row.batch_id && sessionBatchIds.has(row.batch_id)) m.set(row.student_id, row as unknown as TodayRow);
    }
    return m;
  }, [todayQ.data, sessionBatchIds]);

  // KPIs. Everything derived — never stored.
  const kpis = useMemo(() => {
    let inAcademy = 0;
    let present = 0;
    let checkedOutToday = 0;
    for (const s of rosterStudents) {
      const row = stateByStudent.get(s.id);
      const state: AttendanceState = row?.current_state ?? "not_marked";
      if (state === "in_academy") { inAcademy++; present++; }
      else if (state === "checked_out") { checkedOutToday++; present++; }
    }
    const notArrived = rosterStudents.length - present;
    return { inAcademy, present, checkedOutToday, notArrived, total: rosterStudents.length };
  }, [rosterStudents, stateByStudent]);

  // Grouped roster — Waiting / Present / Checked Out.
  // Sorting: students with an upcoming action first (Present sorted by earliest
  // check-in so those closest to leaving surface first), then alphabetical.
  const groups = useMemo(() => {
    const waiting: typeof rosterStudents = [];
    const present: typeof rosterStudents = [];
    const done: typeof rosterStudents = [];
    for (const s of rosterStudents) {
      const state: AttendanceState = stateByStudent.get(s.id)?.current_state ?? "not_marked";
      if (state === "in_academy") present.push(s);
      else if (state === "checked_out") done.push(s);
      else waiting.push(s);
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    waiting.sort(byName);
    done.sort(byName);
    present.sort((a, b) => {
      const ta = stateByStudent.get(a.id)?.check_in_at ?? "";
      const tb = stateByStudent.get(b.id)?.check_in_at ?? "";
      return ta.localeCompare(tb) || byName(a, b);
    });
    return { waiting, present, done };
  }, [rosterStudents, stateByStudent]);

  const isLoading = batchesQ.isLoading || studentsQ.isLoading || todayQ.isLoading;
  const isError = batchesQ.isError || studentsQ.isError || todayQ.isError;

  return (
    <AppShell>
      {/* Compact header — one row, saves ~40px vs default TopBar. */}
      <div className="flex items-center justify-between gap-2 pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight leading-tight">Attendance</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{format(new Date(), "EEE, d MMM · h:mm a")}</p>
        </div>
        <LiveBadge state="live" />
      </div>

      {/* Sticky filter + search — always accessible while scrolling. */}
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur">
        <SegmentedControl
          value={session}
          onChange={(v) => setSession(v as SessionFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "morning", label: "Morning" },
            { value: "evening", label: "Evening" },
            { value: "night", label: "Night" },
          ]}
        />
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search name, player ID or mobile"
          className="mt-2"
        />
      </div>

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
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <div className="mt-3 space-y-2">
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
          {/* Compact KPI strip — 4-up so it fits above the fold. */}
          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Waiting" value={kpis.notArrived} tone="default" />
            <StatCard label="In Academy" value={kpis.inAcademy} tone="success" />
            <StatCard label="Checked Out" value={kpis.checkedOutToday} tone="default" />
            <StatCard label="Total" value={kpis.total} tone="default" />
          </div>

          {rosterStudents.length === 0 ? (
            <EmptyState
              title={query ? "No matches" : "No students in this session"}
              description={query ? "Try a different name, player ID or number." : "Change the session filter or add students to a batch."}
            />
          ) : (
            <div className="space-y-3">
              <RosterGroup
                title="Waiting"
                dot="bg-muted-foreground/60"
                count={groups.waiting.length}
                defaultOpen
                empty="Everyone has arrived."
                students={groups.waiting}
                batchNameById={batchNameById}
                stateByStudent={stateByStudent}
                canMark={canMark}
                tenantId={tenant.id}
              />
              <RosterGroup
                title="Present"
                dot="bg-emerald-500"
                count={groups.present.length}
                defaultOpen={false}
                empty="No players currently inside."
                students={groups.present}
                batchNameById={batchNameById}
                stateByStudent={stateByStudent}
                canMark={canMark}
                tenantId={tenant.id}
              />
              <RosterGroup
                title="Checked Out"
                dot="bg-sky-500"
                count={groups.done.length}
                defaultOpen={false}
                empty="No one has checked out yet."
                students={groups.done}
                batchNameById={batchNameById}
                stateByStudent={stateByStudent}
                canMark={canMark}
                tenantId={tenant.id}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

function RosterGroup({
  title,
  dot,
  count,
  defaultOpen,
  empty,
  students,
  batchNameById,
  stateByStudent,
  canMark,
  tenantId,
}: {
  title: string;
  dot: string;
  count: number;
  defaultOpen: boolean;
  empty: string;
  students: Array<{
    id: string;
    name: string;
    photo_url: string | null;
    player_id: string | null;
    batch_id: string | null;
  }>;
  batchNameById: Map<string, string>;
  stateByStudent: Map<string, TodayRow>;
  canMark: boolean;
  tenantId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-0.5 py-1.5"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className={cn("inline-block size-2 rounded-full", dot)} aria-hidden />
          <span className="text-sm font-semibold tracking-tight">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            {count}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open ? (
        count === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Card className="p-1 divide-y divide-border/60">
            {students.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                batchName={s.batch_id ? batchNameById.get(s.batch_id) ?? null : null}
                row={stateByStudent.get(s.id)}
                canMark={canMark}
                tenantId={tenantId}
              />
            ))}
          </Card>
        )
      ) : null}
    </section>
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
  batch_id: string | null;
}

interface TodayRow {
  mark_id: string;
  batch_id: string;
  current_state: AttendanceState;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
  visit_count?: number;
}

function StudentRow({
  student,
  batchName,
  row,
  canMark,
  tenantId,
}: {
  student: StudentLite;
  batchName: string | null;
  row: TodayRow | undefined;
  canMark: boolean;
  tenantId: string;
}) {
  const state: AttendanceState = row?.current_state ?? "not_marked";
  const checkIn = useCheckIn();
  const checkOut = useCheckOut(tenantId);
  const busy = checkIn.isPending || checkOut.isPending;

  const onCheckIn = () => {
    if (!student.batch_id) {
      toast.error("Assign this student to a batch first");
      return;
    }
    checkIn.mutate(
      { tenantId, batchId: student.batch_id, studentId: student.id },
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

  const idLine = [student.player_id, batchName].filter(Boolean).join(" · ");

  return (
    <ListItem
      leading={<PersonAvatar name={student.name} src={student.photo_url} className="size-10" />}
      title={student.name}
      subtitle={
        <div className="flex flex-col gap-0.5">
          {idLine ? <span className="text-xs text-muted-foreground">{idLine}</span> : null}
          <StateSummary state={state} row={row} />
        </div>
      }
      trailing={
        canMark ? (
          <div className="flex items-center gap-1.5">
            {state === "in_academy" ? (
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
            ) : (
              // not_marked OR checked_out — both allow a fresh check-in (multiple visits/day).
              <Button
                size="sm"
                variant={state === "checked_out" ? "outline" : "default"}
                onClick={onCheckIn}
                disabled={busy}
                className="min-h-9"
                aria-label={`Check in ${student.name}`}
              >
                <LogIn className="size-4" /> {state === "checked_out" ? "In again" : "In"}
              </Button>
            )}
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
      <span className={cn("inline-flex items-center gap-1 text-sm", toneClass)}>
        <span className="size-1.5 rounded-full bg-current animate-pulse" aria-hidden />
        In since {format(new Date(row.check_in_at), "h:mm a")}
      </span>
    );
  }
  if (state === "checked_out" && row?.check_in_at && row?.check_out_at) {
    const visits = row.visit_count ?? 1;
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm", toneClass)}>
        <Clock className="size-3" />
        {format(new Date(row.check_in_at), "h:mm a")} – {format(new Date(row.check_out_at), "h:mm a")} · {formatDuration(row.duration_minutes)}
        {visits > 1 ? ` · ${visits} visits` : ""}
      </span>
    );
  }
  return <span className={cn("text-sm", toneClass)}>{attendanceStateLabels[state]}</span>;
}
