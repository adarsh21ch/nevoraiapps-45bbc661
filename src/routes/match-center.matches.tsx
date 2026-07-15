import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { MatchCard } from "@/components/match-center/match-ui";
import {
  listMatches,
  updateMatchStatus,
  deleteMatch,
  duplicateMatch,
  MATCH_STATUSES,
  type MatchWithTeams,
} from "@/lib/mc-matches";
import { useDashboard } from "@/lib/dashboard-context";
import { toast } from "sonner";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";
import { cn } from "@/lib/utils";
import { VirtualList } from "@/components/ds/VirtualList";

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
  const filters = [{ value: "all", label: "All" }, ...MATCH_STATUSES];

  return (
    <div className="min-w-0">
      {/* Search — 44px iOS-style */}
      <SearchBar placeholder="Search matches" onQuery={setQ} />

      {/* Filter chips — single-row horizontal scroll, never wraps */}
      <div className="chip-strip -mx-3 mt-3 px-3">
        {filters.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors no-tap-highlight",
                active
                  ? "border-transparent bg-foreground text-background"
                  : "border-border/70 bg-card text-foreground/80 active:bg-accent/50",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {matchesQ.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Swords}
            title={hasMatches ? "No matches match your filters" : "No matches yet"}
            description={
              hasMatches
                ? "Try a different search term or clear the status filter."
                : "Create your first match to see fixtures and results here."
            }
            actionLabel={hasMatches ? undefined : "Create match"}
            actionTo={hasMatches ? undefined : "/match-center/create"}
          />
        ) : (
          <VirtualList
            items={filtered}
            estimateSize={140}
            overscan={6}
            className="max-h-[calc(100vh-220px)]"
            containerClassName="pb-2.5 pr-0.5"
            getKey={(m) => m.id}
            renderItem={(m) => (
              <MatchCard
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
            )}
          />

        )}
      </div>
    </div>
  );
}
