import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  Trophy,
  Medal,
  Sparkles,
  BarChart3,
  Settings as SettingsIcon,
  LayoutDashboard,
  History,
  Save,
  Trash2,
  PlusCircle,
  Loader2,
  Ruler,
  Weight,
  HeartPulse,
  ShieldAlert,
  Calendar,
  Hand,
  Users2,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import {
  Avatar,
  AthleteStatusBadge,
  FitnessBadge,
  InfoCard,
  InfoRow,
  KindBadge,
} from "@/components/match-center/athlete-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard-context";
import {
  getAthlete,
  updateAthlete,
  deleteAthlete,
  upsertCricketProfile,
  listAchievements,
  createAchievement,
  deleteAchievement,
  listAwards,
  createAward,
  deleteAward,
  listTimeline,
  createTimelineEntry,
  deleteTimelineEntry,
  findCurrentTeam,
  ageFromDob,
  PRIMARY_SPORTS,
  DOMINANT_HANDS,
  FITNESS_STATUSES,
  ATHLETE_STATUSES,
  CRICKET_ROLES,
  CRICKET_BATTING_STYLES,
  CRICKET_BOWLING_STYLES,
  CRICKET_BOWLING_TYPES,
  ACHIEVEMENT_KINDS,
  AWARD_KINDS,
} from "@/lib/mc-athletes";
import {
  getCareer,
  getCareerTimeline,
  rebuildCareer,
  type CareerTimelinePoint,
} from "@/lib/mc-career-engine";
import { toast } from "sonner";
import { useDemoData, useDemoEntity } from "@/lib/mc-demo/store";
import { DemoDetailStub } from "@/components/match-center/demo-detail-stub";
import { DemoPlayerProfile } from "@/components/match-center/demo-player-profile";
import type { DemoData } from "@/lib/mc-demo/generate";

