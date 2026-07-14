import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Swords, Trophy, Calendar, MapPin, Medal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyStudentContext, fetchStudentMatches, studentKeys } from "@/lib/student-app";
import type { PlayerMatchAppearance } from "@/lib/player-profile";

export const Route = createFileRoute("/student/matches")({
  component: StudentMatchesPage,
});

function StudentMatchesPage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyStudentContext });
  const ctx = ctxQ.data;
  const q = useQuery({
    queryKey: ctx ? studentKeys.matches(ctx.student_id) : ["student", "matches", "none"],
    queryFn: () => fetchStudentMatches(ctx!),
    enabled: !!ctx,
  });

  if (!ctx || q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  const data = q.data!;
  const c = data.career;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
          <Swords className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Matches</h1>
          <p className="text-xs text-muted-foreground">Your matches, career and awards.</p>
        </div>
      </header>

      {/* Career summary */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Career Summary
        </p>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Matches" value={c?.matches ?? 0} />
          <Stat label="Runs" value={c?.runs ?? 0} />
          <Stat label="Wickets" value={c?.wickets ?? 0} />
          <Stat label="PoM" value={c?.player_of_match ?? 0} />
        </div>
      </Card>

      {/* Upcoming */}
      <section aria-label="Upcoming matches">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Upcoming
        </p>
        {data.upcoming.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No upcoming matches.</Card>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((m) => (
              <MatchRow key={m.id} m={m} upcoming />
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section aria-label="Recent matches">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Recent
        </p>
        {data.recent.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No matches played yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {data.recent.slice(0, 10).map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>

      {/* Awards */}
      {data.awards.length > 0 && (
        <section aria-label="Awards">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Awards
          </p>
          <div className="space-y-2">
            {data.awards.map((a) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-amber-500/15 grid place-items-center text-amber-600 dark:text-amber-400">
                  <Medal className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.event_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.event_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function MatchRow({ m, upcoming = false }: { m: PlayerMatchAppearance; upcoming?: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-full bg-muted grid place-items-center shrink-0">
          {m.is_player_of_match ? (
            <Trophy className="size-4 text-amber-500" />
          ) : (
            <Swords className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">
              {m.match?.match_format ?? "Match"}
            </p>
            {m.is_captain && (
              <Badge variant="secondary" className="text-[10px]">
                Captain
              </Badge>
            )}
            {m.is_keeper && (
              <Badge variant="secondary" className="text-[10px]">
                Keeper
              </Badge>
            )}
            {m.is_player_of_match && (
              <Badge className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">
                Player of the Match
              </Badge>
            )}
            {upcoming && (
              <Badge variant="outline" className="text-[10px]">
                Upcoming
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {m.match?.scheduled_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(m.match.scheduled_date).toLocaleDateString()}
              </span>
            )}
            {m.match?.ground_name && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="size-3" />
                {m.match.ground_name}
              </span>
            )}
          </div>
          {m.match?.result && (
            <p className="text-xs mt-1 text-foreground/80">{m.match.result}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
