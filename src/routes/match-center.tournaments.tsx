import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, PlusCircle, Search, Calendar } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/lib/dashboard-context";
import { listTournaments, type MCTournament } from "@/lib/mc-tournaments";
import { TournamentWizard } from "@/components/match-center/tournament-wizard";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

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

  const overlaid = useDemoOverlay(tenant.id, q.data, (d) => d.tournaments);

  const filtered = useMemo(() => {
    if (!search.trim()) return overlaid;
    const s = search.trim().toLowerCase();
    return overlaid.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        (t.season ?? "").toLowerCase().includes(s) ||
        (t.age_group ?? "").toLowerCase().includes(s),
    );
  }, [overlaid, search]);

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

      <TournamentWizard
        open={open}
        onOpenChange={setOpen}
        tenantId={tenant.id}
        createdBy={null}
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

