import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { useMatchLive } from "@/hooks/use-match-live";

type LiveMatch = {
  id: string;
  team_a_id: string;
  team_b_id: string;
};

type Innings = {
  batting_team_id: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
};

type TeamMap = Record<string, string>;

/**
 * Thin dismissible banner shown above the public SiteHeader when a live match
 * exists for the current tenant. Realtime-subscribed to ball events.
 */
export function LiveMatchBanner() {
  const tenant = useTenant();
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [teams, setTeams] = useState<TeamMap>({});
  const [innings, setInnings] = useState<Innings | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = () => {
    supabase
      .from("mc_matches")
      .select("id,team_a_id,team_b_id")
      .eq("tenant_id", tenant.id)
      .eq("visibility", "public")
      .in("status", ["live", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setMatch(null);
          return;
        }
        setMatch(data as LiveMatch);
        supabase
          .from("mc_teams")
          .select("id,name")
          .in("id", [data.team_a_id, data.team_b_id])
          .then(({ data: t }) => {
            const map: TeamMap = {};
            (t ?? []).forEach((r: { id: string; name: string }) => {
              map[r.id] = r.name;
            });
            setTeams(map);
          });
        supabase
          .from("mc_innings")
          .select("batting_team_id,runs,wickets,overs,balls")
          .eq("match_id", data.id)
          .order("innings_number", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: inn }) => setInnings((inn as Innings) ?? null));
      });
  };

  useEffect(() => {
    load();
    // Poll every 30s in case a match goes live from another device
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  useMatchLive(match?.id ?? null, load);

  if (!match || dismissed) return null;

  const battingName = innings ? teams[innings.batting_team_id] ?? "Batting" : "";
  const nameA = teams[match.team_a_id] ?? "Team A";
  const nameB = teams[match.team_b_id] ?? "Team B";

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match.id }}
      className="group relative block w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white"
    >
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2 text-sm sm:px-8">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-white" />
        </span>
        <Radio className="size-4 shrink-0" />
        <span className="font-semibold tracking-wide">LIVE</span>
        <span className="truncate">
          {nameA} <span className="opacity-80">vs</span> {nameB}
          {innings ? (
            <>
              {" "}
              · <span className="font-semibold">{battingName}</span>{" "}
              <span className="tabular-nums">
                {innings.runs}/{innings.wickets}
              </span>
              <span className="opacity-80">
                {" "}
                ({innings.overs}.{innings.balls})
              </span>
            </>
          ) : null}
        </span>
        <span className="ml-auto hidden shrink-0 rounded-full border border-white/40 bg-white/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest backdrop-blur group-hover:bg-white/20 sm:inline">
          Watch live
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDismissed(true);
          }}
          className="rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
          aria-label="Dismiss live banner"
        >
          ×
        </button>
      </div>
    </Link>
  );
}
