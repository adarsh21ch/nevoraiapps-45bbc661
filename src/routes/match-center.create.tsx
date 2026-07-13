import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Swords,
  ChevronDown,
  ChevronUp,
  Crown,
  Shield,
  Star,
  Plus,
  Sparkles,
  Loader2,
  Zap,
  Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard-context";
import { Avatar } from "@/components/match-center/athlete-ui";
import { TeamOptionCard } from "@/components/match-center/match-ui";
import {
  listAllTeams,
  listTeamPlayersForXI,
  listStudentsByIds,
  ensureAthleteProfileIds,
  createExternalTeam,
  createMatch,
  findLastMatchBetween,
  listMatchSquad,
  readMatchDefaults,
  writeMatchDefaults,
  MATCH_TYPES,
  MATCH_FORMATS,
  type MatchSquadDraft,
  type TeamLite,
} from "@/lib/mc-matches";
import { toast } from "sonner";

export const Route = createFileRoute("/match-center/create")({
  head: () => ({
    meta: [{ title: "Create match · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: CreateMatchPage,
});

/* ==================== TYPES ==================== */

type PlayerDraft = {
  student_id: string;
  athlete_profile_id?: string;
  name: string;
  photo_url: string | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_keeper: boolean;
  is_substitute: boolean;
};

/* ==================== PAGE ==================== */

function CreateMatchPage() {
  const { tenant, profile } = useDashboard();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const defaults = useMemo(() => readMatchDefaults(tenant.id), [tenant.id]);
  const [mode, setMode] = useState<"quick" | "advanced">("quick");

  const teamsQ = useQuery({
    queryKey: ["mc-all-teams", tenant.id],
    queryFn: () => listAllTeams(tenant.id),
  });

  const [teamAId, setTeamAId] = useState<string>(defaults.team_a_id ?? "");
  const [teamBId, setTeamBId] = useState<string>("");
  const [squadA, setSquadA] = useState<PlayerDraft[]>([]);
  const [squadB, setSquadB] = useState<PlayerDraft[]>([]);
  const [externalB, setExternalB] = useState<PlayerDraft[]>([]);
  const [externalBOpen, setExternalBOpen] = useState(false);

  const [matchType, setMatchType] = useState(defaults.match_type ?? "practice");
  const [matchFormat, setMatchFormat] = useState(defaults.match_format ?? "T20");
  const [overs, setOvers] = useState<number>(defaults.overs ?? 20);
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [advOpen, setAdvOpen] = useState(false);
  const [ground, setGround] = useState(defaults.ground_name ?? "");
  const [pitch, setPitch] = useState(defaults.pitch ?? "");
  const [weather, setWeather] = useState("");
  const [scorer, setScorer] = useState(defaults.scorer ?? "");
  const [umpire, setUmpire] = useState(defaults.umpire ?? "");
  const [notes, setNotes] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [streamingUrl, setStreamingUrl] = useState("");
  const [ballType, setBallType] = useState(defaults.ball_type ?? "");

  const teams = teamsQ.data ?? [];
  const academyTeams = teams.filter((t) => !t.is_external);
  const externalTeams = teams.filter((t) => t.is_external);
  const teamA = teams.find((t) => t.id === teamAId) ?? null;
  const teamB = teams.find((t) => t.id === teamBId) ?? null;
  const teamBExternal = !!teamB?.is_external;

  /* ---- Auto-fill overs when format changes ---- */
  useEffect(() => {
    const f = MATCH_FORMATS.find((x) => x.value === matchFormat);
    if (f && f.value !== "Custom") setOvers(f.overs);
  }, [matchFormat]);

  /* ---- Load default XI for Team A when it changes ---- */
  const loadDefaultXI = async (teamId: string): Promise<PlayerDraft[]> => {
    const roster = await listTeamPlayersForXI(teamId);
    if (roster.length === 0) return [];
    const students = await listStudentsByIds(roster.map((r) => r.student_id));
    const byId = Object.fromEntries(students.map((s) => [s.id, s]));
    const athleteMap = await ensureAthleteProfileIds(
      tenant.id,
      roster.map((r) => r.student_id),
    );
    return roster.map((r) => {
      const s = byId[r.student_id];
      return {
        student_id: r.student_id,
        athlete_profile_id: athleteMap[r.student_id],
        name: s?.name ?? "Unknown",
        photo_url: s?.photo_url ?? null,
        is_captain: !!r.is_captain,
        is_vice_captain: !!r.is_vice_captain,
        is_keeper: !!r.is_keeper,
        is_substitute: false,
      };
    });
  };

  useEffect(() => {
    if (!teamAId) {
      setSquadA([]);
      return;
    }
    (async () => {
      // Try to reuse previous XI from last match with any opponent
      const dxi = defaults.playing_xi?.[teamAId];
      const roster = await loadDefaultXI(teamAId);
      if (dxi && dxi.length > 0) {
        // Order by remembered athlete_profile_ids
        const byAthlete = new Map<string, PlayerDraft>();
        roster.forEach((p) => p.athlete_profile_id && byAthlete.set(p.athlete_profile_id, p));
        const ordered = dxi.map((id) => byAthlete.get(id)).filter(Boolean) as PlayerDraft[];
        const remainder = roster.filter(
          (p) => !p.athlete_profile_id || !dxi.includes(p.athlete_profile_id),
        );
        setSquadA([...ordered, ...remainder]);
      } else {
        setSquadA(roster);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamAId]);

  useEffect(() => {
    if (!teamBId || teamBExternal) {
      setSquadB([]);
      return;
    }
    (async () => {
      const roster = await loadDefaultXI(teamBId);
      setSquadB(roster);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamBId, teamBExternal]);

  /* ---- If a previous match exists between the two, offer to reuse its XI ---- */
  const prevMatchQ = useQuery({
    queryKey: ["mc-prev-match", tenant.id, teamAId, teamBId],
    queryFn: () => findLastMatchBetween(tenant.id, teamAId, teamBId),
    enabled: !!teamAId && !!teamBId,
  });

  const applyPreviousXI = async () => {
    const prev = prevMatchQ.data;
    if (!prev) return;
    const [aSquad, bSquad] = await Promise.all([
      listMatchSquad(prev.id, teamAId),
      listMatchSquad(prev.id, teamBId),
    ]);
    const applyTo = (
      current: PlayerDraft[],
      snapshot: { athlete_profile_id: string | null; external_player_name: string | null; is_captain: boolean; is_vice_captain: boolean; is_keeper: boolean; is_substitute: boolean }[],
    ) => {
      if (snapshot.length === 0) return current;
      const orderedIds = snapshot
        .map((s) => s.athlete_profile_id)
        .filter((v): v is string => !!v);
      const flagBy = new Map(
        snapshot
          .filter((s) => s.athlete_profile_id)
          .map((s) => [
            s.athlete_profile_id!,
            {
              is_captain: s.is_captain,
              is_vice_captain: s.is_vice_captain,
              is_keeper: s.is_keeper,
              is_substitute: s.is_substitute,
            },
          ]),
      );
      const byAthlete = new Map<string, PlayerDraft>();
      current.forEach((p) => p.athlete_profile_id && byAthlete.set(p.athlete_profile_id, p));
      const ordered = orderedIds
        .map((id) => {
          const p = byAthlete.get(id);
          if (!p) return null;
          const f = flagBy.get(id)!;
          return { ...p, ...f };
        })
        .filter(Boolean) as PlayerDraft[];
      const rest = current.filter(
        (p) => !p.athlete_profile_id || !orderedIds.includes(p.athlete_profile_id),
      );
      return [...ordered, ...rest];
    };
    setSquadA((s) => applyTo(s, aSquad));
    if (!teamBExternal) setSquadB((s) => applyTo(s, bSquad));
    toast.success("Previous Playing XI loaded");
  };

  /* ---- Create match mutation ---- */
  const createM = useMutation({
    mutationFn: async () => {
      if (!teamAId || !teamBId) throw new Error("Select both teams");
      if (teamAId === teamBId) throw new Error("Teams must be different");
      const squadADraft: MatchSquadDraft[] = squadA.map((p, i) => ({
        athlete_profile_id: p.athlete_profile_id ?? null,
        batting_order: i + 1,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        is_keeper: p.is_keeper,
        is_substitute: p.is_substitute,
      }));
      const bDraft: PlayerDraft[] = teamBExternal ? externalB : squadB;
      const squadBDraft: MatchSquadDraft[] = bDraft.map((p, i) => ({
        athlete_profile_id: p.athlete_profile_id ?? null,
        external_player_name: p.athlete_profile_id ? null : p.name,
        batting_order: i + 1,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        is_keeper: p.is_keeper,
        is_substitute: p.is_substitute,
      }));

      const match = await createMatch({
        tenantId: tenant.id,
        team_a_id: teamAId,
        team_b_id: teamBId,
        match_type: matchType,
        match_format: matchFormat,
        overs,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
        ground_name: ground || null,
        pitch: pitch || null,
        weather: weather || null,
        scorer: scorer || null,
        umpire: umpire || null,
        notes: notes || null,
        visibility,
        streaming_url: streamingUrl || null,
        ball_type: ballType || null,
        createdBy: profile?.user_id ?? null,
        squad_a: squadADraft,
        squad_b: squadBDraft,
      });

      // Remember smart defaults
      writeMatchDefaults(tenant.id, {
        match_type: matchType,
        match_format: matchFormat,
        overs,
        ground_name: ground,
        ball_type: ballType,
        scorer,
        umpire,
        pitch,
        team_a_id: teamAId,
        playing_xi: {
          [teamAId]: squadA
            .filter((p) => p.athlete_profile_id && !p.is_substitute)
            .map((p) => p.athlete_profile_id!),
          ...(teamBExternal
            ? {}
            : {
                [teamBId]: squadB
                  .filter((p) => p.athlete_profile_id && !p.is_substitute)
                  .map((p) => p.athlete_profile_id!),
              }),
        },
      });

      return match;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-matches", tenant.id] });
      toast.success("Match created");
      navigate({ to: "/match-center/matches" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create match"),
  });

  const currentB = teamBExternal ? externalB : squadB;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/match-center/matches">
            <ArrowLeft className="size-4 mr-1.5" /> Matches
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Create match"
        description="Quick match sets up a fixture in under 20 seconds. Everything else is under Advanced options."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Matches", to: "/match-center/matches" },
          { label: "Create" },
        ]}
      />

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-border bg-card p-1">
        <ModeButton
          active={mode === "quick"}
          onClick={() => setMode("quick")}
          icon={Zap}
          label="Quick match"
        />
        <ModeButton
          active={mode === "advanced"}
          onClick={() => setMode("advanced")}
          icon={Settings2}
          label="Advanced"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team A */}
        <StepCard step={1} title="Team A" caption="Your academy team">
          <TeamPicker
            teams={academyTeams}
            selectedId={teamAId}
            onSelect={setTeamAId}
            loading={teamsQ.isLoading}
          />
        </StepCard>

        {/* Team B */}
        <StepCard step={2} title="Team B" caption="Opponent — academy or external">
          <TeamPicker
            teams={teams}
            selectedId={teamBId}
            onSelect={(id) => {
              if (id === teamAId) {
                toast.error("Team B must be different");
                return;
              }
              setTeamBId(id);
            }}
            excludeId={teamAId}
            allowExternal
            onCreateExternal={() => setExternalBOpen(true)}
            loading={teamsQ.isLoading}
          />
        </StepCard>
      </div>

      {/* Previous XI banner */}
      {prevMatchQ.data && teamAId && teamBId && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Previous Playing XI available</div>
              <div className="text-xs text-muted-foreground">
                These two teams played on {prevMatchQ.data.scheduled_date ?? "an earlier date"}.
                Reuse the same lineup as a starting point.
              </div>
            </div>
          </div>
          <Button size="sm" onClick={applyPreviousXI}>
            <Sparkles className="size-4 mr-1.5" /> Use previous XI
          </Button>
        </div>
      )}

      {/* Playing XI */}
      {(teamAId || teamBId) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <PlayingXICard
            title={teamA?.name ?? "Team A"}
            players={squadA}
            onChange={setSquadA}
          />
          {teamBExternal ? (
            <ExternalPlayingXICard
              title={teamB?.name ?? "Team B"}
              players={externalB}
              onChange={setExternalB}
            />
          ) : (
            <PlayingXICard
              title={teamB?.name ?? "Team B"}
              players={squadB}
              onChange={setSquadB}
            />
          )}
        </div>
      )}

      {/* Format + schedule */}
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <div>
          <Label>Match type</Label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={matchType}
            onChange={(e) => setMatchType(e.target.value)}
          >
            {MATCH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Format</Label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={matchFormat}
            onChange={(e) => setMatchFormat(e.target.value)}
          >
            {MATCH_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Overs</Label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            value={overs}
            onChange={(e) => setOvers(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            className="mt-1"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
      </div>

      {/* Advanced options */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Advanced options</span>
            <span className="text-xs text-muted-foreground">
              Ground · Pitch · Umpire · Scorer · Streaming
            </span>
          </div>
          {advOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {advOpen && (
          <div className="grid gap-4 border-t border-border p-5 md:grid-cols-2 lg:grid-cols-3">
            <FieldInput label="Ground" value={ground} onChange={setGround} />
            <FieldInput label="Pitch" value={pitch} onChange={setPitch} />
            <FieldInput label="Weather" value={weather} onChange={setWeather} />
            <FieldInput label="Scorer" value={scorer} onChange={setScorer} />
            <FieldInput label="Umpire" value={umpire} onChange={setUmpire} />
            <FieldInput label="Ball type" value={ballType} onChange={setBallType} placeholder="Leather / Tennis / Season" />
            <FieldInput
              label="Start time"
              value={scheduledTime}
              onChange={setScheduledTime}
              type="time"
            />
            <div>
              <Label>Visibility</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="private">Private</option>
                <option value="academy">Academy</option>
                <option value="public">Public</option>
              </select>
            </div>
            <FieldInput
              label="Streaming URL"
              value={streamingUrl}
              onChange={setStreamingUrl}
              placeholder="https://…"
            />
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Notes</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        <div className="mr-auto text-xs text-muted-foreground">
          {teamA?.name ?? "Team A"} vs {teamB?.name ?? "Team B"} · {matchFormat} · {overs} ov
        </div>
        <Button variant="ghost" asChild>
          <Link to="/match-center/matches">Cancel</Link>
        </Button>
        <Button
          size="lg"
          disabled={!teamAId || !teamBId || createM.isPending}
          onClick={() => createM.mutate()}
        >
          {createM.isPending ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Swords className="size-4 mr-1.5" />
          )}
          Start match
        </Button>
      </div>

      <CreateExternalTeamDialog
        open={externalBOpen}
        onOpenChange={setExternalBOpen}
        onCreated={(t) => setTeamBId(t.id)}
      />
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function StepCard({
  step,
  title,
  caption,
  children,
}: {
  step: number;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid size-6 place-items-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
        >
          {step}
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {caption && <span className="text-xs text-muted-foreground">· {caption}</span>}
      </div>
      {children}
    </div>
  );
}

function TeamPicker({
  teams,
  selectedId,
  onSelect,
  excludeId,
  allowExternal,
  onCreateExternal,
  loading,
}: {
  teams: TeamLite[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
  allowExternal?: boolean;
  onCreateExternal?: () => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = teams.filter(
    (t) =>
      t.id !== excludeId &&
      (q.trim() === "" || t.name.toLowerCase().includes(q.trim().toLowerCase())),
  );
  return (
    <div>
      <Input
        placeholder="Search teams…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No teams match
          </div>
        ) : (
          filtered.map((t) => (
            <TeamOptionCard
              key={t.id}
              team={t}
              selected={selectedId === t.id}
              onClick={() => onSelect(t.id)}
            />
          ))
        )}
      </div>
      {allowExternal && (
        <Button variant="outline" className="mt-3 w-full" onClick={onCreateExternal} type="button">
          <Plus className="size-4 mr-1.5" /> Create external team
        </Button>
      )}
    </div>
  );
}

function PlayingXICard({
  title,
  players,
  onChange,
}: {
  title: string;
  players: PlayerDraft[];
  onChange: (v: PlayerDraft[]) => void;
}) {
  const playing = players.filter((p) => !p.is_substitute);
  const over = playing.length > 11;
  const short = playing.length < 11 && players.length > 0;

  const toggleFlag = (idx: number, flag: "is_captain" | "is_vice_captain" | "is_keeper") => {
    onChange(
      players.map((p, i) => {
        if (i === idx) return { ...p, [flag]: !p[flag] };
        // Ensure only one captain / vice / keeper
        if (flag === "is_captain") return { ...p, is_captain: false };
        if (flag === "is_vice_captain") return { ...p, is_vice_captain: false };
        if (flag === "is_keeper") return { ...p, is_keeper: false };
        return p;
      }),
    );
  };

  const toggleSub = (idx: number) => {
    onChange(players.map((p, i) => (i === idx ? { ...p, is_substitute: !p.is_substitute } : p)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= players.length) return;
    const next = players.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <div className="text-xs text-muted-foreground">
            Playing XI · {playing.length}/11
            {over && <span className="ml-1 text-amber-600">More than 11 selected</span>}
            {short && <span className="ml-1 text-muted-foreground">Squad below 11</span>}
          </div>
        </div>
      </div>
      {players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No squad on this team yet. Add players from Team Management first.
        </div>
      ) : (
        <ol className="space-y-2">
          {players.map((p, idx) => (
            <li
              key={p.student_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-2",
                p.is_substitute ? "border-dashed border-border/60 opacity-70" : "border-border bg-background/40",
              )}
            >
              <span className="w-6 text-right text-xs font-mono text-muted-foreground">
                {idx + 1}
              </span>
              <Avatar src={p.photo_url} name={p.name} size={36} className="rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {p.is_captain && <RoleTag icon={Crown} label="C" tone="captain" />}
                  {p.is_vice_captain && <RoleTag icon={Star} label="VC" tone="vice" />}
                  {p.is_keeper && <RoleTag icon={Shield} label="WK" tone="keeper" />}
                  {p.is_substitute && (
                    <span className="rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      Sub
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconToggle
                  active={p.is_captain}
                  onClick={() => toggleFlag(idx, "is_captain")}
                  title="Captain"
                >
                  <Crown className="size-3.5" />
                </IconToggle>
                <IconToggle
                  active={p.is_vice_captain}
                  onClick={() => toggleFlag(idx, "is_vice_captain")}
                  title="Vice captain"
                >
                  <Star className="size-3.5" />
                </IconToggle>
                <IconToggle
                  active={p.is_keeper}
                  onClick={() => toggleFlag(idx, "is_keeper")}
                  title="Keeper"
                >
                  <Shield className="size-3.5" />
                </IconToggle>
                <IconToggle active={p.is_substitute} onClick={() => toggleSub(idx)} title="Substitute">
                  <span className="text-[10px] font-bold">SUB</span>
                </IconToggle>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ExternalPlayingXICard({
  title,
  players,
  onChange,
}: {
  title: string;
  players: PlayerDraft[];
  onChange: (v: PlayerDraft[]) => void;
}) {
  const [name, setName] = useState("");
  const playing = players.filter((p) => !p.is_substitute);
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([
      ...players,
      {
        student_id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        photo_url: null,
        is_captain: false,
        is_vice_captain: false,
        is_keeper: false,
        is_substitute: false,
      },
    ]);
    setName("");
  };
  const remove = (idx: number) => onChange(players.filter((_, i) => i !== idx));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <div className="text-xs text-muted-foreground">
          External Playing XI · {playing.length}/11
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add}>
          <Plus className="size-4" />
        </Button>
      </div>
      {players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Add opponent players by name.
        </div>
      ) : (
        <ol className="space-y-2">
          {players.map((p, idx) => (
            <li
              key={p.student_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2"
            >
              <span className="w-6 text-right text-xs font-mono text-muted-foreground">
                {idx + 1}
              </span>
              <Avatar src={null} name={p.name} size={32} className="rounded-lg" />
              <div className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RoleTag({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "captain" | "vice" | "keeper";
}) {
  const map = {
    captain: "bg-amber-500 text-white",
    vice: "bg-sky-500 text-white",
    keeper: "bg-violet-500 text-white",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        map[tone],
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function IconToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-md border transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ==================== External team dialog ==================== */

function CreateExternalTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (t: { id: string }) => void;
}) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    age_group: "",
    city: "",
    coach_name: "",
    logo_url: "",
  });

  useEffect(() => {
    if (open) setForm({ name: "", age_group: "", city: "", coach_name: "", logo_url: "" });
  }, [open]);

  const m = useMutation({
    mutationFn: () =>
      createExternalTeam({
        tenantId: tenant.id,
        name: form.name,
        age_group: form.age_group || undefined,
        city: form.city || undefined,
        coach_name: form.coach_name || undefined,
        logo_url: form.logo_url || undefined,
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["mc-all-teams", tenant.id] });
      onCreated({ id: row.id });
      onOpenChange(false);
      toast.success("External team added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create external team</DialogTitle>
          <DialogDescription>
            External teams aren't part of your academy roster. They stay under Match Center for
            opponent fixtures.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FieldInput
            label="Team name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Category / age group"
              value={form.age_group}
              onChange={(v) => setForm((f) => ({ ...f, age_group: v }))}
              placeholder="U16 · Senior…"
            />
            <FieldInput
              label="City"
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v }))}
            />
          </div>
          <FieldInput
            label="Coach"
            value={form.coach_name}
            onChange={(v) => setForm((f) => ({ ...f, coach_name: v }))}
          />
          <FieldInput
            label="Logo URL (optional)"
            value={form.logo_url}
            onChange={(v) => setForm((f) => ({ ...f, logo_url: v }))}
            placeholder="https://…"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!form.name.trim() || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="size-4 mr-1.5" />
            )}
            Add team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
