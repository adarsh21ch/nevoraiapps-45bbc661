import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  ClipboardList,
  Medal,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { cn } from "@/lib/utils";
import type { DemoData } from "@/lib/mc-demo/generate";
import { deriveTournament } from "@/lib/mc-demo/derive";

type DemoTournament = DemoData["tournaments"][number];

const TABS = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "fixtures", label: "Fixtures", icon: Calendar },
  { id: "standings", label: "Points Table", icon: BarChart3 },
  { id: "results", label: "Results", icon: Trophy },
  { id: "orange", label: "Orange Cap", icon: Award },
  { id: "purple", label: "Purple Cap", icon: Medal },
  { id: "records", label: "Records", icon: Sparkles },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Props {
  demo: DemoData;
  tournament: DemoTournament;
}

/**
 * Ball-event-derived tournament detail for a `demo-*` tournament.
 * Uses the shared derivation layer — same numbers as production would
 * produce for the same events.
 */
export function DemoTournamentDetail({ demo, tournament }: Props) {
  const summary = useMemo(
    () => deriveTournament(demo, tournament.id),
    [demo, tournament.id],
  );
  const [tab, setTab] = useState<TabId>("overview");

  const subtitle = [
    tournament.season,
    tournament.age_group,
    tournament.format,
    tournament.overs ? `${tournament.overs} overs` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/match-center/tournaments">
            <ArrowLeft className="size-4 mr-1.5" /> Tournaments
          </Link>
        </Button>
      </div>
      <PageHeader
        title={tournament.name}
        description={subtitle}
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Tournaments", to: "/match-center/tournaments" },
          { label: tournament.name },
        ]}
      />

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((x) => {
          const Icon = x.icon;
          const active = tab === x.id;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {x.label}
            </button>
          );
        })}
      </div>

      {!summary ? (
        <EmptyState
          icon={Trophy}
          title="No data yet"
          description="Tournament fixtures will appear once matches are seeded."
        />
      ) : tab === "overview" ? (
        <OverviewTab summary={summary} />
      ) : tab === "fixtures" ? (
        <FixturesTab rows={summary.fixtures} />
      ) : tab === "standings" ? (
        <StandingsTab rows={summary.standings} />
      ) : tab === "results" ? (
        <ResultsTab rows={summary.results} />
      ) : tab === "orange" ? (
        <OrangeCapTab rows={summary.orangeCap} />
      ) : tab === "purple" ? (
        <PurpleCapTab rows={summary.purpleCap} />
      ) : (
        <RecordsTab summary={summary} />
      )}
    </div>
  );
}

/* ---------------- Tabs ---------------- */

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

function OverviewTab({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof deriveTournament>>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card label="Teams" value={summary.teamsCount} />
      <Card label="Fixtures" value={summary.matchesTotal} />
      <Card label="Completed" value={summary.matchesPlayed} />
      <Card label="Remaining" value={summary.matchesTotal - summary.matchesPlayed} />
    </div>
  );
}

function FixturesTab({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof deriveTournament>>["fixtures"];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No fixtures yet"
        description="Fixtures appear here once tournament matches are scheduled."
      />
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((m) => (
        <Link
          key={m.matchId}
          to="/scorer/$matchId"
          params={{ matchId: m.matchId }}
          className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/30"
        >
          <div>
            <div className="text-sm font-medium">
              {m.teamAName} vs {m.teamBName}
            </div>
            <div className="text-xs text-muted-foreground">
              {m.date ?? "TBD"} {m.ground ? `· ${m.ground}` : ""}
            </div>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
            {m.status}
          </span>
        </Link>
      ))}
    </div>
  );
}

function StandingsTab({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof deriveTournament>>["standings"];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No standings yet"
        description="Standings populate automatically after finalized matches."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Team</th>
            <th className="px-3 py-2 text-right">P</th>
            <th className="px-3 py-2 text-right">W</th>
            <th className="px-3 py-2 text-right">L</th>
            <th className="px-3 py-2 text-right">T</th>
            <th className="px-3 py-2 text-right">Pts</th>
            <th className="px-3 py-2 text-right">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-t border-border">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.teamName}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.played}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.won}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.lost}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.tied}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.points}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.nrr.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsTab({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof deriveTournament>>["results"];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No results yet"
        description="Results appear after tournament matches are finalized."
      />
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((m) => (
        <div key={m.matchId} className="rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-medium">
            {m.teamAName} vs {m.teamBName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{m.result ?? ""}</div>
        </div>
      ))}
    </div>
  );
}

function OrangeCapTab({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof deriveTournament>>["orangeCap"];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No runs recorded"
        description="Finalized matches will populate the Orange Cap."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">M</th>
            <th className="px-3 py-2 text-right">Runs</th>
            <th className="px-3 py-2 text-right">Avg</th>
            <th className="px-3 py-2 text-right">SR</th>
            <th className="px-3 py-2 text-right">4s / 6s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.athleteId ?? r.name) + i} className="border-t border-border">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.matches}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.runs}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.average.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.strikeRate.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.fours} / {r.sixes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurpleCapTab({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof deriveTournament>>["purpleCap"];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Medal}
        title="No wickets recorded"
        description="Finalized matches will populate the Purple Cap."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">M</th>
            <th className="px-3 py-2 text-right">Wkts</th>
            <th className="px-3 py-2 text-right">Econ</th>
            <th className="px-3 py-2 text-right">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.athleteId ?? r.name) + i} className="border-t border-border">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.matches}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.wickets}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.economy.toFixed(2)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.average.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordsTab({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof deriveTournament>>;
}) {
  const item = (label: string, value: string) => (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
  const hi = summary.highestIndividualScore;
  const bb = summary.bestBowling;
  const htt = summary.highestTeamTotal;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {item("Highest Team Total", htt ? `${htt.teamName} · ${htt.runs}` : "—")}
      {item("Highest Individual Score", hi ? `${hi.name} · ${hi.runs} (${hi.balls})` : "—")}
      {item("Best Bowling", bb ? `${bb.name} · ${bb.wickets}/${bb.runs}` : "—")}
    </div>
  );
}
