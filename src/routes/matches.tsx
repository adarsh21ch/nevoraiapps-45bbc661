import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "lucide-react";

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

function MatchesPage() {
  const tenant = useTenant();
  const bundle = useQuery({
    queryKey: ["public_academy_bundle", tenant.slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_academy_bundle", {
        _slug: tenant.slug,
      });
      if (error) throw error;
      return data as {
        upcoming_matches: Array<{
          id: string;
          scheduled_date: string | null;
          venue: string | null;
          format: string | null;
          team_a_id: string;
          team_b_id: string;
        }>;
        recent_results: Array<{
          id: string;
          scheduled_date: string | null;
          result: string | null;
          winner_team: string | null;
          team_a_id: string;
          team_b_id: string;
        }>;
      } | null;
    },
    staleTime: 60_000,
  });

  const upcoming = bundle.data?.upcoming_matches ?? [];
  const recent = bundle.data?.recent_results ?? [];

  return (
    <>
      <PageHero
        eyebrow="Fixtures & results"
        title="Matches"
        subtitle={`Follow ${tenant.name} on the field.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 space-y-14">
        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-muted-foreground">No upcoming matches scheduled.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {upcoming.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {m.scheduled_date
                      ? new Date(m.scheduled_date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "TBA"}
                    {m.format && <span>· {m.format}</span>}
                  </div>
                  <div className="mt-2 font-semibold">Match</div>
                  {m.venue && <div className="mt-1 text-sm text-muted-foreground">{m.venue}</div>}
                </div>
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
                <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : ""}
                  </div>
                  <div className="mt-1 font-semibold">{m.result ?? "Match completed"}</div>
                  {m.winner_team && (
                    <div className="mt-1 text-sm" style={{ color: "var(--brand)" }}>
                      Winner: {m.winner_team}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
