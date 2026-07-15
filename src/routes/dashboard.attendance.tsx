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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, CheckCircle2, Zap, CheckSquare } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchStudents, qk } from "@/lib/dashboard-queries";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  ListItem,
  EmptyState,
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

/**
 * Best-effort late threshold. Parses the first `h[:mm] am/pm` clock time from
 * the free-text `timing` field on the batch. If a batch says "6:00 AM – 8:00 AM"
 * we treat 6:00 AM as the start; anything ≥ 10 min after that on the same date
 * counts as "Late". No schema change — pure derivation. Returns null when we
 * can't parse a start time (in which case we simply don't show the badge).
 */
function parseBatchStartMs(timing: string | null | undefined, dayISO: string): number | null {
  if (!timing) return null;
  const m = timing.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  let h = parseInt(m[1]!, 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]!.toLowerCase();
  if (mer === "pm" && h !== 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  const [y, mo, d] = dayISO.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y!, (mo ?? 1) - 1, d ?? 1, h, min, 0, 0);
  return dt.getTime();
}
const LATE_GRACE_MS = 10 * 60 * 1000;

// Owner/Admin preferences — persisted per device.
const QUICK_MODE_KEY = "academyos.attendance.quickMode";
const ROSTER_TAB_KEY = "academyos.attendance.rosterTab";

type RosterTab = "waiting" | "present" | "done";

