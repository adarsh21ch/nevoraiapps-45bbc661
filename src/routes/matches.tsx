import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { useMatchLive } from "@/hooks/use-match-live";
import { Calendar, Radio } from "lucide-react";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Matches" },
      { name: "description", content: "Upcoming, live, and recent match results." },
      { property: "og:title", content: "Matches" },
      { property: "og:description", content: "Upcoming, live, and recent match results." },
    ],
  }),
  component: () => (
    <TenantGate>
      <MatchesPage />
    </TenantGate>
  ),
});

type PublicMatchRow = {
  id: string;
  status: string;
  match_format: string | null;
  match_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  ground_name: string | null;
  result: string | null;
  winner_team: string | null;
  team_a_id: string;
  team_b_id: string;
};

type TeamNameMap = Record<string, { name: string; logo_url: string | null }>;

function formatDate(d: string | null): string {
  if (!d) return "TBA";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MatchesPage() {
  const tenant = useTenant();
  const queryClient = useQueryClient();

  const matchesQ = useQuery({
    queryKey: ["public_matches", tenant.id],
    queryFn: async (): Promise<PublicMatchRow[]> => {
      const { data, error } = await supabase
        .from("mc_matches")
        .select(
          "id,status,match_format,match_type,scheduled_date,scheduled_time,ground_name,result,winner_team,team_a_id,team_b_id",
        )
        .eq("tenant_id", tenant.id)
        .eq("visibility", "public")
        .order("scheduled_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as PublicMatchRow[];
    },
    staleTime: 30_000,
  });

  const matches = matchesQ.data ?? [];
  const teamIds = Array.from(new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id])));

  const teamsQ = useQuery({
    queryKey: ["public_match_teams", tenant.id, teamIds.sort().join(",")],
    enabled: teamIds.length > 0,
    queryFn: async (): Promise<TeamNameMap> => {
      const { data, error } = await supabase
        .from("mc_teams")
        .select("id,name,logo_url")
        .in("id", teamIds);
      if (error) throw error;
      const map: TeamNameMap = {};
      (data ?? []).forEach((t) => {
        map[t.id] = { name: t.name, logo_url: (t as { logo_url: string | null }).logo_url };
      });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const teams = teamsQ.data ?? {};
  const live = matches.filter((m) => m.status === "live" || m.status === "in_progress");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const recent = matches.filter((m) => m.status === "finalized" || m.status === "completed");

  const teamName = (id: string) => teams[id]?.name ?? "Team";

  return (
    <>
      <PageHero
        eyebrow="Fixtures & results"
        title="Matches"
        subtitle={`Follow ${tenant.name} on the field.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 space-y-14">
        {live.length > 0 && (
          <section>
            <div className="flex items-center gap-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-red-500" />
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Live Now</h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {live.map((m) => (
                <LiveMatchCard
                  key={m.id}
                  match={m}
                  homeName={teamName(m.team_a_id)}
                  awayName={teamName(m.team_b_id)}
                  onInvalidate={() =>
                    queryClient.invalidateQueries({ queryKey: ["public_matches", tenant.id] })
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No upcoming matches scheduled.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {upcoming.map((m) => (
                <Link
                  key={m.id}
                  to="/matches/$matchId"
                  params={{ matchId: m.id }}
                  className="block rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {formatDate(m.scheduled_date)}
                    {m.match_format && <span>· {m.match_format}</span>}
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {teamName(m.team_a_id)} <span className="text-muted-foreground">vs</span>{" "}
                    {teamName(m.team_b_id)}
                  </div>
                  {m.ground_name && (
                    <div className="mt-1 text-sm text-muted-foreground">{m.ground_name}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Recent Results</h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No completed matches yet.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {recent.map((m) => (
                <Link
                  key={m.id}
                  to="/matches/$matchId"
                  params={{ matchId: m.id }}
                  className="block rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/50 hover:shadow-md"
                >
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {formatDate(m.scheduled_date)}
                    {m.match_format && <span> · {m.match_format}</span>}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {teamName(m.team_a_id)} <span className="text-muted-foreground">vs</span>{" "}
                    {teamName(m.team_b_id)}
                  </div>
                  {m.result && <div className="mt-2 text-sm">{m.result}</div>}
                  {m.winner_team && (
                    <div className="mt-1 text-sm font-medium" style={{ color: "var(--brand)" }}>
                      Winner: {m.winner_team}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function LiveMatchCard({
  match,
  homeName,
  awayName,
  onInvalidate,
}: {
  match: PublicMatchRow;
  homeName: string;
  awayName: string;
  onInvalidate: () => void;
}) {
  const inningsQ = useQuery({
    queryKey: ["public_match_innings", match.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_innings")
        .select("id,innings_number,batting_team_id,runs,wickets,overs,balls")
        .eq("match_id", match.id)
        .order("innings_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });

  const listener = useCallback(() => {
    onInvalidate();
  }, [onInvalidate]);
  useMatchLive(match.id, listener);

  const innings = inningsQ.data ?? [];
  const current = innings[innings.length - 1];
  const battingName = current
    ? current.batting_team_id === match.team_a_id
      ? homeName
      : awayName
    : null;

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match.id }}
      className="block rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-500/10 via-card to-card p-6 shadow-sm transition hover:border-red-500/70"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">
        <Radio className="size-3.5" />
        Live
        {match.match_format && (
          <span className="text-muted-foreground">· {match.match_format}</span>
        )}
      </div>
      <div className="mt-2 text-lg font-semibold">
        {homeName} <span className="text-muted-foreground">vs</span> {awayName}
      </div>
      {current ? (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {battingName}
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums">
            {current.runs}
            <span className="text-muted-foreground">/</span>
            {current.wickets}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              ({current.overs}.{current.balls})
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">Innings starting…</div>
      )}
      {match.ground_name && (
        <div className="mt-2 text-xs text-muted-foreground">{match.ground_name}</div>
      )}
    </Link>
  );
}
