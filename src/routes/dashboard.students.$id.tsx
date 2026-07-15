import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DangerZone } from "@/components/shared/DangerZone";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { removeStudent } from "@/lib/removal";
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admissionTimelineQuery } from "@/lib/admissions";
import { AdmissionTimelineList } from "@/components/dashboard/AdmissionChecklist";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Share2,
  Pencil,
  ClipboardCheck,
  Swords,
  StickyNote,
  Trophy,
  Calendar,
  Cake,
  Activity,
  Sparkles,
  Loader2,
  UserRound,
  Plus,
  Trash2,
  Search,
  BadgeCheck,
  FileText,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { format, differenceInYears, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchStudent } from "@/lib/dashboard-queries";
import {
  fetchAthleteByStudent,
  fetchPlayerCareer,
  fetchRecentMatches,
  fetchAllRemarks,
  fetchPlayerAttendanceSummary,
  createRemark,
  deleteRemark,
  playerKeys,
} from "@/lib/player-profile";
import { fetchAttendanceToday, attendanceKeys } from "@/lib/attendance/queries";
import { formatDuration, attendanceStateLabels } from "@/lib/attendance/constants";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { Card } from "@/components/ds/Card";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { SearchBar } from "@/components/ds/SearchBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const StudentProfilePanel = lazy(() =>
  import("@/components/dashboard/StudentProfilePanel").then((m) => ({
    default: m.StudentProfilePanel,
  })),
);

export const Route = createFileRoute("/dashboard/students/$id")({
  head: () => ({
    meta: [{ title: "Player · Academy" }, { name: "robots", content: "noindex" }],
  }),
  component: PlayerProfileRoute,
});

type TabKey = "overview" | "timeline" | "performance" | "attendance" | "matches" | "more";