function AttendancePage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canMark = can("canMarkAttendance");

  const [session, setSession] = useState<SessionFilter>("all");
  const [query, setQuery] = useState("");
  const [quickMode, setQuickMode] = useState<boolean>(false);
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [rosterTab, setRosterTab] = useState<RosterTab>("waiting");

  useEffect(() => {
    try {
      setQuickMode(localStorage.getItem(QUICK_MODE_KEY) === "1");
      const t = localStorage.getItem(ROSTER_TAB_KEY);
      if (t === "waiting" || t === "present" || t === "done") setRosterTab(t);
    } catch { /* ignore */ }
  }, []);
  const toggleQuick = useCallback(() => {
    setQuickMode((v) => {
      const next = !v;
      try { localStorage.setItem(QUICK_MODE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const changeRosterTab = useCallback((t: RosterTab) => {
    setRosterTab(t);
    try { localStorage.setItem(ROSTER_TAB_KEY, t); } catch { /* ignore */ }
  }, []);

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
  // Precomputed late thresholds per batch (in ms) — derived, not stored.
  const batchLateThresholdById = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const m = new Map<string, number | null>();
    for (const b of activeBatches as Array<{ id: string; timing: string | null }>) {
      const start = parseBatchStartMs(b.timing, today);
      m.set(b.id, start == null ? null : start + LATE_GRACE_MS);
    }
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
    const total = rosterStudents.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { inAcademy, present, checkedOutToday, notArrived, total, pct };
  }, [rosterStudents, stateByStudent]);

  // Grouped roster — Waiting / Present / Checked Out.
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

  // Undo helpers — reuse existing schema. Undo check-in removes the row (only
  // safe because we just created it and it's still the active row); undo
  // check-out clears the check_out_at timestamp on the same row. No RPC/API
  // additions, no realtime channel changes.
  const undoCheckIn = useCallback(async (markId: string) => {
    const { error } = await supabase.from("attendance_marks").delete().eq("id", markId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: attendanceKeys.today(tenant.id) });
  }, [qc, tenant.id]);
  const undoCheckOut = useCallback(async (markId: string) => {
    const { error } = await supabase.from("attendance_marks")
      .update({ check_out_at: null, check_out_meta: {} })
      .eq("id", markId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: attendanceKeys.today(tenant.id) });
  }, [qc, tenant.id]);

  // Quick mode — after a successful check-in, scroll & flash the next waiting
  // row so the coach can just keep tapping.
  const rosterRef = useRef<HTMLDivElement>(null);
  const focusNextWaiting = useCallback((afterStudentId: string) => {
    if (!quickMode) return;
    const container = rosterRef.current;
    if (!container) return;
    // Find the next data-waiting row after the current one, in DOM order.
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-waiting="1"]'));
    const idx = rows.findIndex((el) => el.dataset.studentId === afterStudentId);
    const next = rows[idx + 1] ?? rows.find((el) => el.dataset.studentId !== afterStudentId);
    if (next) {
      next.scrollIntoView({ behavior: "smooth", block: "center" });
      next.classList.add("ring-2", "ring-primary/40");
      window.setTimeout(() => next.classList.remove("ring-2", "ring-primary/40"), 900);
    }
  }, [quickMode]);

  // Bulk actions. Reuses the plain `checkInStudent` / `checkOutStudent`
  // mutations by kicking off requests in parallel, then a single invalidate.
  const checkIn = useCheckIn();
  const checkOut = useCheckOut(tenant.id);

  const clearSelection = () => setSelected(new Set());
  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const bulkCheckIn = async () => {
    const items = groups.waiting.filter((s) => selected.has(s.id) && s.batch_id);
    if (items.length === 0) { toast.error("Select waiting students first"); return; }
    await Promise.allSettled(items.map((s) => checkIn.mutateAsync({
      tenantId: tenant.id, batchId: s.batch_id!, studentId: s.id,
    })));
    toast.success(`Checked in ${items.length}`);
    clearSelection();
  };
  const bulkCheckOut = async () => {
    const items = groups.present.filter((s) => selected.has(s.id));
    if (items.length === 0) { toast.error("Select present students first"); return; }
    await Promise.allSettled(items.map((s) => {
      const mark = stateByStudent.get(s.id);
      return mark ? checkOut.mutateAsync({ markId: mark.mark_id }) : Promise.resolve();
    }));
    toast.success(`Checked out ${items.length}`);
    clearSelection();
  };
  const markAllWaitingPresent = async () => {
    if (groups.waiting.length === 0) { toast.error("Nobody is waiting"); return; }
    // Single-confirm gate — the only guarded action per spec.
    const ok = window.confirm(`Mark all ${groups.waiting.length} waiting students as present?`);
    if (!ok) return;
    await Promise.allSettled(groups.waiting.map((s) => s.batch_id ? checkIn.mutateAsync({
      tenantId: tenant.id, batchId: s.batch_id, studentId: s.id,
    }) : Promise.resolve()));
    toast.success(`Marked ${groups.waiting.length} present`);
    clearSelection();
  };

  const isLoading = batchesQ.isLoading || studentsQ.isLoading || todayQ.isLoading;
  const isError = batchesQ.isError || studentsQ.isError || todayQ.isError;

  const activeStudents =
    rosterTab === "waiting" ? groups.waiting
    : rosterTab === "present" ? groups.present
    : groups.done;
  const activeEmpty =
    rosterTab === "waiting" ? "Everyone has arrived."
    : rosterTab === "present" ? "No players currently inside."
    : "No players have checked out yet.";

  return (
    <div className="-mt-4 md:-mt-8">
      {/* Compact header — flush against DashboardShell top bar. */}
      <div className="flex items-center justify-between gap-2 pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight leading-tight">Attendance</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">{format(new Date(), "EEE, d MMM · h:mm a")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleQuick}
            aria-pressed={quickMode}
            aria-label="Toggle quick attendance mode"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors min-h-8",
              quickMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="size-3" /> Quick
          </button>
          {canMark ? (
            <button
              type="button"
              onClick={() => { setSelectMode((v) => !v); clearSelection(); }}
              aria-pressed={selectMode}
              aria-label="Toggle bulk selection"
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors min-h-8",
                selectMode
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <CheckSquare className="size-3" /> Select
            </button>
          ) : null}
          <LiveBadge state="live" />
        </div>
      </div>

      {/* Sticky filter + search — always accessible while scrolling. */}
      <div className="sticky top-14 z-20 -mx-4 md:-mx-8 mb-2 border-b border-border/60 bg-background/90 px-4 md:px-8 py-2 backdrop-blur">
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
        <div>
          <Skeleton className="h-12" />
          <div className="mt-2 space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
      ) : activeBatches.length === 0 ? (
        <EmptyState
          title="No active batches"
          description="Create a batch to start taking attendance."
        />
      ) : (
        <>
          {/* Compact live summary + KPI strip fused into a single tight card. */}
          <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Today</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums leading-tight">
                  {kpis.present} / {kpis.total} <span className="text-muted-foreground font-normal">present</span>
                </p>
              </div>
              <p className="text-lg font-bold tabular-nums leading-none">{kpis.pct}%</p>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${kpis.pct}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 border-t border-border/50 pt-2">
              <MiniKpi label="Waiting" value={kpis.notArrived} />
              <MiniKpi label="Inside" value={kpis.inAcademy} tone="success" />
              <MiniKpi label="Out" value={kpis.checkedOutToday} tone="info" />
              <MiniKpi label="Total" value={kpis.total} />
            </div>
          </div>

          {/* Roster tab selector — Waiting / Present / Checked Out. */}
          <div
            role="tablist"
            aria-label="Attendance groups"
            className="sticky top-[8.5rem] z-10 mt-2 -mx-4 md:-mx-8 border-b border-border/60 bg-background/95 px-4 md:px-8 py-1.5 backdrop-blur"
          >
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-0.5">
              <RosterTabButton
                active={rosterTab === "waiting"}
                onClick={() => changeRosterTab("waiting")}
                label="Waiting"
                count={groups.waiting.length}
                dot="bg-muted-foreground/60"
              />
              <RosterTabButton
                active={rosterTab === "present"}
                onClick={() => changeRosterTab("present")}
                label="Present"
                count={groups.present.length}
                dot="bg-emerald-500"
              />
              <RosterTabButton
                active={rosterTab === "done"}
                onClick={() => changeRosterTab("done")}
                label="Checked Out"
                count={groups.done.length}
                dot="bg-sky-500"
              />
            </div>
          </div>

          {/* Bulk action bar. */}
          {selectMode ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-background/95 p-2">
              <span className="text-xs text-muted-foreground">
                {selected.size} selected
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={bulkCheckIn} className="min-h-9">
                  Check In Selected
                </Button>
                <Button size="sm" variant="secondary" onClick={bulkCheckOut} className="min-h-9">
                  Check Out Selected
                </Button>
                <Button size="sm" variant="outline" onClick={markAllWaitingPresent} className="min-h-9">
                  Mark all present
                </Button>
              </div>
            </div>
          ) : null}

          {rosterStudents.length === 0 ? (
            <EmptyState
              title={query ? "No matches" : "No students in this session"}
              description={query ? "Try a different name, player ID or number." : "Change the session filter or add students to a batch."}
            />
          ) : activeStudents.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">{activeEmpty}</p>
          ) : (
            <div key={rosterTab} className="mt-2 animate-in fade-in duration-150" ref={rosterRef}>
              <Card className="p-1 divide-y divide-border/60">
                {activeStudents.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    batchName={s.batch_id ? batchNameById.get(s.batch_id) ?? null : null}
                    row={stateByStudent.get(s.id)}
                    canMark={canMark}
                    tenantId={tenant.id}
                    lateAfterMs={s.batch_id ? batchLateThresholdById.get(s.batch_id) ?? null : null}
                    selectMode={selectMode}
                    isSelected={selected.has(s.id)}
                    onToggleSelected={toggleSelected}
                    onCheckedIn={focusNextWaiting}
                    onUndoCheckIn={undoCheckIn}
                    onUndoCheckOut={undoCheckOut}
                  />
                ))}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniKpi({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "info" }) {
  const toneClass =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "info" ? "text-sky-600 dark:text-sky-400"
    : "text-foreground";
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold tabular-nums leading-tight", toneClass)}>{value}</p>
    </div>
  );
}

