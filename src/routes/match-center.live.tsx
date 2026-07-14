import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, PlusCircle, MapPin, ChevronRight } from "lucide-react";
import { LoadingSkeleton } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/dashboard-context";
import { listMatches } from "@/lib/mc-matches";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

export const Route = createFileRoute("/match-center/live")({
  head: () => ({ meta: [{ title: "Live · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: LivePage,
});

function LivePage() {
  const { tenant } = useDashboard();
  const matchesQ = useQuery({
    queryKey: ["mc-matches", tenant.id],
    queryFn: () => listMatches(tenant.id),
    refetchInterval: 15000,
  });

  const overlaid = useDemoOverlay(tenant.id, matchesQ.data, (d) => d.matches);
  const live = useMemo(() => overlaid.filter((m) => m.status === "live"), [overlaid]);

  if (matchesQ.isLoading) {
    return <LoadingSkeleton rows={2} />;
  }

  if (live.length === 0) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div
            className="grid size-20 place-items-center rounded-3xl text-white"
            style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
          >
            <Radio className="size-9" strokeWidth={1.8} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[22px] font-semibold tracking-tight">No live match</h1>
            <p className="text-[14px] leading-snug text-muted-foreground">
              Start a new match and it will appear here instantly with score, overs and commentary.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 w-full rounded-2xl text-[15px] font-semibold">
            <Link to="/match-center/create">
              <PlusCircle className="mr-1.5 size-[18px]" /> Create Match
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {live.map((m) => (
        <LiveHeroCard key={m.id} match={m} />
      ))}
    </div>
  );
}

function LiveHeroCard({ match }: { match: ReturnType<typeof useDemoOverlay>[number] }) {
  const teamA = match.team_a?.name ?? "Team A";
  const teamB = match.team_b?.name ?? "Team B";
  const meta = [match.match_format, match.overs ? `${match.overs} ov` : null, match.match_type]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
      {/* Live strip */}
      <div className="flex items-center justify-between border-b border-border/60 bg-rose-500/5 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
          </span>
          Live
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{meta}</span>
      </div>

      {/* Score row */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0 text-left">
            <div className="truncate text-[17px] font-semibold tracking-tight">{teamA}</div>
            <div className="text-[13px] tabular-nums text-muted-foreground">—</div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            vs
          </div>
          <div className="min-w-0 text-right">
            <div className="truncate text-[17px] font-semibold tracking-tight">{teamB}</div>
            <div className="text-[13px] tabular-nums text-muted-foreground">—</div>
          </div>
        </div>
      </div>

      {/* Meta */}
      {match.ground_name && (
        <div className="flex items-center gap-1.5 px-4 pb-3 text-[12px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{match.ground_name}</span>
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-border/60 bg-muted/30 px-3 py-2.5">
        <Button
          asChild
          className="h-11 w-full rounded-xl text-[14px] font-semibold"
        >
          <Link to="/scorer/$matchId" params={{ matchId: match.id }}>
            <Radio className="mr-1.5 size-4" /> Resume Live Match
            <ChevronRight className="ml-auto size-4 opacity-80" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
