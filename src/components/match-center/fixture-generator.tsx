/* ================================================================
 * Fixture Generator Dialog — configure + preview + persist
 * ----------------------------------------------------------------
 * Thin UI over the Fixture Engine. Never owns any tournament logic.
 * ================================================================ */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Loader2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MCTournament } from "@/lib/mc-tournaments";
import { listTournamentTeams } from "@/lib/mc-tournaments";
import {
  evaluateReadiness,
  listGroups,
  listVenues,
  listOfficials,
} from "@/lib/mc-tournament-setup";
import {
  generateFixtures,
  persistFixturePlan,
  assignOfficials,
  validateFixturePlan,
  type FixturePlan,
  type GroupTeamMap,
} from "@/lib/mc-fixture-engine";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tournament: MCTournament;
  tenantId: string;
  createdBy?: string | null;
  onGenerated?: () => void;
}

export function FixtureGeneratorDialog({
  open,
  onOpenChange,
  tournament,
  tenantId,
  createdBy,
  onGenerated,
}: Props) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState(
    tournament.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const [slotsPerDay, setSlotsPerDay] = useState(2);
  const [duration, setDuration] = useState(210);
  const [restDays, setRestDays] = useState(0);
  const [dayStart, setDayStart] = useState("10:00");
  const [doubleLeg, setDoubleLeg] = useState(false);
  const [qualifiers, setQualifiers] = useState(2);
  const [seeding, setSeeding] = useState<"standard" | "sequential">("standard");
  const [autoOfficials, setAutoOfficials] = useState(true);
  const [regenerate, setRegenerate] = useState(true);

  const registeredQ = useQuery({
    queryKey: ["mc-tournament-teams", tournament.id],
    queryFn: () => listTournamentTeams(tournament.id),
    enabled: open,
  });
  const groupsQ = useQuery({
    queryKey: ["mc-tournament-groups", tournament.id],
    queryFn: () => listGroups(tournament.id),
    enabled: open,
  });
  const venuesQ = useQuery({
    queryKey: ["mc-tournament-venues", tournament.id],
    queryFn: () => listVenues(tournament.id),
    enabled: open,
  });
  const officialsQ = useQuery({
    queryKey: ["mc-tournament-officials", tournament.id],
    queryFn: () => listOfficials(tournament.id),
    enabled: open,
  });
  const readinessQ = useQuery({
    queryKey: ["mc-tournament-readiness", tournament.id, tournament.has_groups],
    queryFn: () =>
      evaluateReadiness({
        tournamentId: tournament.id,
        hasGroups: tournament.has_groups,
      }),
    enabled: open,
  });

  const preview = useMemo<{
    fixtures: FixturePlan[];
    warnings: string[];
    issues: string[];
  }>(() => {
    const teams = registeredQ.data ?? [];
    const registeredTeamIds = teams.map((t) => t.team_id);
    const groups = groupsQ.data ?? [];
    const venues = venuesQ.data ?? [];
    const groupTeamMap: GroupTeamMap[] = groups.map((g) => ({
      group: g,
      teamIds: teams.filter((t) => t.group_id === g.id).map((t) => t.team_id),
    }));
    const { fixtures, warnings } = generateFixtures({
      tournament,
      registeredTeamIds,
      groupTeamMap,
      options: {
        doubleLeg,
        qualifiersPerGroup: qualifiers,
        seedingStrategy: seeding,
      },
      schedule: {
        startDate,
        slotsPerDay,
        matchDurationMinutes: duration,
        restDaysBetweenMatches: restDays,
        dayStartTime: dayStart,
        venues,
      },
    });
    const issues = validateFixturePlan(fixtures).map((i) => i.message);
    return { fixtures, warnings, issues };
  }, [
    tournament,
    registeredQ.data,
    groupsQ.data,
    venuesQ.data,
    doubleLeg,
    qualifiers,
    seeding,
    startDate,
    slotsPerDay,
    duration,
    restDays,
    dayStart,
  ]);

  const playable = preview.fixtures.filter((f) => f.team_a_id && f.team_b_id).length;
  const placeholders = preview.fixtures.length - playable;

  const canGenerate = readinessQ.data?.canGenerateFixtures ?? false;
  const failing = (readinessQ.data?.checks ?? []).filter((c) => c.status === "fail");

  const run = useMutation({
    mutationFn: async () => {
      const officialsMap = autoOfficials
        ? assignOfficials(preview.fixtures, officialsQ.data ?? [])
        : {};
      await persistFixturePlan(preview.fixtures, {
        tenantId,
        tournamentId: tournament.id,
        overs: tournament.overs,
        matchFormat: tournament.format,
        createdBy: createdBy ?? null,
        officials: officialsMap,
        regenerate,
      });
    },
    onSuccess: () => {
      toast.success(`${playable} fixtures generated`);
      qc.invalidateQueries({ queryKey: ["mc-tournament-fixtures", tournament.id] });
      qc.invalidateQueries({ queryKey: ["mc-tournament-readiness", tournament.id] });
      onGenerated?.();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate fixtures</DialogTitle>
          <DialogDescription>
            Configure scheduling and format options. All logic runs through the shared Fixture
            Engine — matches launch straight into Match Center.
          </DialogDescription>
        </DialogHeader>

        {failing.length > 0 && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <div className="font-medium text-destructive">Setup incomplete</div>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {failing.map((c) => (
                <li key={c.id}>
                  {c.label}
                  {c.detail ? ` — ${c.detail}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Day starts at</Label>
            <Input type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Matches per day</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={slotsPerDay}
              onChange={(e) => setSlotsPerDay(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={30}
              value={duration}
              onChange={(e) => setDuration(Math.max(30, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rest days between team's matches</Label>
            <Input
              type="number"
              min={0}
              max={7}
              value={restDays}
              onChange={(e) => setRestDays(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bracket seeding</Label>
            <Select
              value={seeding}
              onValueChange={(v) => setSeeding(v as "standard" | "sequential")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (1v8, 4v5…)</SelectItem>
                <SelectItem value="sequential">Sequential (1v2, 3v4…)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tournament.has_groups && tournament.has_knockout && (
            <div className="space-y-1.5">
              <Label>Qualifiers per group</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={qualifiers}
                onChange={(e) => setQualifiers(Math.max(1, Number(e.target.value)))}
              />
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={doubleLeg} onCheckedChange={(v) => setDoubleLeg(!!v)} />
            Double round robin (home & away)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={autoOfficials} onCheckedChange={(v) => setAutoOfficials(!!v)} />
            Auto-assign officials
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={regenerate} onCheckedChange={(v) => setRegenerate(!!v)} />
            Replace existing generated fixtures (scored matches are kept)
          </label>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {preview.fixtures.length} fixture{preview.fixtures.length === 1 ? "" : "s"} planned
              </div>
              <div className="text-xs text-muted-foreground">
                {playable} playable · {placeholders} placeholder
                {placeholders === 1 ? "" : "s"}
              </div>
            </div>
            <Calendar className="size-4 text-muted-foreground" />
          </div>
          {(preview.warnings.length > 0 || preview.issues.length > 0) && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-600 dark:text-amber-400">
              {[...preview.warnings, ...preview.issues].map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => run.mutate()}
            disabled={run.isPending || !canGenerate || playable === 0}
          >
            {run.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Zap className="mr-2 size-4" />
            )}
            Generate {playable > 0 ? `${playable} matches` : "fixtures"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
