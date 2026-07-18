import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { useMatchLive } from "@/hooks/use-match-live";
import { LiveScorecard } from "@/components/match-center/live-scorecard";
import { buildCommentary, ballChipLabel } from "@/lib/mc-commentary";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";
import { ArrowLeft, Radio } from "lucide-react";

export const Route = createFileRoute("/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Match" },
      { name: "description", content: "Live scorecard, commentary, and ball-by-ball updates." },
      { property: "og:title", content: "Live Match" },
      {
        property: "og:description",
        content: "Live scorecard, commentary, and ball-by-ball updates.",
      },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Match unavailable</h1>
      <p className="mt-2 text-muted-foreground">
        This match isn&apos;t published, or it may have been removed.
      </p>
      <Link to="/matches" className="mt-6 inline-block text-primary underline">
        Back to matches
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Match not found</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t find this match on the public schedule.
      </p>
      <Link to="/matches" className="mt-6 inline-block text-primary underline">
        Back to matches
      </Link>
    </div>
  ),
  component: () => (
    <TenantGate>
      <PublicMatchDetail />
    </TenantGate>
  ),
});

type PublicMatchDetailRow = {
  id: string;
  tenant_id: string;
  status: string;
  match_format: string | null;
  match_type: string | null;
  overs: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  ground_name: string | null;
  result: string | null;
  winner_team: string | null;
  toss_winner: string | null;
  toss_decision: string | null;
  team_a_id: string;
  team_b_id: string;
  visibility: string;
};

function PublicMatchDetail() {
  const tenant = useTenant();
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();

  const matchQ = useQuery({
    queryKey: ["public_match", matchId],
    queryFn: async (): Promise<PublicMatchDetailRow> => {
      const { data, error } = await supabase
        .from("mc_matches")
        .select(
          "id,tenant_id,status,match_format,match_type,overs,scheduled_date,scheduled_time,ground_name,result,winner_team,toss_winner,toss_decision,team_a_id,team_b_id,visibility",
        )
        .eq("id", matchId)
        .eq("visibility", "public")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      // Extra safety: match must belong to the tenant the visitor is viewing.
      if (data.tenant_id !== tenant.id) throw notFound();
      return data as PublicMatchDetailRow;
    },
  });

  const teamsQ = useQuery({
    queryKey: ["public_match_teams_detail", matchId],
    enabled: !!matchQ.data,
    queryFn: async () => {
      const ids = [matchQ.data!.team_a_id, matchQ.data!.team_b_id];
      const { data, error } = await supabase
        .from("mc_teams")
        .select("id,name,logo_url")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, { name: string; logo_url: string | null }> = {};
      (data ?? []).forEach((t) => {
        map[t.id] = { name: t.name, logo_url: (t as { logo_url: string | null }).logo_url };
      });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const inningsQ = useQuery({
    queryKey: ["public_match_innings_detail", matchId],
    queryFn: async (): Promise<MCInnings[]> => {
      const { data, error } = await supabase
        .from("mc_innings")
        .select("*")
        .eq("match_id", matchId)
        .order("innings_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MCInnings[];
    },
    staleTime: 5_000,
  });

  const ballsQ = useQuery({
    queryKey: ["public_match_balls", matchId],
    queryFn: async (): Promise<MCBallEvent[]> => {
      const { data, error } = await supabase
        .from("mc_ball_events")
        .select("*")
        .eq("match_id", matchId)
        .order("sequence_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MCBallEvent[];
    },
    staleTime: 5_000,
  });

  const listener = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["public_match", matchId] });
    queryClient.invalidateQueries({ queryKey: ["public_match_innings_detail", matchId] });
    queryClient.invalidateQueries({ queryKey: ["public_match_balls", matchId] });
  }, [queryClient, matchId]);
  useMatchLive(matchId, listener);

  if (matchQ.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-muted-foreground">
        Loading match…
      </div>
    );
  }
  if (!matchQ.data) return null;

  const match = matchQ.data;
  const teams = teamsQ.data ?? {};
  const homeName = teams[match.team_a_id]?.name ?? "Home";
  const awayName = teams[match.team_b_id]?.name ?? "Away";
  const allInnings = inningsQ.data ?? [];
  const allBalls = ballsQ.data ?? [];
  const currentInnings = allInnings[allInnings.length - 1] ?? null;
  const currentBalls = currentInnings
    ? allBalls.filter((b) => b.innings_id === currentInnings.id)
    : [];
  const isLive = match.status === "live" || match.status === "in_progress";

  const commentary = buildCommentary(currentBalls);

  // Group balls into overs (current innings only) for the timeline strip.
  const overs = new Map<number, MCBallEvent[]>();
  currentBalls.forEach((b) => {
    const list = overs.get(b.over_number) ?? [];
    list.push(b);
    overs.set(b.over_number, list);
  });
  const overRows = Array.from(overs.entries()).sort((a, b) => b[0] - a[0]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/matches"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to matches
      </Link>

      <div className="mt-4 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
              <Radio className="size-3" /> Live
            </span>
          )}
          {match.match_format && <span>{match.match_format}</span>}
          {match.match_type && <span>· {match.match_type}</span>}
          {match.scheduled_date && (
            <span>· {new Date(match.scheduled_date).toLocaleDateString()}</span>
          )}
          {match.ground_name && <span>· {match.ground_name}</span>}
        </div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {homeName} <span className="text-muted-foreground">vs</span> {awayName}
        </h1>
        {match.toss_winner && match.toss_decision && (
          <p className="mt-1 text-sm text-muted-foreground">
            Toss:{" "}
            {teams[match.toss_winner]?.name ?? "Winner"} chose to {match.toss_decision}
          </p>
        )}
        {match.result && (
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--brand)" }}>
            {match.result}
          </p>
        )}
      </div>

      {/* Scorecard for the current (or last) innings */}
      {currentInnings ? (
        <div className="mt-6 rounded-3xl border border-border/60 bg-card p-4 sm:p-6">
          <LiveScorecard
            events={currentBalls}
            innings={currentInnings}
            totalOvers={match.overs}
            hideHero={false}
            matchInfo={{
              ground: match.ground_name,
              format: match.match_format,
              date: match.scheduled_date,
              homeTeam: homeName,
              awayTeam: awayName,
              result: match.result,
            }}
          />
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-border/60 bg-card p-6 text-center text-muted-foreground">
          The match hasn&apos;t started yet.
        </div>
      )}

      {/* Over-by-over strip */}
      {overRows.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Over by over</h2>
          <div className="mt-3 space-y-2">
            {overRows.map(([overNo, balls]) => {
              const runs = balls.reduce(
                (n, b) => n + (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0),
                0,
              );
              return (
                <div
                  key={overNo}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2"
                >
                  <div className="w-16 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Over {overNo + 1}
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {balls.map((b) => {
                      const label = ballChipLabel(b);
                      const isWicket = !!b.dismissal_type;
                      const isBoundary =
                        !b.dismissal_type && ((b.runs_off_bat ?? 0) === 4 || (b.runs_off_bat ?? 0) === 6);
                      return (
                        <span
                          key={b.id}
                          className={
                            "inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums " +
                            (isWicket
                              ? "bg-red-500/15 text-red-600 dark:text-red-400"
                              : isBoundary
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-foreground")
                          }
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                  <div className="w-10 text-right text-sm font-bold tabular-nums">{runs}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Commentary */}
      {commentary.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Commentary</h2>
          <ul className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
            {commentary.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {c.over}
                </span>
                <span className="text-sm">{c.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