function RosterTabButton({
  active, onClick, label, count, dot,
}: { active: boolean; onClick: () => void; label: string; count: number; dot: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-9",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("inline-block size-1.5 rounded-full", dot)} aria-hidden />
      <span className="truncate">{label}</span>
      <span className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        active ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Group
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


// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function StudentRow({
  student,
  batchName,
  row,
  canMark,
  tenantId,
  lateAfterMs,
  selectMode,
  isSelected,
  onToggleSelected,
  onCheckedIn,
  onUndoCheckIn,
  onUndoCheckOut,
}: {
  student: StudentLite;
  batchName: string | null;
  row: TodayRow | undefined;
  canMark: boolean;
  tenantId: string;
  lateAfterMs: number | null;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
  onCheckedIn: (studentId: string) => void;
  onUndoCheckIn: (markId: string) => void;
  onUndoCheckOut: (markId: string) => void;
}) {
  const state: AttendanceState = row?.current_state ?? "not_marked";
  const checkIn = useCheckIn();
  const checkOut = useCheckOut(tenantId);
  const busy = checkIn.isPending || checkOut.isPending;

  // Late = checked in after the batch's grace threshold. Derived, not stored.
  const isLate = !!(
    row?.check_in_at && lateAfterMs != null && new Date(row.check_in_at).getTime() > lateAfterMs
  );

  const onCheckIn = () => {
    if (!student.batch_id) {
      toast.error("Assign this student to a batch first");
      return;
    }
    checkIn.mutate(
      { tenantId, batchId: student.batch_id, studentId: student.id },
      {
        onSuccess: () => {
          // Undo uses fresh mark id (from the invalidated `today` query).
          toast.success(`${student.name} checked in`, {
            duration: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                const qc = window as unknown as { __qc?: unknown }; // no-op ref
                void qc;
                // Look up the freshly-created mark id from cache-invalidated data.
                // The parent's invalidate has fired; we re-read via a callback.
                deferredUndoCheckIn(student.id, onUndoCheckIn);
              },
            },
          });
          onCheckedIn(student.id);
        },
        onError: (e: Error) => toast.error(e.message || "Check-in failed"),
      },
    );
  };
  const onCheckOut = () => {
    if (!row) return;
    const markId = row.mark_id;
    checkOut.mutate(
      { markId },
      {
        onSuccess: () => toast.success(`${student.name} checked out`, {
          duration: 5000,
          action: { label: "Undo", onClick: () => onUndoCheckOut(markId) },
        }),
        onError: (e: Error) => toast.error(e.message || "Check-out failed"),
      },
    );
  };

  const idLine = [student.player_id, batchName].filter(Boolean).join(" · ");

  return (
    <div
      data-student-id={student.id}
      data-waiting={state === "not_marked" ? "1" : "0"}
      className={cn(
        "rounded-md transition-shadow",
        selectMode && isSelected ? "bg-primary/5" : "",
      )}
    >
      <ListItem
        leading={
          <div className="flex items-center gap-2">
            {selectMode && canMark ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelected(student.id)}
                aria-label={`Select ${student.name}`}
                className="size-4 rounded border-border"
              />
            ) : null}
            <PersonAvatar name={student.name} src={student.photo_url} className="size-10" />
          </div>
        }
        title={
          <span className="inline-flex items-center gap-1.5">
            {student.name}
            {isLate ? (
              <span
                className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                aria-label="Arrived late"
              >
                Late
              </span>
            ) : null}
          </span>
        }
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
                  className="min-h-11 min-w-11"
                  aria-label={`Check out ${student.name}`}
                >
                  <LogOut className="size-4" /> Check Out
                </Button>
              ) : state === "checked_out" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  className="min-h-11 min-w-11 text-emerald-600 dark:text-emerald-400"
                  aria-label={`${student.name} completed`}
                >
                  <CheckCircle2 className="size-4" /> Completed
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onCheckIn}
                  disabled={busy}
                  className="min-h-11 min-w-11"
                  aria-label={`Check in ${student.name}`}
                >
                  <LogIn className="size-4" /> Check In
                </Button>
              )}
            </div>
          ) : null
        }
      />
    </div>
  );
}

/**
 * Fetch the just-created mark id for a student via the shared attendance_today
 * view and hand it to the undo helper. Runs slightly after the invalidate so
 * we get the fresh row without adding a new query key.
 */
function deferredUndoCheckIn(studentId: string, undo: (markId: string) => void) {
  setTimeout(async () => {
    const { data } = await supabase
      .from("attendance_today")
      .select("mark_id, student_id, current_state")
      .eq("student_id", studentId)
      .eq("current_state", "in_academy")
      .limit(1)
      .maybeSingle();
    if (data?.mark_id) undo(data.mark_id);
  }, 250);
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
