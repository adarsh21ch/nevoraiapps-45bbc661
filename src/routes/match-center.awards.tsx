import { createFileRoute } from "@tanstack/react-router";
import { Award, Medal, Star, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/lib/dashboard-context";
import { useMCAwards, useMCRecognitions } from "@/lib/mc-data";

export const Route = createFileRoute("/match-center/awards")({
  head: () => ({
    meta: [{ title: "Awards · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: AwardsPage,
});

function AwardsPage() {
  const { tenant } = useDashboard();
  const awards = useMCAwards(tenant.id);
  const recognitions = useMCRecognitions(tenant.id);

  const hasAny = (awards && awards.length > 0) || (recognitions && recognitions.length > 0);

  return (
    <div>
      <PageHeader
        title="Awards"
        description="Man of the match, player of the series and academy honours."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Awards" },
        ]}
      />

      {!hasAny && (
        <EmptyState
          icon={Award}
          title="No awards handed out yet"
          description="Match-day and tournament awards will show up here as they are given."
        />
      )}

      {awards && awards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Season Awards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {awards.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge variant="outline" className="capitalize mb-1">
                      {a.category}
                    </Badge>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.holderName}</div>
                    <div className="text-sm font-bold tabular-nums mt-1">{a.value}</div>
                    {a.detail && (
                      <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                    )}
                  </div>
                  <Trophy className="size-5 text-primary shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {recognitions && recognitions.length > 0 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Match Awards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recognitions.slice(0, 30).map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1 capitalize">
                      {r.recognitionType.replace(/_/g, " ")}
                    </Badge>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.athleteName}</div>
                    <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                    <div className="text-[10px] text-muted-foreground mt-1">{r.matchLabel}</div>
                  </div>
                  <div className="text-2xl shrink-0" aria-hidden>
                    {r.badge}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Suppress unused-import lint for icons kept for future categories
void Medal;
void Star;
void Users;