export const Route = createFileRoute("/match-center/players/$athleteId")({
  head: () => ({
    meta: [{ title: "Athlete · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: AthleteProfilePage,
});

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "career", label: "Career", icon: BarChart3 },
  { id: "statistics", label: "Statistics", icon: BarChart3 },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "awards", label: "Awards", icon: Medal },
  { id: "timeline", label: "Timeline", icon: Sparkles },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];

function labelFor(list: readonly { value: string; label: string }[], v?: string | null) {
  if (!v) return null;
  return list.find((l) => l.value === v)?.label ?? v;
}

function AthleteProfilePage() {
  const { athleteId } = Route.useParams();
  const { tenant } = useDashboard();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const demoEntity = useDemoEntity(tenant.id, athleteId);

  const athleteQ = useQuery({
    enabled: !demoEntity,
    queryKey: ["mc-athlete", tenant.id, athleteId],
    queryFn: () => getAthlete(tenant.id, athleteId),
  });

  const teamQ = useQuery({
    queryKey: ["mc-athlete-team", tenant.id, athleteQ.data?.student_id],
    queryFn: () => findCurrentTeam(tenant.id, athleteQ.data!.student_id),
    enabled: !!athleteQ.data?.student_id,
  });

  if (demoEntity && demoEntity.kind === "player") {
    return <DemoPlayerProfileWrapper player={demoEntity.player} />;
  }
  if (demoEntity) {
    return (
      <DemoDetailStub
        entity={demoEntity}
        backLabel="Athletes"
        backTo="/match-center/players"
        parentLabel="Athletes"
        parentTo="/match-center/players"
      />
    );
  }

  if (athleteQ.isLoading) {
    return (
      <div>
        <PageHeader
          title="Athlete"
          breadcrumbs={[
            { label: "Match Center", to: "/match-center/dashboard" },
            { label: "Athletes", to: "/match-center/players" },
            { label: "Loading…" },
          ]}
        />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  const athlete = athleteQ.data;
  if (!athlete) {
    return (
      <div>
        <PageHeader
          title="Athlete not found"
          breadcrumbs={[
            { label: "Match Center", to: "/match-center/dashboard" },
            { label: "Athletes", to: "/match-center/players" },
          ]}
        />
        <EmptyState
          icon={User}
          title="This athlete profile no longer exists"
          description="It may have been deleted. Return to the athletes list to continue."
          actionLabel="Back to athletes"
          actionTo="/match-center/players"
        />
      </div>
    );
  }

  const s = athlete.student;
  const age = ageFromDob(s?.dob);
  const role = labelFor(CRICKET_ROLES, athlete.cricket?.playing_role);
  const sport = labelFor(PRIMARY_SPORTS, athlete.primary_sport);
  const battingStyle = labelFor(CRICKET_BATTING_STYLES, athlete.cricket?.batting_style);

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/match-center/players">
            <ArrowLeft className="size-4 mr-1.5" /> Athletes
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-card">
        <div
          className="h-24 sm:h-28"
          style={{
            background:
              "linear-gradient(120deg, var(--tenant-brand, var(--brand, #E8873C)) 0%, transparent 90%)",
          }}
        />
        <div className="-mt-12 px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="ring-4 ring-card rounded-2xl">
                <Avatar src={s?.photo_url ?? null} name={s?.name ?? "?"} size={96} />
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AthleteStatusBadge status={athlete.current_status} />
                  <FitnessBadge status={athlete.fitness_status} />
                </div>
                <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
                  {s?.name ?? "Unknown"}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {s?.player_id && <span className="font-mono">{s.player_id}</span>}
                  {age !== null && <span>{age} yrs</span>}
                  {sport && <span>· {sport}</span>}
                  {role && <span>· {role}</span>}
                  {battingStyle && <span>· {battingStyle}</span>}
                  {teamQ.data?.name && <span>· {teamQ.data.name}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab athlete={athlete} teamName={teamQ.data?.name ?? null} />
      )}
      {tab === "career" && <CareerTab athleteId={athlete.id} />}
      {tab === "statistics" && <PlaceholderTab title="Statistics" />}
      {tab === "achievements" && <AchievementsTab athleteId={athlete.id} tenantId={tenant.id} />}
      {tab === "awards" && <AwardsTab athleteId={athlete.id} tenantId={tenant.id} />}
      {tab === "timeline" && <TimelineTab athleteId={athlete.id} tenantId={tenant.id} />}
      {tab === "settings" && (
        <SettingsTab
          athlete={athlete}
          onDeleted={() => navigate({ to: "/match-center/players" })}
        />
      )}
    </div>
  );
}

/* ==================== OVERVIEW ==================== */
function OverviewTab({
  athlete,
  teamName,
}: {
  athlete: NonNullable<Awaited<ReturnType<typeof getAthlete>>>;
  teamName: string | null;
}) {
  const s = athlete.student;
  const age = ageFromDob(s?.dob);
  const c = athlete.cricket;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <InfoCard title="Player" icon={User}>
        <InfoRow label="Name" value={s?.name} />
        <InfoRow label="Age" value={age !== null ? `${age} yrs` : null} />
        <InfoRow label="Player ID" value={s?.player_id} />
        <InfoRow label="Primary sport" value={labelFor(PRIMARY_SPORTS, athlete.primary_sport)} />
        <InfoRow label="Current team" value={teamName} icon={Users2} />
      </InfoCard>
      <InfoCard title="Cricket profile" icon={Trophy}>
        <InfoRow label="Playing role" value={labelFor(CRICKET_ROLES, c?.playing_role)} />
        <InfoRow label="Batting style" value={labelFor(CRICKET_BATTING_STYLES, c?.batting_style)} />
        <InfoRow label="Bowling style" value={c?.bowling_style} />
        <InfoRow label="Dominant hand" value={labelFor(DOMINANT_HANDS, c?.dominant_hand ?? athlete.dominant_hand)} icon={Hand} />
        <InfoRow label="Jersey number" value={c?.jersey_number ?? null} />
      </InfoCard>
      <InfoCard title="Physical" icon={HeartPulse}>
        <InfoRow label="Height" value={athlete.height_cm ? `${athlete.height_cm} cm` : null} icon={Ruler} />
        <InfoRow label="Weight" value={athlete.weight_kg ? `${athlete.weight_kg} kg` : null} icon={Weight} />
        <InfoRow label="Fitness" value={labelFor(FITNESS_STATUSES, athlete.fitness_status)} />
        <InfoRow label="Joined sport" value={athlete.joining_sport_date} icon={Calendar} />
      </InfoCard>
      <InfoCard title="Medical notes" icon={ShieldAlert}>
        <div className="text-sm whitespace-pre-wrap text-foreground/90">
          {athlete.medical_notes || (
            <span className="text-muted-foreground">No medical notes recorded.</span>
          )}
        </div>
      </InfoCard>
      <InfoCard title="Emergency notes" icon={ShieldAlert}>
        <div className="text-sm whitespace-pre-wrap text-foreground/90">
          {athlete.emergency_notes || (
            <span className="text-muted-foreground">No emergency notes recorded.</span>
          )}
        </div>
      </InfoCard>
      <InfoCard title="Attendance" icon={BarChart3}>
        <div className="text-sm text-muted-foreground">
          Attendance summary will appear here once linked to sport sessions.
        </div>
      </InfoCard>
    </div>
  );
}

