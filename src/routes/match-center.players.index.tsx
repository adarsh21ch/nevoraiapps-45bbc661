import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, PlusCircle, UserPlus, Loader2 } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { AthleteCard } from "@/components/match-center/athlete-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/lib/dashboard-context";
import {
  listAthletes,
  listStudents,
  createAthlete,
  getAthleteByStudent,
  ageFromDob,
  PRIMARY_SPORTS,
  type StudentLite,
} from "@/lib/mc-athletes";
import { toast } from "sonner";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

export const Route = createFileRoute("/match-center/players/")({
  head: () => ({
    meta: [{ title: "Players · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const { tenant } = useDashboard();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const athletesQ = useQuery({
    queryKey: ["mc-athletes", tenant.id],
    queryFn: () => listAthletes(tenant.id),
  });

  const overlaid = useDemoOverlay(tenant.id, athletesQ.data, (d) => d.players);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return overlaid;
    return overlaid.filter((a) => {
      const s = a.student;
      return (
        s?.name?.toLowerCase().includes(needle) ||
        s?.player_id?.toLowerCase().includes(needle) ||
        a.primary_sport?.toLowerCase().includes(needle) ||
        a.cricket?.playing_role?.toLowerCase().includes(needle)
      );
    });
  }, [overlaid, q]);

  return (
    <div>
      <PageHeader
        title="Athletes"
        description="Central profiles for every player across every sport."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Athletes" },
        ]}
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4 mr-1.5" /> Create athlete profile
          </Button>
        }
      />
      <div className="mb-6 max-w-xl">
        <SearchBar
          placeholder="Search by name, player ID, sport or role…"
          onQuery={setQ}
        />
      </div>

      {athletesQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={User}
          title={q ? "No matching athletes" : "No athlete profiles yet"}
          description={
            q
              ? "Try a different name, player ID, sport or role."
              : "Every academy student can have an athlete profile. Create one to start tracking sport-specific data."
          }
          actionLabel={q ? undefined : "Create athlete profile"}
          onAction={q ? undefined : () => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <AthleteCard key={a.id} athlete={a} to={`/match-center/players/${a.id}`} />
          ))}
        </div>
      )}

      <CreateAthleteDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateAthleteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudentLite | null>(null);
  const [sport, setSport] = useState("cricket");

  const studentsQ = useQuery({
    queryKey: ["mc-students", tenant.id],
    queryFn: () => listStudents(tenant.id),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const list = studentsQ.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return list.slice(0, 40);
    return list
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.player_id?.toLowerCase().includes(needle) ||
          s.phone?.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [studentsQ.data, search]);

  const createM = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a student");
      const existing = await getAthleteByStudent(tenant.id, selected.id);
      if (existing) return existing;
      return createAthlete({
        tenant_id: tenant.id,
        student_id: selected.id,
        primary_sport: sport,
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["mc-athletes", tenant.id] });
      toast.success("Athlete profile ready");
      onOpenChange(false);
      setSelected(null);
      setSearch("");
      navigate({ to: `/match-center/players/${row.id}` });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create athlete profile</DialogTitle>
          <DialogDescription>
            Pick a student from your academy. Their profile becomes the anchor for every sport-specific detail.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Primary sport</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIMARY_SPORTS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSport(p.value)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (sport === p.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Student</Label>
            <Input
              className="mt-2"
              placeholder="Search by name, player ID, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {studentsQ.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No students match</div>
              ) : (
                filtered.map((s) => {
                  const age = ageFromDob(s.dob);
                  const active = selected?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s)}
                      className={
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors " +
                        (active ? "bg-primary/10" : "hover:bg-accent/60")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {s.player_id ?? "—"}
                          {age !== null && ` · ${age} yrs`}
                        </div>
                      </div>
                      {active && <span className="text-xs text-primary font-semibold">Selected</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selected || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            ) : (
              <PlusCircle className="size-4 mr-1.5" />
            )}
            Create profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
