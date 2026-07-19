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
  id: string;
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
  const [derived, setDerived] = useState<{ runs: number; wickets: number; overs: number; balls: number } | null>(null);
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
          setInnings(null);
          setDerived(null);
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
          .select("id,batting_team_id,runs,wickets,overs,balls")
          .eq("match_id", data.id)
          .order("innings_number", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: inn }) => {
            const row = (inn as Innings) ?? null;
            setInnings(row);
            if (!row?.id) {
              setDerived(null);
              return;
            }
            supabase
              .from("mc_ball_events")
              .select("runs_off_bat,extra_runs,is_legal_delivery,dismissal_type")
              .eq("innings_id", row.id)
              .then(({ data: balls }) => {
                if (!balls || balls.length === 0) {
                  setDerived(null);
                  return;
                }
                let runs = 0;
                let wickets = 0;
                let legal = 0;
                for (const b of balls as Array<{ runs_off_bat: number | null; extra_runs: number | null; is_legal_delivery: boolean | null; dismissal_type: string | null }>) {
                  runs += (b.runs_off_bat ?? 0) + (b.extra_runs ?? 0);
                  if (b.is_legal_delivery) legal += 1;
                  if (b.dismissal_type) wickets += 1;
                }
                setDerived({ runs, wickets, overs: Math.floor(legal / 6), balls: legal % 6 });
              });
          });
      });
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  useMatchLive(match?.id ?? null, load);

  if (!match || dismissed) return null;

  const battingName = innings ? teams[innings.batting_team_id] ?? "Batting" : "";
  const nameA = teams[match.team_a_id] ?? "Team A";
  const nameB = teams[match.team_b_id] ?? "Team B";
  const score = derived ?? (innings ? { runs: innings.runs, wickets: innings.wickets, overs: innings.overs, balls: innings.balls } : null);

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
          {innings && score ? (
            <>
              {" "}
              · <span className="font-semibold">{battingName}</span>{" "}
              <span className="tabular-nums">
                {score.runs}/{score.wickets}
              </span>
              <span className="opacity-80">
                {" "}
                ({score.overs}.{score.balls})
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
