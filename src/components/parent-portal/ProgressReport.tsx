/* ================================================================
 * Player Progress Report — parent-facing premium report.
 * ----------------------------------------------------------------
 * Reads ONLY from already-fetched or already-computed sources:
 *   - `ChildSummary` from get_parent_child_summary (career/recognitions/
 *     achievements/recent_matches/cricket_profile/timeline).
 *   - `fetchAttendanceReport` — attendance_marks + attendance_sessions.
 *   - `fetchCoachRemarks` — mc_coach_remarks (RLS gated).
 *   - `fetchLatestAIReport` — mc_ai_reports for the athlete.
 *   - `fetchHallOfFame`, `fetchAthleteAwards` — recognition surfaces.
 *
 * Charts are the existing LineChartSVG / ProgressRing components.
 * Print/Share uses `window.print()` and `navigator.share`.
 * ================================================================ */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  CalendarDays,
  TrendingUp,
  Trophy,
  Award,
  Sparkles,
  Printer,
  Share2,
  Download,
  MessageSquareText,
  Medal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChartSVG, ProgressRing } from "@/components/match-center/perf-charts";
import type { ChildSummary } from "@/lib/mc-parent-portal";
import {
  fetchAttendanceReport,
  fetchCoachRemarks,
  fetchHallOfFame,
  fetchAthleteAwards,
  fetchLatestAIReport,
  buildParentSummary,
} from "@/lib/mc-progress-report";
import { toast } from "sonner";

type Kid = {
  student_id: string;
  student_name: string;
  player_id: string | null;
  photo_url: string | null;
  academy_id: string | null;
};

