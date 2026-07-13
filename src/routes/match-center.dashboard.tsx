import { createFileRoute } from "@tanstack/react-router";
import {
  Radio,
  CalendarClock,
  History,
  Star,
  Award,
  Trophy,
  PlusCircle,
  Users2,
  Swords,
  Search,
  Activity,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import {
  QuickActionCard,
  DashboardCard,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/match-center/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: MatchCenterDashboard,
});

function MatchCenterDashboard() {
  return (
    <div>
      <PageHeader
        title="Match Center"
        description="Your live sports hub — matches, teams, players, tournaments and awards, all in one place."
        breadcrumbs={[{ label: "Academy OS", to: "/dashboard" }, { label: "Match Center" }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/match-center/matches">
                <Swords className="size-4 mr-1.5" /> All matches
              </Link>
            </Button>
            <Button asChild>
              <Link to="/match-center/create">
                <PlusCircle className="size-4 mr-1.5" /> Start match
              </Link>
            </Button>
          </>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Live now" value="0" icon={Radio} hint="No live matches" />
        <StatCard label="This week" value="0" icon={CalendarClock} hint="Upcoming matches" />
        <StatCard label="Teams" value="0" icon={Users2} hint="Active squads" />
        <StatCard label="Players" value="0" icon={Star} hint="On the roster" />
      </div>

      {/* Quick actions */}
      <SectionTitle title="Quick actions" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        <QuickActionCard
          icon={Zap}
          title="Start match"
          description="Launch a new match with live scoring."
          to="/match-center/create"
        />
        <QuickActionCard
          icon={Users2}
          title="Create team"
          description="Add a squad and its players."
          to="/match-center/teams"
          accent="muted"
        />
        <QuickActionCard
          icon={Trophy}
          title="Create tournament"
          description="Set up a league or knockout."
          to="/match-center/tournaments"
          accent="muted"
        />
        <QuickActionCard
          icon={Search}
          title="Search player"
          description="Find any player across your academy."
          to="/match-center/players"
          accent="muted"
        />
        <QuickActionCard
          icon={Swords}
          title="View matches"
          description="Browse fixtures, results and highlights."
          to="/match-center/matches"
          accent="muted"
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <DashboardCard
          title="Live matches"
          action={
            <Link
              to="/match-center/live"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          }
          className="lg:col-span-2"
        >
          <EmptyState
            icon={Radio}
            title="No live matches"
            description="When a match is in progress you'll see the live score, over and status here."
            actionLabel="Start a match"
            actionTo="/match-center/create"
          />
        </DashboardCard>

        <DashboardCard title="Recent activity">
          <EmptyState
            icon={Activity}
            title="Nothing yet"
            description="Match events, wickets and boundaries will show here as they happen."
          />
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <DashboardCard title="Upcoming matches">
          <EmptyState
            icon={CalendarClock}
            title="No upcoming matches"
            description="Schedule a match to see fixtures here."
            actionLabel="Create match"
            actionTo="/match-center/create"
          />
        </DashboardCard>
        <DashboardCard title="Recent matches">
          <EmptyState
            icon={History}
            title="No matches played yet"
            description="Completed matches, results and scorecards will appear here."
          />
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardCard title="Top players">
          <EmptyState
            icon={Star}
            title="No players yet"
            description="Standout performers will surface here after matches."
            actionLabel="Add players"
            actionTo="/match-center/players"
          />
        </DashboardCard>
        <DashboardCard title="Recent awards">
          <EmptyState
            icon={Award}
            title="No awards yet"
            description="Man of the match and other honours appear here."
          />
        </DashboardCard>
        <DashboardCard title="Recent tournament">
          <EmptyState
            icon={Trophy}
            title="No tournaments"
            description="Create a tournament to track brackets and standings."
            actionLabel="Create tournament"
            actionTo="/match-center/tournaments"
          />
        </DashboardCard>
      </div>
    </div>
  );
}
