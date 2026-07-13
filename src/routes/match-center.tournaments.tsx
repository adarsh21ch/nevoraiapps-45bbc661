import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, PlusCircle, Loader2, Search, Calendar } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDashboard } from "@/lib/dashboard-context";
import {
  listTournaments,
  createTournament,
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  type MCTournament,
} from "@/lib/mc-tournaments";
import { AGE_GROUPS } from "@/lib/mc-teams";

export const Route = createFileRoute("/match-center/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["mc-tournaments", tenant.id],
    queryFn: () => listTournaments(tenant.id),
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search.trim()) return list;
    const s = search.trim().toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        (t.season ?? "").toLowerCase().includes(s) ||
        (t.age_group ?? "").toLowerCase().includes(s),
    );
  }, [q.data, search]);

  return (
    <div>
      <PageHeader
        title="Tournaments"
        description="Leagues, knockouts and series run under your academy."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Tournaments" },
        ]}
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusCircle className="size-4 mr-1.5" /> Create tournament
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search tournaments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {q.isLoading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={q.data && q.data.length > 0 ? "No matches" : "No tournaments yet"}
          description={
            q.data && q.data.length > 0
              ? "Try a different search term."
              : "Set up a tournament with fixtures, brackets and standings."
          }
          actionLabel="Create tournament"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </div>
      )}

      <CreateTournamentDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["mc-tournaments", tenant.id] });
        }}
      />
    </div>
  );
}

function TournamentCard({ t }: { t: MCTournament }) {
  return (
    <Link
      to="/match-center/tournaments/$tournamentId"
      params={{ tournamentId: t.id }}
      className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{t.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {[t.season, t.age_group, t.format].filter(Boolean).join(" · ")}
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
          {t.status}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="size-3.5" />
        {t.start_date ?? "TBD"} – {t.end_date ?? "TBD"}
      </div>
    </Link>
  );
}

function CreateTournamentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { tenant, session } = useDashboard();
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [ageGroup, setAgeGroup] = useState<string>("Senior");
  const [format, setFormat] = useState<string>("T20");
  const [overs, setOvers] = useState(20);
  const [type, setType] = useState<string>("league");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pointsWin, setPointsWin] = useState(2);
  const [pointsTie, setPointsTie] = useState(1);
  const [pointsLoss, setPointsLoss] = useState(0);
  const [pointsNR, setPointsNR] = useState(1);
  const [maxTeams, setMaxTeams] = useState(16);
  const [ground, setGround] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      return await createTournament({
        tenant_id: tenant.id,
        name: name.trim(),
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        season: season.trim() || null,
        age_group: ageGroup,
        tournament_type: type,
        format,
        overs,
        start_date: startDate || null,
        end_date: endDate || null,
        ground_name: ground.trim() || null,
        points_for_win: pointsWin,
        points_for_tie: pointsTie,
        points_for_loss: pointsLoss,
        points_for_no_result: pointsNR,
        max_teams: maxTeams,
        created_by: session?.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Tournament created");
      onCreated();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create tournament</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Season">
            <Input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2025"
            />
          </Field>
          <Field label="Age group">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
            >
              {AGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TOURNAMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {TOURNAMENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Overs">
            <Input
              type="number"
              value={overs}
              onChange={(e) => setOvers(Number(e.target.value) || 20)}
            />
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Field label="Ground">
            <Input value={ground} onChange={(e) => setGround(e.target.value)} />
          </Field>
          <Field label="Max teams">
            <Input
              type="number"
              value={maxTeams}
              onChange={(e) => setMaxTeams(Number(e.target.value) || 16)}
            />
          </Field>
          <Field label="Logo URL">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </Field>
          <Field label="Points: Win / Tie / Loss / NR">
            <div className="flex gap-1">
              <Input
                type="number"
                value={pointsWin}
                onChange={(e) => setPointsWin(Number(e.target.value))}
              />
              <Input
                type="number"
                value={pointsTie}
                onChange={(e) => setPointsTie(Number(e.target.value))}
              />
              <Input
                type="number"
                value={pointsLoss}
                onChange={(e) => setPointsLoss(Number(e.target.value))}
              />
              <Input
                type="number"
                value={pointsNR}
                onChange={(e) => setPointsNR(Number(e.target.value))}
              />
            </div>
          </Field>
          <div className="md:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