export function ProgressReport({
  kid,
  summary,
}: {
  kid: Kid;
  summary: ChildSummary;
}) {
  const studentId = kid.student_id;
  const tenantId = (summary.student?.tenant_id as string | undefined) ?? kid.academy_id ?? "";
  const athleteProfileId = summary.athlete_profile_id;

  const attendanceQ = useQuery({
    queryKey: ["progress-attendance", studentId, tenantId],
    queryFn: () => fetchAttendanceReport(studentId, tenantId),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const remarksQ = useQuery({
    queryKey: ["progress-remarks", studentId],
    queryFn: () => fetchCoachRemarks(studentId),
    staleTime: 60_000,
  });

  const aiQ = useQuery({
    queryKey: ["progress-ai", athleteProfileId],
    queryFn: () => fetchLatestAIReport(athleteProfileId),
    enabled: Boolean(athleteProfileId),
    staleTime: 5 * 60_000,
  });

  const hofQ = useQuery({
    queryKey: ["progress-hof", athleteProfileId, tenantId],
    queryFn: () => fetchHallOfFame(tenantId, athleteProfileId),
    enabled: Boolean(athleteProfileId && tenantId),
    staleTime: 5 * 60_000,
  });

  const awardsQ = useQuery({
    queryKey: ["progress-awards", athleteProfileId],
    queryFn: () => fetchAthleteAwards(athleteProfileId),
    enabled: Boolean(athleteProfileId),
    staleTime: 5 * 60_000,
  });

  const career = (summary.career ?? {}) as Record<string, number | string | null>;
  const cp = (summary.cricket_profile ?? {}) as Record<string, string | number | null>;
  const student = (summary.student ?? {}) as Record<string, string | null>;

  const parentSummary = useMemo(() => {
    if (!attendanceQ.data) return null;
    return buildParentSummary({
      studentName: kid.student_name,
      attendance: attendanceQ.data,
      career: {
        matches: Number(career.matches ?? 0),
        runs: Number(career.runs ?? 0),
        wickets: Number(career.wickets ?? 0),
        average: career.average != null ? Number(career.average) : null,
        strike_rate: career.strike_rate != null ? Number(career.strike_rate) : null,
        highest_score: career.highest_score != null ? Number(career.highest_score) : null,
        catches: Number(career.catches ?? 0),
      },
      ai: aiQ.data,
    });
  }, [attendanceQ.data, aiQ.data, kid.student_name, career]);

  const runsTrend = useMemo(
    () => buildMatchTrend(summary.recent_matches, "runs"),
    [summary.recent_matches],
  );
  const wicketsTrend = useMemo(
    () => buildMatchTrend(summary.recent_matches, "wickets"),
    [summary.recent_matches],
  );

  const age = student.dob ? computeAge(student.dob) : null;

  return (
    <div className="space-y-4 print:space-y-3">
      {/* Actions — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Player progress report
          </div>
          <h2 className="text-xl font-bold">
            {kid.student_name}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print progress report"
          >
            <Printer className="size-4 mr-1.5" aria-hidden /> Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label="Save progress report as PDF"
          >
            <Download className="size-4 mr-1.5" aria-hidden /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const text = `${kid.student_name} — Player Progress Report\n\n${parentSummary ?? ""}`;
              try {
                if (typeof navigator !== "undefined" && "share" in navigator) {
                  await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
                    title: `${kid.student_name} — Player Progress Report`,
                    text,
                  });
                } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                  await navigator.clipboard.writeText(text);
                  toast.success("Summary copied to clipboard");
                }
              } catch {
                // user cancelled — no toast
              }
            }}
            aria-label="Share progress report"
          >
            <Share2 className="size-4 mr-1.5" aria-hidden /> Share
          </Button>
        </div>
      </div>

      {/* Student information */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          {kid.photo_url ? (
            <img
              src={kid.photo_url}
              alt={`${kid.student_name} avatar`}
              loading="lazy"
              decoding="async"
              className="size-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="size-20 rounded-full bg-muted grid place-items-center" aria-hidden>
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold truncate">{kid.student_name}</h3>
            <p className="text-xs text-muted-foreground">
              {kid.player_id ?? "—"}{age != null ? ` · ${age} yrs` : ""}
            </p>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
              <InfoField label="Role" value={String(cp.playing_role ?? "—")} />
              <InfoField label="Batting" value={String(cp.batting_style ?? "—")} />
              <InfoField label="Bowling" value={String(cp.bowling_style ?? "—")} />
              <InfoField label="Joined" value={student.created_at ? new Date(student.created_at).toLocaleDateString() : "—"} />
            </dl>
          </div>
        </div>
      </Card>

      {/* AI Parent Summary */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className="size-9 shrink-0 rounded-full grid place-items-center"
            style={{ backgroundColor: "color-mix(in oklch, var(--tenant-brand, var(--brand)) 14%, transparent)" }}
            aria-hidden
          >
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
            {parentSummary ? (
              <p className="mt-1 text-sm leading-relaxed">{parentSummary}</p>
            ) : (
              <Skeleton className="mt-1 h-16" />
            )}
          </div>
        </div>
      </Card>

      {/* Attendance */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Attendance</h3>
        </div>
        {attendanceQ.isLoading ? (
          <Skeleton className="h-40" />
        ) : attendanceQ.data ? (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-4">
              <ProgressRing
                value={attendanceQ.data.current.percent}
                max={100}
                label="This month"
                ariaLabel={`Current month attendance ${attendanceQ.data.current.percent}%`}
              />
              <dl className="text-sm space-y-1">
                <MonthStat label="Present" value={attendanceQ.data.current.present} tone="pos" />
                <MonthStat label="Late" value={attendanceQ.data.current.late} tone="warn" />
                <MonthStat label="Absent" value={attendanceQ.data.current.absent} tone="neg" />
                <MonthStat
                  label="Prev month"
                  value={`${attendanceQ.data.previous.percent}%`}
                />
              </dl>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">6-month trend (% attended)</div>
              <LineChartSVG
                values={attendanceQ.data.trend.map((t) => t.value)}
                labels={attendanceQ.data.trend.map((t) => t.label)}
                height={110}
                color="hsl(var(--primary))"
                ariaLabel="Attendance trend, last six months"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No attendance data available yet.</p>
        )}
      </Card>

      {/* Performance */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Performance</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <PerfStat label="Matches" value={career.matches ?? 0} />
          <PerfStat label="Runs" value={career.runs ?? 0} />
          <PerfStat label="Wickets" value={career.wickets ?? 0} />
          <PerfStat
            label="Batting avg"
            value={career.average != null ? Number(career.average).toFixed(2) : "—"}
          />
          <PerfStat
            label="Strike rate"
            value={career.strike_rate != null ? Number(career.strike_rate).toFixed(1) : "—"}
          />
          <PerfStat
            label="Economy"
            value={
              (career as { economy?: number | null }).economy != null
                ? Number((career as { economy?: number | null }).economy).toFixed(2)
                : "—"
            }
          />
          <PerfStat label="Catches" value={career.catches ?? 0} />
          <PerfStat label="Run outs" value={career.run_outs ?? 0} />
          <PerfStat
            label="Highest score"
            value={`${career.highest_score ?? 0}${career.highest_score_not_out ? "*" : ""}`}
          />
          <PerfStat label="Best bowling" value={String(career.best_bowling ?? "—")} />
        </div>
        {(runsTrend.length > 1 || wicketsTrend.length > 1) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {runsTrend.length > 1 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Recent runs</div>
                <LineChartSVG
                  values={runsTrend}
                  height={100}
                  color="hsl(var(--primary))"
                  ariaLabel="Recent runs trend"
                />
              </div>
            )}
            {wicketsTrend.length > 1 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Recent wickets</div>
                <LineChartSVG
                  values={wicketsTrend}
                  height={100}
                  color="hsl(var(--primary))"
                  ariaLabel="Recent wickets trend"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Achievements combined */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Achievements & Recognition</h3>
        </div>
        <AchievementsList
          recognitions={summary.recognitions}
          achievements={summary.achievements}
          awards={awardsQ.data ?? []}
          hof={hofQ.data ?? []}
          pomCount={Number(career.player_of_match ?? 0)}
        />
      </Card>

      {/* Coach remarks */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareText className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Coach remarks</h3>
        </div>
        {remarksQ.isLoading ? (
          <Skeleton className="h-16" />
        ) : (remarksQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Coaches have not shared any remarks yet. Check back after the next session.
          </p>
        ) : (
          <ul className="space-y-2">
            {(remarksQ.data ?? []).map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 p-3 bg-card">
                <p className="text-sm leading-relaxed">{r.remark}</p>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.author_name ?? "Coach"} · {new Date(r.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  );
}

function MonthStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "pos" | "warn" | "neg";
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "neg"
          ? "text-rose-600"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

function PerfStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5 bg-card">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function AchievementsList({
  recognitions,
  achievements,
  awards,
  hof,
  pomCount,
}: {
  recognitions: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  awards: Array<{ id: string; title: string; kind: string; event_date: string | null }>;
  hof: Array<{ id: string; achievement_title: string; category: string; awarded_at: string | null }>;
  pomCount: number;
}) {
  const items: { key: string; title: string; kind: string; date?: string | null }[] = [];
  for (const r of recognitions) {
    const rr = r as { id: string; title: string; recognition_type: string; awarded_at?: string };
    items.push({ key: `r-${rr.id}`, title: rr.title, kind: rr.recognition_type, date: rr.awarded_at });
  }
  for (const a of awards) {
    items.push({ key: `w-${a.id}`, title: a.title, kind: a.kind || "Award", date: a.event_date });
  }
  for (const h of hof) {
    items.push({
      key: `h-${h.id}`,
      title: h.achievement_title,
      kind: `Hall of Fame · ${h.category}`,
      date: h.awarded_at,
    });
  }
  for (const a of achievements) {
    const aa = a as { id: string; title: string; kind?: string; event_date?: string };
    items.push({ key: `a-${aa.id}`, title: aa.title, kind: aa.kind ?? "Achievement", date: aa.event_date });
  }

  if (pomCount > 0) {
    items.unshift({
      key: "pom",
      title: `Player of the Match × ${pomCount}`,
      kind: "Match award",
      date: null,
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No awards or recognitions yet — each session and match is a step towards the first one.
      </p>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.slice(0, 12).map((i) => (
        <li key={i.key} className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 bg-card">
          <Award className="size-4 mt-0.5 shrink-0 text-amber-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{i.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="capitalize text-[10px]">
                <Medal className="size-3 mr-1" aria-hidden />
                {String(i.kind).replace(/_/g, " ")}
              </Badge>
              {i.date && <span>{new Date(i.date).toLocaleDateString()}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- helpers ---------------- */

function computeAge(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function buildMatchTrend(
  matches: Array<{ result: string | null }> | undefined,
  key: "runs" | "wickets",
): number[] {
  if (!matches) return [];
  // Extract "runs" or "wickets" from result strings when present, otherwise empty.
  const values: number[] = [];
  for (const m of matches.slice(0, 10).reverse()) {
    const r = m.result ?? "";
    const re =
      key === "runs" ? /(\d+)\s*runs/i.exec(r) : /(\d+)\s*wicket/i.exec(r);
    if (re) values.push(Number(re[1]));
  }
  return values;
}
