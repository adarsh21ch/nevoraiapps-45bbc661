import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords, PlusCircle } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { MatchCard } from "@/components/match-center/match-ui";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/dashboard-context";
import {
  listMatches,
  updateMatchStatus,
  deleteMatch,
  duplicateMatch,
  MATCH_STATUSES,
  type MatchWithTeams,
} from "@/lib/mc-matches";
import { toast } from "sonner";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

export const Route = createFileRoute("/match-center/matches")({
  head: () => ({
    meta: [{ title: "Matches · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const matchesQ = useQuery({
    queryKey: ["mc-matches", tenant.id],
    queryFn: () => listMatches(tenant.id),
  });

  const overlaid = useDemoOverlay(tenant.id, matchesQ.data, (d) => d.matches);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return overlaid.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (!needle) return true;
      return (
        m.team_a?.name?.toLowerCase().includes(needle) ||
        m.team_b?.name?.toLowerCase().includes(needle) ||
        m.ground_name?.toLowerCase().includes(needle) ||
        m.scheduled_date?.includes(needle) ||
        m.match_type?.toLowerCase().includes(needle)
      );
    });
  }, [overlaid, q, status]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mc-matches", tenant.id] });

  const onArchive = async (m: MatchWithTeams) => {
    await updateMatchStatus(m.id, "archived");
    toast.success("Match archived");
    invalidate();
  };
  const onDelete = async (m: MatchWithTeams) => {
    if (!confirm("Delete this match? This cannot be undone.")) return;
    await deleteMatch(m.id);
    toast.success("Match deleted");
    invalidate();
  };
  const onDuplicate = async (m: MatchWithTeams) => {
    await duplicateMatch(tenant.id, m.id);
    toast.success("Match duplicated");
    invalidate();
  };

  const hasMatches = overlaid.length > 0;

  return (
    <div>
      <PageHeader
        title="Matches"
        description="Every fixture — upcoming, live and completed."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Matches" },
        ]}
        actions={
          <Button asChild>
            <Link to="/match-center/create">
              <PlusCircle className="size-4 mr-1.5" /> Create match
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="max-w-xl flex-1">
          <SearchBar
            placeholder="Search matches by team, ground, date…"
            onQuery={setQ}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: "all", label: "All" }, ...MATCH_STATUSES].map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                (status === s.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent")
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {matchesQ.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Swords}
          title={hasMatches ? "No matches match your filters" : "No matches yet"}
          description={
            hasMatches
              ? "Try a different search term or clear the status filter."
              : "Create your first match to see it here. Fixtures, results and scorecards will all live in this list."
          }
          actionLabel={hasMatches ? undefined : "Create match"}
          actionTo={hasMatches ? undefined : "/match-center/create"}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              onArchive={onArchive}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onEdit={() => navigate({ to: "/match-center/create" })}
              onStart={async (mm) => {
                await updateMatchStatus(mm.id, "live");
                toast.success("Match marked live");
                invalidate();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
