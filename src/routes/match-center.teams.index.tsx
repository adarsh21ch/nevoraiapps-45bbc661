import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users2, PlusCircle } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { TeamCard } from "@/components/match-center/team-ui";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/dashboard-context";
import {
  listTeams,
  deleteTeam,
  duplicateTeam,
  updateTeam,
  AGE_GROUPS,
  TEAM_STATUSES,
} from "@/lib/mc-teams";
import { toast } from "sonner";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

export const Route = createFileRoute("/match-center/teams/")({
  head: () => ({
    meta: [{ title: "Teams · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: TeamsListPage,
});

function TeamsListPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [ageGroup, setAgeGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [coach, setCoach] = useState("all");
  const [season, setSeason] = useState("all");

  const teamsQ = useQuery({
    queryKey: ["mc-teams", tenant.id],
    queryFn: () => listTeams(tenant.id),
  });

  const teams = useDemoOverlay(tenant.id, teamsQ.data, (d) => d.teams);

  const coaches = useMemo(
    () => Array.from(new Set(teams.map((t) => t.coach_name).filter(Boolean))) as string[],
    [teams],
  );
  const seasons = useMemo(
    () => Array.from(new Set(teams.map((t) => t.season).filter(Boolean))) as string[],
    [teams],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return teams.filter((t) => {
      if (
        query &&
        !t.name.toLowerCase().includes(query) &&
        !(t.short_name ?? "").toLowerCase().includes(query)
      )
        return false;
      if (ageGroup !== "all" && t.age_group !== ageGroup) return false;
      if (status !== "all" && t.status !== status) return false;
      if (coach !== "all" && t.coach_name !== coach) return false;
      if (season !== "all" && t.season !== season) return false;
      return true;
    });
  }, [teams, q, ageGroup, status, coach, season]);

  const del = useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => {
      toast.success("Team deleted");
      qc.invalidateQueries({ queryKey: ["mc-teams", tenant.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dup = useMutation({
    mutationFn: (id: string) => duplicateTeam(tenant.id, id),
    onSuccess: () => {
      toast.success("Team duplicated");
      qc.invalidateQueries({ queryKey: ["mc-teams", tenant.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "active" | "archived" }) =>
      updateTeam(id, { status: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-teams", tenant.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Teams"
        description="Reusable squads for your academy. Playing XI is picked from a squad at match time."
        breadcrumbs={[{ label: "Match Center", to: "/match-center/dashboard" }, { label: "Teams" }]}
        actions={
          <Button asChild>
            <Link to="/match-center/teams/new">
              <PlusCircle className="size-4 mr-1.5" /> Create team
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3">
        <SearchBar placeholder="Search teams by name or short code…" onQuery={setQ} />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          <FilterSelect
            label="Age"
            value={ageGroup}
            onChange={setAgeGroup}
            options={[{ v: "all", l: "All ages" }, ...AGE_GROUPS.map((a) => ({ v: a, l: a }))]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { v: "all", l: "All statuses" },
              ...TEAM_STATUSES.map((s) => ({ v: s, l: cap(s) })),
            ]}
          />
          <FilterSelect
            label="Coach"
            value={coach}
            onChange={setCoach}
            options={[{ v: "all", l: "All coaches" }, ...coaches.map((c) => ({ v: c, l: c }))]}
          />
          <FilterSelect
            label="Season"
            value={season}
            onChange={setSeason}
            options={[{ v: "all", l: "All seasons" }, ...seasons.map((s) => ({ v: s, l: s }))]}
          />
        </div>
      </div>

      {teamsQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
        </div>
      ) : filtered.length === 0 ? (
        teams.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="No teams created yet"
            description="Build a squad, add players from your academy, and pick your captain — you'll be match-ready in a few clicks."
            actionLabel="Create team"
            actionTo="/match-center/teams/new"
          />
        ) : (
          <EmptyState
            icon={Users2}
            title="No teams match those filters"
            description="Try clearing filters or searching by a different name."
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onEdit={() =>
                navigate({
                  to: "/match-center/teams/$teamId",
                  params: { teamId: t.id },
                  search: { tab: "settings" } as never,
                })
              }
              onDuplicate={() => dup.mutate(t.id)}
              onArchive={() =>
                archive.mutate({ id: t.id, next: t.status === "archived" ? "active" : "archived" })
              }
              onDelete={() => {
                if (confirm(`Delete "${t.name}"? This cannot be undone.`)) del.mutate(t.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none font-medium"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