/* ==================== CAREER ==================== */
function CareerTab({ athleteId }: { athleteId: string }) {
  const qc = useQueryClient();
  const careerQ = useQuery({
    queryKey: ["mc-career", athleteId],
    queryFn: () => getCareer(athleteId),
  });
  const timelineQ = useQuery({
    queryKey: ["mc-career-timeline", athleteId],
    queryFn: () => getCareerTimeline(athleteId),
  });
  const rebuild = useMutation({
    mutationFn: () => rebuildCareer(athleteId),
    onSuccess: () => {
      toast.success("Career rebuilt from finalized matches");
      qc.invalidateQueries({ queryKey: ["mc-career", athleteId] });
      qc.invalidateQueries({ queryKey: ["mc-career-timeline", athleteId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Rebuild failed"),
  });

  if (careerQ.isLoading) return <LoadingSkeleton />;
  const c = careerQ.data;

  if (!c || c.matches === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
          >
            {rebuild.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Rebuild career
          </Button>
        </div>
        <EmptyState
          icon={BarChart3}
          title="No career records yet"
          description="Career updates automatically after a match is finalized."
        />
      </div>
    );
  }

  const stat = (label: string, value: string | number, hint?: string) => (
    <div key={label} className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );

  const points = timelineQ.data ?? [];
  const maxRuns = Math.max(1, ...points.map((p: CareerTimelinePoint) => p.runs));
  const maxWkts = Math.max(1, ...points.map((p: CareerTimelinePoint) => p.wickets));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Auto-generated from finalized matches
          {c.last_rebuilt_at
            ? ` · updated ${new Date(c.last_rebuilt_at).toLocaleString()}`
            : ""}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
        >
          {rebuild.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          Rebuild career
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stat("Matches", c.matches)}
        {stat("Runs", c.runs, `${c.innings} innings · ${c.not_outs} NO`)}
        {stat(
          "Highest",
          `${c.highest_score}${c.highest_score_not_out ? "*" : ""}`,
        )}
        {stat("Average", c.average.toFixed(2))}
        {stat("Strike Rate", c.strike_rate.toFixed(2))}
        {stat("50s / 100s", `${c.fifties} / ${c.hundreds}`)}
        {stat("Wickets", c.wickets, `${c.overs} overs`)}
        {stat("Best Bowling", c.best_bowling)}
        {stat("Economy", c.economy.toFixed(2))}
        {stat("Catches", c.catches, `${c.stumpings} st · ${c.run_outs} RO`)}
        {stat(
          "Captain",
          `${c.captain_matches}`,
          `${c.captain_wins}W / ${c.captain_losses}L`,
        )}
        {stat("Player of Match", c.player_of_match)}
      </div>

      {/* Career Graphs (placeholders — reusable sparkline blocks) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Runs Timeline</div>
          <SparkBars values={points.map((p: CareerTimelinePoint) => p.runs)} max={maxRuns} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Wickets Timeline</div>
          <SparkBars values={points.map((p: CareerTimelinePoint) => p.wickets)} max={maxWkts} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Average Timeline</div>
          <SparkBars
            values={points.map((p: CareerTimelinePoint) => p.battingAverageToDate)}
            max={Math.max(1, ...points.map((p: CareerTimelinePoint) => p.battingAverageToDate))}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-semibold">Strike Rate Timeline</div>
          <SparkBars
            values={points.map((p: CareerTimelinePoint) => p.strikeRateToDate)}
            max={Math.max(1, ...points.map((p: CareerTimelinePoint) => p.strikeRateToDate))}
          />
        </div>
      </div>
    </div>
  );
}

function SparkBars({ values, max }: { values: number[]; max: number }) {
  if (values.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No data yet
      </div>
    );
  }
  return (
    <div className="flex h-24 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-foreground/80"
          style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}



function PlaceholderTab({ title }: { title: string }) {
  return (
    <EmptyState
      icon={BarChart3}
      title={`${title} coming soon`}
      description="This section will unlock once the scoring engine is enabled."
    />
  );
}

/* ==================== ACHIEVEMENTS ==================== */
function AchievementsTab({ athleteId, tenantId }: { athleteId: string; tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["mc-achievements", athleteId],
    queryFn: () => listAchievements(athleteId),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteAchievement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mc-achievements", athleteId] }),
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <PlusCircle className="size-4 mr-1.5" /> Add achievement
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No achievements yet"
          description="Add district, state and national selections, tournament wins and more."
          actionLabel="Add achievement"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data!.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <KindBadge kind="achievement" label={labelFor(ACHIEVEMENT_KINDS, a.kind) ?? a.kind} />
                <div className="mt-1.5 font-semibold text-sm">{a.title}</div>
                {a.description && (
                  <div className="mt-1 text-sm text-muted-foreground">{a.description}</div>
                )}
                {a.event_date && (
                  <div className="mt-1 text-xs text-muted-foreground">{a.event_date}</div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => delM.mutate(a.id)}
                aria-label="Delete achievement"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <AchievementDialog
        open={open}
        onOpenChange={setOpen}
        athleteId={athleteId}
        tenantId={tenantId}
      />
    </div>
  );
}

function AchievementDialog({
  open,
  onOpenChange,
  athleteId,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  athleteId: string;
  tenantId: string;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("district");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (open) {
      setKind("district");
      setTitle("");
      setDescription("");
      setDate("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: () =>
      createAchievement({
        tenant_id: tenantId,
        athlete_profile_id: athleteId,
        kind,
        title: title.trim() || (labelFor(ACHIEVEMENT_KINDS, kind) ?? "Achievement"),
        description: description.trim() || null,
        event_date: date || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-achievements", athleteId] });
      onOpenChange(false);
      toast.success("Achievement added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add achievement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {ACHIEVEMENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Selected for U16 District team"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              className="mt-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== AWARDS ==================== */
function AwardsTab({ athleteId, tenantId }: { athleteId: string; tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["mc-awards", athleteId],
    queryFn: () => listAwards(athleteId),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteAward(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mc-awards", athleteId] }),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <PlusCircle className="size-4 mr-1.5" /> Add award
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={Medal}
          title="No awards yet"
          description="Record MVPs, POTMs and other individual honours here."
          actionLabel="Add award"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data!.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <KindBadge kind="award" label={labelFor(AWARD_KINDS, a.kind) ?? a.kind} />
                <div className="mt-1.5 font-semibold text-sm">{a.title}</div>
                {a.description && (
                  <div className="mt-1 text-sm text-muted-foreground">{a.description}</div>
                )}
                {a.event_date && (
                  <div className="mt-1 text-xs text-muted-foreground">{a.event_date}</div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => delM.mutate(a.id)}
                aria-label="Delete award"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <AwardDialog open={open} onOpenChange={setOpen} athleteId={athleteId} tenantId={tenantId} />
    </div>
  );
}

function AwardDialog({
  open,
  onOpenChange,
  athleteId,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  athleteId: string;
  tenantId: string;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("potm_match");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (open) {
      setKind("potm_match");
      setTitle("");
      setDescription("");
      setDate("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: () =>
      createAward({
        tenant_id: tenantId,
        athlete_profile_id: athleteId,
        kind,
        title: title.trim() || (labelFor(AWARD_KINDS, kind) ?? "Award"),
        description: description.trim() || null,
        event_date: date || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-awards", athleteId] });
      onOpenChange(false);
      toast.success("Award added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add award</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {AWARD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Title</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== TIMELINE ==================== */
function TimelineTab({ athleteId, tenantId }: { athleteId: string; tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["mc-timeline", athleteId],
    queryFn: () => listTimeline(athleteId),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteTimelineEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mc-timeline", athleteId] }),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <PlusCircle className="size-4 mr-1.5" /> Add timeline event
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No timeline events yet"
          description="Capture the story of this athlete — joining, first tournament, captaincy, selections."
          actionLabel="Add timeline event"
          onAction={() => setOpen(true)}
        />
      ) : (
        <ol className="relative ml-3 border-l border-border">
          {q.data!.map((t) => (
            <li key={t.id} className="mb-6 ml-6">
              <span className="absolute -left-2.5 mt-1.5 grid size-5 place-items-center rounded-full border border-border bg-card">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
                />
              </span>
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{t.event_date}</div>
                  <div className="mt-0.5 font-semibold text-sm">{t.title}</div>
                  {t.description && (
                    <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {t.description}
                    </div>
                  )}
                  {t.image_url && (
                    <img
                      src={t.image_url}
                      alt=""
                      className="mt-3 max-h-48 rounded-lg border border-border object-cover"
                    />
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => delM.mutate(t.id)}
                  aria-label="Delete timeline event"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <TimelineDialog
        open={open}
        onOpenChange={setOpen}
        athleteId={athleteId}
        tenantId={tenantId}
      />
    </div>
  );
}

function TimelineDialog({
  open,
  onOpenChange,
  athleteId,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  athleteId: string;
  tenantId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setImageUrl("");
    }
  }, [open]);

  const m = useMutation({
    mutationFn: () =>
      createTimelineEntry({
        tenant_id: tenantId,
        athlete_profile_id: athleteId,
        title: title.trim(),
        description: description.trim() || null,
        event_date: date,
        image_url: imageUrl.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-timeline", athleteId] });
      onOpenChange(false);
      toast.success("Timeline event added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add timeline event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Joined academy"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Image URL (optional)</Label>
            <Input
              className="mt-1"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== SETTINGS ==================== */
function SettingsTab({
  athlete,
  onDeleted,
}: {
  athlete: NonNullable<Awaited<ReturnType<typeof getAthlete>>>;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    primary_sport: athlete.primary_sport ?? "cricket",
    dominant_hand: athlete.dominant_hand ?? "",
    height_cm: athlete.height_cm?.toString() ?? "",
    weight_kg: athlete.weight_kg?.toString() ?? "",
    fitness_status: athlete.fitness_status ?? "",
    medical_notes: athlete.medical_notes ?? "",
    emergency_notes: athlete.emergency_notes ?? "",
    joining_sport_date: athlete.joining_sport_date ?? "",
    current_status: athlete.current_status ?? "active",
  });
  const [cricket, setCricket] = useState({
    playing_role: athlete.cricket?.playing_role ?? "",
    batting_style: athlete.cricket?.batting_style ?? "",
    bowling_style: athlete.cricket?.bowling_style ?? "",
    bowling_type: athlete.cricket?.bowling_type ?? "",
    preferred_position: athlete.cricket?.preferred_position ?? "",
    jersey_number: athlete.cricket?.jersey_number?.toString() ?? "",
    dominant_hand: athlete.cricket?.dominant_hand ?? "",
    favorite_shot: athlete.cricket?.favorite_shot ?? "",
    favorite_delivery: athlete.cricket?.favorite_delivery ?? "",
    career_status: athlete.cricket?.career_status ?? "active",
  });

  const saveM = useMutation({
    mutationFn: async () => {
      await updateAthlete(athlete.id, {
        primary_sport: form.primary_sport,
        dominant_hand: form.dominant_hand || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        fitness_status: form.fitness_status || null,
        medical_notes: form.medical_notes || null,
        emergency_notes: form.emergency_notes || null,
        joining_sport_date: form.joining_sport_date || null,
        current_status: form.current_status,
      });
      await upsertCricketProfile(athlete.tenant_id, athlete.id, {
        playing_role: cricket.playing_role || null,
        batting_style: cricket.batting_style || null,
        bowling_style: cricket.bowling_style || null,
        bowling_type: cricket.bowling_type || null,
        preferred_position: cricket.preferred_position || null,
        jersey_number: cricket.jersey_number ? Number(cricket.jersey_number) : null,
        dominant_hand: cricket.dominant_hand || null,
        favorite_shot: cricket.favorite_shot || null,
        favorite_delivery: cricket.favorite_delivery || null,
        career_status: cricket.career_status,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-athlete", athlete.tenant_id, athlete.id] });
      qc.invalidateQueries({ queryKey: ["mc-athletes", athlete.tenant_id] });
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delM = useMutation({
    mutationFn: () => deleteAthlete(athlete.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-athletes", athlete.tenant_id] });
      toast.success("Profile deleted");
      onDeleted();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InfoCard title="Athlete profile" icon={User}>
        <div className="space-y-3">
          <SelectField
            label="Primary sport"
            value={form.primary_sport}
            onChange={(v) => setForm((f) => ({ ...f, primary_sport: v }))}
            options={PRIMARY_SPORTS}
          />
          <SelectField
            label="Dominant hand"
            value={form.dominant_hand}
            onChange={(v) => setForm((f) => ({ ...f, dominant_hand: v }))}
            options={DOMINANT_HANDS}
            allowEmpty
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Height (cm)</Label>
              <Input
                type="number"
                className="mt-1"
                value={form.height_cm}
                onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
              />
            </div>
            <div>
              <Label>Weight (kg)</Label>
              <Input
                type="number"
                className="mt-1"
                value={form.weight_kg}
                onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
              />
            </div>
          </div>
          <SelectField
            label="Fitness"
            value={form.fitness_status}
            onChange={(v) => setForm((f) => ({ ...f, fitness_status: v }))}
            options={FITNESS_STATUSES}
            allowEmpty
          />
          <div>
            <Label>Joining sport date</Label>
            <Input
              type="date"
              className="mt-1"
              value={form.joining_sport_date}
              onChange={(e) => setForm((f) => ({ ...f, joining_sport_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Medical notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.medical_notes}
              onChange={(e) => setForm((f) => ({ ...f, medical_notes: e.target.value }))}
            />
          </div>
          <div>
            <Label>Emergency notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={form.emergency_notes}
              onChange={(e) => setForm((f) => ({ ...f, emergency_notes: e.target.value }))}
            />
          </div>
          <SelectField
            label="Status"
            value={form.current_status}
            onChange={(v) => setForm((f) => ({ ...f, current_status: v }))}
            options={ATHLETE_STATUSES}
          />
        </div>
      </InfoCard>

      <InfoCard title="Cricket profile" icon={Trophy}>
        <div className="space-y-3">
          <SelectField
            label="Playing role"
            value={cricket.playing_role}
            onChange={(v) => setCricket((c) => ({ ...c, playing_role: v }))}
            options={CRICKET_ROLES}
            allowEmpty
          />
          <SelectField
            label="Batting style"
            value={cricket.batting_style}
            onChange={(v) => setCricket((c) => ({ ...c, batting_style: v }))}
            options={CRICKET_BATTING_STYLES}
            allowEmpty
          />
          <div>
            <Label>Bowling style</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={cricket.bowling_style}
              onChange={(e) => setCricket((c) => ({ ...c, bowling_style: e.target.value }))}
            >
              <option value="">—</option>
              {CRICKET_BOWLING_STYLES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <SelectField
            label="Bowling type"
            value={cricket.bowling_type}
            onChange={(v) => setCricket((c) => ({ ...c, bowling_type: v }))}
            options={CRICKET_BOWLING_TYPES}
            allowEmpty
          />
          <SelectField
            label="Dominant hand (cricket)"
            value={cricket.dominant_hand}
            onChange={(v) => setCricket((c) => ({ ...c, dominant_hand: v }))}
            options={DOMINANT_HANDS}
            allowEmpty
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Preferred position</Label>
              <Input
                className="mt-1"
                value={cricket.preferred_position}
                onChange={(e) =>
                  setCricket((c) => ({ ...c, preferred_position: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Jersey #</Label>
              <Input
                type="number"
                className="mt-1"
                value={cricket.jersey_number}
                onChange={(e) => setCricket((c) => ({ ...c, jersey_number: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Favourite shot</Label>
            <Input
              className="mt-1"
              value={cricket.favorite_shot}
              onChange={(e) => setCricket((c) => ({ ...c, favorite_shot: e.target.value }))}
            />
          </div>
          <div>
            <Label>Favourite delivery</Label>
            <Input
              className="mt-1"
              value={cricket.favorite_delivery}
              onChange={(e) => setCricket((c) => ({ ...c, favorite_delivery: e.target.value }))}
            />
          </div>
          <SelectField
            label="Career status"
            value={cricket.career_status}
            onChange={(v) => setCricket((c) => ({ ...c, career_status: v }))}
            options={ATHLETE_STATUSES}
          />
        </div>
      </InfoCard>

      <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this athlete profile? This cannot be undone.")) delM.mutate();
          }}
        >
          <Trash2 className="size-4 mr-1.5" /> Delete profile
        </Button>
        <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          {saveM.isPending ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="size-4 mr-1.5" />
          )}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