function PlayerProfileRoute() {
  const { id } = Route.useParams();
  const { tenant } = useDashboard();
  const [tab, setTab] = useState<TabKey>("overview");
  const [editing, setEditing] = useState(false);

  const studentQ = useQuery({
    queryKey: ["d", "student", id],
    queryFn: () => fetchStudent(id),
  });

  const athleteQ = useQuery({
    enabled: !!studentQ.data,
    queryKey: playerKeys.athlete(tenant.id, id),
    queryFn: () => fetchAthleteByStudent(tenant.id, id),
  });

  // Live status for this player — reuses the frozen attendance_today view.
  const todayQ = useQuery({
    queryKey: attendanceKeys.today(tenant.id),
    queryFn: () => fetchAttendanceToday(tenant.id),
    staleTime: 15_000,
  });

  const student = studentQ.data as
    | (Record<string, unknown> & {
        id: string;
        name: string;
        photo_url: string | null;
        player_id: string | null;
        dob: string | null;
        joined_at: string | null;
        phone: string | null;
        guardian_phone: string | null;
        status: string | null;
        batches: { name: string } | null;
      })
    | null
    | undefined;

  const todayRow = todayQ.data?.find((r) => r.student_id === id) ?? null;
  const liveState = todayRow?.current_state ?? "not_marked";

  if (studentQ.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mb-2" />
        Loading player…
      </div>
    );
  }
  if (!student) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <p className="text-sm text-muted-foreground">Player not found.</p>
        <Link
          to="/dashboard/students"
          className="text-sm mt-3 inline-block"
          style={{ color: "var(--brand)" }}
        >
          Back to Players
        </Link>
      </div>
    );
  }

  const athlete = athleteQ.data ?? null;
  const cricket = (athlete?.cricket ?? null) as
    | (Record<string, unknown> & {
        role?: string | null;
        batting_style?: string | null;
        bowling_style?: string | null;
      })
    | null;

  const age = student.dob ? differenceInYears(new Date(), new Date(student.dob)) : null;
  const roleLabel =
    (cricket?.role as string | undefined)?.replace(/_/g, " ") ??
    (athlete?.primary_sport as string | undefined) ??
    "Player";
  const handLabel =
    (cricket?.batting_style as string | undefined)?.replace("_hand", "-hand") ??
    (athlete?.dominant_hand as string | undefined) ??
    null;

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/dashboard/students/${id}` : "";
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: student.name, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="space-y-4 pb-8 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Players
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            aria-label="Share"
            className="grid place-items-center size-9 rounded-full hover:bg-accent transition-colors"
          >
            <Share2 className="size-4" />
          </button>
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit player"
            className="grid place-items-center size-9 rounded-full hover:bg-accent transition-colors"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>

      {/* Header card */}
      <Card className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          <PersonAvatar
            name={student.name}
            src={student.photo_url ?? undefined}
            className="size-20 md:size-24 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
                {student.name}
              </h1>
              <StatusPill state={liveState} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {student.player_id ? <span>#{student.player_id}</span> : null}
              {age != null ? <span>{age} yrs</span> : null}
              {roleLabel ? <span className="capitalize">{roleLabel}</span> : null}
              {handLabel ? <span className="capitalize">{handLabel}</span> : null}
              {student.batches?.name ? <span>{student.batches.name}</span> : null}
            </div>
            {student.joined_at ? (
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" /> Joined{" "}
                {format(new Date(student.joined_at), "MMM d, yyyy")}
              </div>
            ) : null}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
          <QuickAction icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
          <QuickAction
            icon={ClipboardCheck}
            label="Attendance"
            onClick={() => setTab("attendance")}
          />
          <QuickAction icon={Swords} label="Matches" onClick={() => setTab("matches")} />
          <QuickAction icon={StickyNote} label="Notes" onClick={() => setTab("overview")} />
          <QuickAction
            icon={Phone}
            label="Call"
            disabled={!student.guardian_phone && !student.phone}
            href={
              student.guardian_phone
                ? `tel:${student.guardian_phone}`
                : student.phone
                  ? `tel:${student.phone}`
                  : undefined
            }
          />
          <QuickAction icon={Share2} label="Share" onClick={handleShare} />
        </div>
      </Card>

      {/* Quick stats */}
      <PlayerQuickStats
        tenantId={tenant.id}
        studentId={id}
        athleteId={(athlete?.id as string | undefined) ?? null}
        joinedAt={student.joined_at}
      />

      {/* Tabs */}
      <SegmentedControl<TabKey>
        value={tab}
        onChange={setTab}
        ariaLabel="Player sections"
        options={[
          { value: "overview", label: "Overview" },
          { value: "timeline", label: "Timeline" },
          { value: "performance", label: "Performance" },
          { value: "attendance", label: "Attendance" },
          { value: "matches", label: "Matches" },
          { value: "more", label: "More" },
        ]}
      />

      <div className="pt-1">
        {tab === "overview" && (
          <OverviewTab
            tenantId={tenant.id}
            studentId={id}
            athleteId={(athlete?.id as string | undefined) ?? null}
            student={student}
          />
        )}
        {tab === "timeline" && (
          <TimelineTab
            tenantId={tenant.id}
            studentId={id}
            athleteId={(athlete?.id as string | undefined) ?? null}
          />
        )}
        {tab === "performance" && (
          <PerformanceTab athleteId={(athlete?.id as string | undefined) ?? null} />
        )}
        {tab === "attendance" && (
          <AttendanceTab tenantId={tenant.id} studentId={id} joinedAt={student.joined_at} />
        )}
        {tab === "matches" && (
          <MatchesTab athleteId={(athlete?.id as string | undefined) ?? null} />
        )}
        {tab === "more" && (
          <MoreTab
            student={student as unknown as Parameters<typeof MoreTab>[0]["student"]}
            studentId={id}
            studentName={student.name}
          />
        )}
      </div>

      {/* Edit sheet */}
      {editing ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/40 p-0 sm:p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur border-b border-border px-4 h-12">
              <div className="text-sm font-semibold">Edit player</div>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            </div>
            <div className="p-4">
              <Suspense
                fallback={
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin inline mr-2" />
                    Loading editor…
                  </div>
                }
              >
                <StudentProfilePanel studentId={id} />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------ small building blocks ------------------------ */

function StatusPill({ state }: { state: string }) {
  const tone: Record<string, string> = {
    in_academy: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    checked_out: "bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25",
    absent: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25",
    not_marked: "bg-muted text-muted-foreground border-border",
  };
  const label = attendanceStateLabels[state as keyof typeof attendanceStateLabels] ?? "Unknown";
  const dot: Record<string, string> = {
    in_academy: "bg-emerald-500 animate-pulse",
    checked_out: "bg-sky-500",
    absent: "bg-rose-500",
    not_marked: "bg-muted-foreground/60",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        tone[state] ?? tone.not_marked,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot[state] ?? dot.not_marked)} />
      {label}
    </span>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 h-16 rounded-xl border border-border bg-card transition-colors",
        !disabled && "hover:bg-accent active:scale-[0.98]",
        disabled && "opacity-40",
      )}
    >
      <span style={{ color: disabled ? undefined : "var(--brand)" }}>
        <Icon className="size-4" />
      </span>
      <span className="text-[10.5px] font-medium">{label}</span>
    </div>
  );
  if (disabled) return <div>{inner}</div>;
  if (href) {
    return (
      <a href={href} className="focus:outline-none">
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className="focus:outline-none w-full">
      {inner}
    </button>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {hint ? <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div> : null}
    </div>
  );
}

/* ------------------------ quick stats ------------------------ */

function PlayerQuickStats({
  tenantId,
  studentId,
  athleteId,
  joinedAt,
}: {
  tenantId: string;
  studentId: string;
  athleteId: string | null;
  joinedAt: string | null;
}) {
  const summaryQ = useQuery({
    queryKey: ["player", "att-summary", tenantId, studentId],
    queryFn: () => fetchPlayerAttendanceSummary(tenantId, studentId),
    staleTime: 60_000,
  });
  const careerQ = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.career(athleteId ?? "none"),
    queryFn: () => fetchPlayerCareer(athleteId!),
    staleTime: 60_000,
  });

  const attendancePct = useMemo(() => {
    if (!summaryQ.data || !joinedAt) return null;
    const days = Math.max(1, differenceInYears(new Date(), new Date(joinedAt)) * 365 + 30);
    const dayCount = Math.min(days, 365);
    if (dayCount === 0) return null;
    return Math.min(100, Math.round((summaryQ.data.presentDays / dayCount) * 100));
  }, [summaryQ.data, joinedAt]);

  const career = careerQ.data ?? null;
  const span = joinedAt ? `${differenceInYears(new Date(), new Date(joinedAt))}y` : "—";

  return (
    <div className="grid grid-cols-4 gap-2">
      <KpiTile label="Attendance" value={attendancePct != null ? `${attendancePct}%` : "—"} />
      <KpiTile label="Matches" value={career?.matches ?? 0} />
      <KpiTile label="Runs" value={career?.runs ?? 0} />
      <KpiTile label="Wickets" value={career?.wickets ?? 0} />
      <KpiTile
        label="Strike Rate"
        value={career?.strike_rate != null ? Number(career.strike_rate).toFixed(1) : "—"}
      />
      <KpiTile
        label="Bat Avg"
        value={career?.average != null ? Number(career.average).toFixed(1) : "—"}
      />
      <KpiTile
        label="Bowl Avg"
        value={career?.bowling_average != null ? Number(career.bowling_average).toFixed(1) : "—"}
      />
      <KpiTile label="Career" value={span} />
    </div>
  );
}

/* ------------------------ Overview ------------------------ */

function OverviewTab({
  tenantId,
  studentId,
  athleteId,
  student,
}: {
  tenantId: string;
  studentId: string;
  athleteId: string | null;
  student: { dob: string | null; name: string };
}) {
  const summaryQ = useQuery({
    queryKey: ["player", "att-summary", tenantId, studentId],
    queryFn: () => fetchPlayerAttendanceSummary(tenantId, studentId),
  });
  const remarksQ = useQuery({
    queryKey: playerKeys.remarks(studentId),
    queryFn: () => fetchAllRemarks(studentId),
  });
  const matchesQ = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.matches(athleteId ?? "none"),
    queryFn: () => fetchRecentMatches(athleteId!, 1),
  });

  const nextBirthday = useMemo(() => {
    if (!student.dob) return null;
    const dob = new Date(student.dob);
    const today = new Date();
    const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const days = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: next, days };
  }, [student.dob]);

  const lastVisit = summaryQ.data?.lastVisit;
  const lastMatch = matchesQ.data?.[0];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-4">
        <SectionHeader icon={ClipboardCheck} title="Attendance" />
        {summaryQ.isLoading ? (
          <Skel />
        ) : (
          <div className="text-sm">
            <div className="text-2xl font-semibold">{summaryQ.data?.presentDays ?? 0}</div>
            <div className="text-xs text-muted-foreground">
              Present days · {formatDuration(summaryQ.data?.totalMinutes ?? 0)} trained
            </div>
            {lastVisit ? (
              <div className="text-[11px] text-muted-foreground mt-2">
                Last seen{" "}
                {lastVisit.check_in_at
                  ? formatDistanceToNow(new Date(lastVisit.check_in_at), { addSuffix: true })
                  : "—"}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <SectionHeader icon={Swords} title="Latest Match" />
        {matchesQ.isLoading ? (
          <Skel />
        ) : lastMatch?.match ? (
          <div className="text-sm">
            <div className="font-medium truncate">{lastMatch.match.ground_name ?? "Match"}</div>
            <div className="text-[11px] text-muted-foreground">
              {lastMatch.match.scheduled_date
                ? format(new Date(lastMatch.match.scheduled_date), "MMM d, yyyy")
                : ""}
              {lastMatch.match.match_format ? ` · ${lastMatch.match.match_format}` : ""}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {lastMatch.is_captain ? <ChipPill>Captain</ChipPill> : null}
              {lastMatch.is_keeper ? <ChipPill>Keeper</ChipPill> : null}
              {lastMatch.is_player_of_match ? (
                <ChipPill tone="gold">Player of Match</ChipPill>
              ) : null}
              {lastMatch.match.result ? (
                <ChipPill tone="muted">{lastMatch.match.result}</ChipPill>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyLine text="No matches yet." />
        )}
      </Card>

      <Card className="p-4 sm:col-span-2">
        <div className="flex items-center justify-between">
          <SectionHeader icon={StickyNote} title="Coach Notes" />
          <span className="text-[11px] text-muted-foreground">{remarksQ.data?.length ?? 0}</span>
        </div>
        <CoachNotes tenantId={tenantId} studentId={studentId} authorName={student.name} />
      </Card>

      <AdmissionTimelineCard tenantId={tenantId} studentId={studentId} />

      <Card className="p-4">
        <SectionHeader icon={Activity} title="Current Form" />
        <FormStrip athleteId={athleteId} />
      </Card>

      <Card className="p-4">
        <SectionHeader icon={Cake} title="Next Birthday" />
        {nextBirthday ? (
          <div className="text-sm">
            <div className="font-medium">{format(nextBirthday.date, "MMM d")}</div>
            <div className="text-[11px] text-muted-foreground">
              {nextBirthday.days === 0 ? "Today 🎉" : `${nextBirthday.days} days away`}
            </div>
          </div>
        ) : (
          <EmptyLine text="No DOB on file." />
        )}
      </Card>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      <Icon className="size-3.5" />
      {title}
    </div>
  );
}

function AdmissionTimelineCard({ tenantId, studentId }: { tenantId: string; studentId: string }) {
  const { data = [] } = useQuery(admissionTimelineQuery({ tenantId, studentId }));
  if (!data.length) return null;
  return (
    <Card className="p-4 sm:col-span-2">
      <SectionHeader icon={ClipboardCheck} title="Admission Timeline" />
      <div className="mt-2">
        <AdmissionTimelineList events={data} />
      </div>
    </Card>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground">{text}</div>;
}

function Skel() {
  return <div className="h-10 rounded-md bg-muted/60 animate-pulse" />;
}

function ChipPill({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "gold" | "muted";
}) {
  const cls: Record<string, string> = {
    brand: "bg-[color:color-mix(in_oklab,var(--brand)_12%,transparent)] text-[color:var(--brand)]",
    gold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        cls[tone],
      )}
    >
      {children}
    </span>
  );
}

function FormStrip({ athleteId }: { athleteId: string | null }) {
  const q = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.matches(athleteId ?? "none"),
    queryFn: () => fetchRecentMatches(athleteId!, 6),
  });
  if (!athleteId) return <EmptyLine text="Not linked to Match Center yet." />;
  if (q.isLoading) return <Skel />;
  const rows = q.data ?? [];
  if (rows.length === 0) return <EmptyLine text="No recent matches." />;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {rows.map((r) => {
        const tone = r.is_player_of_match
          ? "bg-amber-500 text-white"
          : r.is_captain
            ? "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground";
        const label = r.is_player_of_match ? "MoM" : r.is_captain ? "C" : r.is_keeper ? "K" : "•";
        return (
          <div
            key={r.id}
            className={cn(
              "h-8 min-w-[28px] px-1.5 grid place-items-center rounded-md text-[10.5px] font-semibold",
              tone,
            )}
            title={r.match?.scheduled_date ?? ""}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------ Coach Notes ------------------------ */

function CoachNotes({
  tenantId,
  studentId,
  authorName,
}: {
  tenantId: string;
  studentId: string;
  authorName: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);

  const list = useQuery({
    queryKey: playerKeys.remarks(studentId),
    queryFn: () => fetchAllRemarks(studentId),
  });

  const add = useMutation({
    mutationFn: () =>
      createRemark({
        tenant_id: tenantId,
        student_id: studentId,
        remark: text.trim(),
        author_name: authorName,
        visible_to_parents: visible,
      }),
    onSuccess: () => {
      setText("");
      setVisible(false);
      qc.invalidateQueries({ queryKey: playerKeys.remarks(studentId) });
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: deleteRemark,
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.remarks(studentId) }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border p-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a coach note…"
          rows={2}
          className="border-0 focus-visible:ring-0 shadow-none resize-none px-2"
        />
        <div className="flex items-center justify-between px-1 pb-0.5">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="size-3.5 accent-current"
            />
            Visible to parent
          </label>
          <Button
            size="sm"
            disabled={!text.trim() || add.isPending}
            onClick={() => add.mutate()}
            className="h-8"
          >
            {add.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}{" "}
            Add
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <Skel />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyLine text="No coach notes yet." />
      ) : (
        <ul className="divide-y divide-border">
          {(list.data ?? []).map((r) => (
            <li key={r.id} className="py-2.5 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm whitespace-pre-wrap break-words">{r.remark}</div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span>{r.author_name ?? "Coach"}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                  {r.visible_to_parents ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                      <BadgeCheck className="size-3" /> Parent
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                aria-label="Delete note"
                onClick={() => del.mutate(r.id)}
                className="grid place-items-center size-7 rounded-full hover:bg-accent text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------ Timeline ------------------------ */

type TimelineItem = {
  id: string;
  kind: "check_in" | "check_out" | "note" | "match" | "payment";
  at: string;
  title: string;
  meta?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "info" | "muted";
};

function TimelineTab({
  tenantId,
  studentId,
  athleteId,
}: {
  tenantId: string;
  studentId: string;
  athleteId: string | null;
}) {
  const [q, setQ] = useState("");
  const visitsQ = useQuery({
    queryKey: ["player", "att-summary", tenantId, studentId],
    queryFn: () => fetchPlayerAttendanceSummary(tenantId, studentId),
  });
  const remarksQ = useQuery({
    queryKey: playerKeys.remarks(studentId),
    queryFn: () => fetchAllRemarks(studentId),
  });
  const matchesQ = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.matches(athleteId ?? "none"),
    queryFn: () => fetchRecentMatches(athleteId!, 20),
  });
  const paymentsQ = useQuery({
    queryKey: ["player", "payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, period, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (const v of visitsQ.data?.visits ?? []) {
      if (v.check_in_at) {
        out.push({
          id: `in-${v.mark_id}`,
          kind: "check_in",
          at: v.check_in_at,
          title: v.visit_type ? `Checked in · ${v.visit_type}` : "Checked in",
          meta: v.note ?? undefined,
          icon: ClipboardCheck,
          tone: "success",
        });
      }
      if (v.check_out_at) {
        out.push({
          id: `out-${v.mark_id}`,
          kind: "check_out",
          at: v.check_out_at,
          title: "Checked out",
          meta: v.duration_minutes ? formatDuration(v.duration_minutes) : undefined,
          icon: ClipboardCheck,
          tone: "info",
        });
      }
    }
    for (const r of remarksQ.data ?? []) {
      out.push({
        id: `note-${r.id}`,
        kind: "note",
        at: r.created_at,
        title: r.remark,
        meta: r.author_name ?? "Coach",
        icon: StickyNote,
        tone: "brand",
      });
    }
    for (const m of matchesQ.data ?? []) {
      if (!m.match?.scheduled_date) continue;
      const bits: string[] = [];
      if (m.is_captain) bits.push("Captain");
      if (m.is_keeper) bits.push("Keeper");
      if (m.role) bits.push(m.role);
      if (m.is_player_of_match) bits.push("Player of Match");
      out.push({
        id: `match-${m.id}`,
        kind: "match",
        at: m.match.scheduled_date,
        title: m.match.ground_name ?? "Match",
        meta: bits.length ? bits.join(" · ") : (m.match.result ?? undefined),
        icon: m.is_player_of_match ? Trophy : Swords,
        tone: m.is_player_of_match ? "brand" : "muted",
      });
    }
    for (const p of (paymentsQ.data ?? []) as Array<{
      id: string;
      amount: number;
      period: string;
      created_at: string;
    }>) {
      out.push({
        id: `pay-${p.id}`,
        kind: "payment",
        at: p.created_at,
        title: `Fee paid · ${p.period}`,
        meta: `₹${p.amount}`,
        icon: FileText,

        tone: "muted",
      });
    }
    out.sort((a, b) => (a.at < b.at ? 1 : -1));
    if (q.trim()) {
      const needle = q.toLowerCase();
      return out.filter(
        (i) =>
          i.title.toLowerCase().includes(needle) || (i.meta ?? "").toLowerCase().includes(needle),
      );
    }
    return out;
  }, [visitsQ.data, remarksQ.data, matchesQ.data, paymentsQ.data, q]);

  const loading = visitsQ.isLoading || remarksQ.isLoading || matchesQ.isLoading;

  return (
    <div className="space-y-3">
      <SearchBar value={q} onChange={setQ} placeholder="Search timeline…" />
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skel key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <UserRound className="size-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {q ? "No matching events." : "Timeline is empty. Player activity will appear here."}
          </p>
        </Card>
      ) : (
        <ol className="relative ml-2 border-l border-border pl-4 space-y-3">
          {items.map((it) => {
            const Icon = it.icon;
            const dotColor: Record<string, string> = {
              brand: "var(--brand)",
              success: "rgb(16 185 129)",
              info: "rgb(14 165 233)",
              muted: "var(--muted-foreground)",
            };
            return (
              <li key={it.id} className="relative">
                <span
                  className="absolute -left-[21px] top-1 grid place-items-center size-3.5 rounded-full ring-4 ring-background"
                  style={{ backgroundColor: dotColor[it.tone ?? "muted"] }}
                >
                  <Icon className="size-2 text-white" />
                </span>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <div className="text-[10.5px] text-muted-foreground shrink-0 ml-auto">
                    {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
                  </div>
                </div>
                {it.meta ? (
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">{it.meta}</div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------ Performance ------------------------ */

function PerformanceTab({ athleteId }: { athleteId: string | null }) {
  const q = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.career(athleteId ?? "none"),
    queryFn: () => fetchPlayerCareer(athleteId!),
  });

  if (!athleteId) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="size-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Link this player to Match Center to see performance stats.
        </p>
      </Card>
    );
  }
  if (q.isLoading) return <Skel />;
  const c = q.data;
  if (!c)
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No performance data yet.
      </Card>
    );

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <SectionHeader icon={Trophy} title="Batting" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KpiTile label="Innings" value={c.innings} />
          <KpiTile label="Runs" value={c.runs} />
          <KpiTile label="Avg" value={c.average != null ? Number(c.average).toFixed(1) : "—"} />
          <KpiTile
            label="SR"
            value={c.strike_rate != null ? Number(c.strike_rate).toFixed(1) : "—"}
          />
          <KpiTile label="50s / 100s" value={`${c.fifties} / ${c.hundreds}`} />
          <KpiTile label="HS" value={c.highest_score ?? "—"} />
        </div>
      </Card>
      <Card className="p-4">
        <SectionHeader icon={ShieldAlert} title="Bowling" />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <KpiTile label="Wickets" value={c.wickets} />
          <KpiTile
            label="Avg"
            value={c.bowling_average != null ? Number(c.bowling_average).toFixed(1) : "—"}
          />
          <KpiTile label="Econ" value={c.economy != null ? Number(c.economy).toFixed(2) : "—"} />
          <KpiTile label="Best" value={c.best_bowling ?? "—"} />
        </div>
      </Card>
      <Card className="p-4">
        <SectionHeader icon={Layers} title="Fielding & Recognition" />
        <div className="grid grid-cols-3 gap-2">
          <KpiTile label="Catches" value={c.catches} />
          <KpiTile label="Player of Match" value={c.player_of_match} />
          <KpiTile label="Matches" value={c.matches} />
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ Attendance ------------------------ */

function AttendanceTab({
  tenantId,
  studentId,
  joinedAt,
}: {
  tenantId: string;
  studentId: string;
  joinedAt: string | null;
}) {
  const q = useQuery({
    queryKey: ["player", "att-summary", tenantId, studentId],
    queryFn: () => fetchPlayerAttendanceSummary(tenantId, studentId),
  });

  const weekly = useMemo(() => {
    if (!q.data) return null;
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const days: { label: string; date: string; minutes: number; present: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = format(d, "yyyy-MM-dd");
      const day = q.data.days.find((x) => x.session_date === iso);
      days.push({
        label: format(d, "EEEEE"),
        date: iso,
        minutes: day?.total_minutes ?? 0,
        present: !!day,
      });
    }
    return days;
  }, [q.data]);

  if (q.isLoading) return <Skel />;

  const attendancePct =
    joinedAt && q.data
      ? Math.min(
          100,
          Math.round(
            (q.data.presentDays /
              Math.max(
                1,
                Math.min(365, differenceInYears(new Date(), new Date(joinedAt)) * 365 + 30),
              )) *
              100,
          ),
        )
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <KpiTile label="Attendance %" value={attendancePct != null ? `${attendancePct}%` : "—"} />
        <KpiTile label="Visits" value={q.data?.presentDays ?? 0} />
        <KpiTile label="Hours" value={formatDuration(q.data?.totalMinutes ?? 0)} />
      </div>

      <Card className="p-4">
        <SectionHeader icon={Calendar} title="This week" />
        <div className="grid grid-cols-7 gap-1.5">
          {(weekly ?? []).map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-10 w-full rounded-md grid place-items-center text-[10px] font-medium",
                  d.present ? "text-white" : "bg-muted text-muted-foreground",
                )}
                style={d.present ? { backgroundColor: "var(--brand)" } : undefined}
              >
                {d.present ? formatDuration(d.minutes) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">{d.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <SectionHeader icon={ClipboardCheck} title="Recent visits" />
        {(q.data?.days ?? []).length === 0 ? (
          <EmptyLine text="No attendance yet." />
        ) : (
          <ul className="divide-y divide-border">
            {q.data!.days.slice(0, 10).map((d) => (
              <li key={d.session_date} className="py-2 flex items-center gap-2">
                <div className="text-xs font-medium w-24 shrink-0">
                  {format(new Date(d.session_date), "MMM d, EEE")}
                </div>
                <div className="text-[11px] text-muted-foreground flex-1">
                  {d.first_check_in_at ? format(new Date(d.first_check_in_at), "h:mm a") : "—"}
                  {" → "}
                  {d.last_check_out_at
                    ? format(new Date(d.last_check_out_at), "h:mm a")
                    : "In academy"}
                  {d.visit_count > 1 ? (
                    <span className="ml-1">· {d.visit_count} visits</span>
                  ) : null}
                </div>
                <div className="text-xs tabular-nums font-medium">
                  {formatDuration(d.total_minutes)}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link
            to="/dashboard/attendance"
            className="text-xs font-medium"
            style={{ color: "var(--brand)" }}
          >
            Open Attendance module →
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ Matches ------------------------ */

function MatchesTab({ athleteId }: { athleteId: string | null }) {
  const q = useQuery({
    enabled: !!athleteId,
    queryKey: playerKeys.matches(athleteId ?? "none"),
    queryFn: () => fetchRecentMatches(athleteId!, 25),
  });
  if (!athleteId) {
    return (
      <Card className="p-6 text-center">
        <Swords className="size-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">Not linked to Match Center yet.</p>
        <Link to="/match-center" className="text-xs font-medium" style={{ color: "var(--brand)" }}>
          Open Match Center →
        </Link>
      </Card>
    );
  }
  if (q.isLoading) return <Skel />;
  const rows = q.data ?? [];
  if (rows.length === 0)
    return <Card className="p-6 text-sm text-muted-foreground text-center">No matches yet.</Card>;

  return (
    <Card className="p-0 overflow-hidden">
      <ul className="divide-y divide-border">
        {rows.map((m) => (
          <li key={m.id} className="p-3 flex items-center gap-3">
            <div
              className="grid place-items-center size-9 rounded-lg"
              style={{
                backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
                color: "var(--brand)",
              }}
            >
              <Swords className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="text-sm font-medium truncate">
                  {m.match?.ground_name ?? "Match"}
                </div>
                {m.is_player_of_match ? (
                  <ChipPill tone="gold">
                    <Trophy className="size-2.5 mr-0.5" /> MoM
                  </ChipPill>
                ) : null}
                {m.is_captain ? <ChipPill>Captain</ChipPill> : null}
                {m.is_keeper ? <ChipPill>Keeper</ChipPill> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {m.match?.scheduled_date
                  ? format(new Date(m.match.scheduled_date), "MMM d, yyyy")
                  : ""}
                {m.match?.match_format ? ` · ${m.match.match_format}` : ""}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-muted-foreground">
                {m.match?.status === "completed"
                  ? (m.match?.result ?? "Completed")
                  : (m.match?.status ?? "")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------ More ------------------------ */

function MoreTab({
  student,
  studentId,
  studentName,
}: {
  student: {
    guardian_name: string | null;
    guardian_phone: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  } & Record<string, unknown>;
  studentId: string;
  studentName: string;
}) {
  useDashboard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { isOwner } = usePermissions();
  const canRemove = isOwner;

  const rows: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    soon?: boolean;
  }[] = [
    { icon: FileText, label: "Registration form", value: "View original registration", soon: true },
    { icon: BadgeCheck, label: "Certificates", value: "Awards & certificates", soon: true },
    { icon: ShieldAlert, label: "Medical", value: "Health & injury records", soon: true },
    {
      icon: Phone,
      label: "Emergency contact",
      value: student.guardian_name
        ? `${student.guardian_name}${student.guardian_phone ? ` · ${student.guardian_phone}` : ""}`
        : "Not on file",
    },
    { icon: MessageCircle, label: "Address", value: student.address ?? "Not on file" },
    { icon: Layers, label: "Documents", value: "ID card, report card", soon: true },
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <Card key={i} className="p-3.5 flex items-center gap-3">
              <div
                className="grid place-items-center size-9 rounded-lg shrink-0"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
                  color: "var(--brand)",
                }}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.value}</div>
              </div>
              {r.soon ? (
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Soon
                </span>
              ) : null}
            </Card>
          );
        })}
      </div>

      <DangerZone
        visible={canRemove}
        description="Permanently remove this player from the academy. This cannot be undone."
        actions={[
          {
            label: "Remove player",
            description:
              "Deletes attendance, fees, registrations, match records and the player profile.",
            onClick: () => setConfirmOpen(true),
          },
        ]}
      />
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove player permanently"
        description="This permanently removes this player and all academy data — attendance, fees, registrations and match history."
        confirmText={studentName}
        confirmLabel="Remove player"
        onConfirm={async () => {
          try {
            await removeStudent(studentId, studentName);
            toast.success("Player removed");
            await qc.invalidateQueries();
            navigate({ to: "/dashboard/students" });
          } catch (e: any) {
            toast.error(e.message ?? "Failed to remove player");
            throw e;
          }
        }}
      />
    </div>
  );
}
