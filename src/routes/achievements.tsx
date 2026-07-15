import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Star } from "lucide-react";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements" },
      { name: "description", content: "Academy records, hall of fame, and recognitions." },
      { property: "og:title", content: "Achievements" },
      { property: "og:description", content: "Academy records, hall of fame, and recognitions." },
    ],
  }),
  component: () => (
    <TenantGate>
      <AchievementsPage />
    </TenantGate>
  ),
});

function AchievementsPage() {
  const tenant = useTenant();
  const bundle = useQuery({
    queryKey: ["public_academy_bundle", tenant.slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_academy_bundle", {
        _slug: tenant.slug,
      });
      if (error) throw error;
      return data as {
        academy_records: Array<{
          id: string;
          record_type: string;
          title: string;
          description: string | null;
          value: string | null;
        }>;
        hall_of_fame: Array<{
          id: string;
          title: string;
          description: string | null;
          image_url: string | null;
        }>;
        recognitions: Array<{
          id: string;
          title: string;
          recognition_type: string;
          description: string | null;
        }>;
      } | null;
    },
    staleTime: 60_000,
  });

  const records = bundle.data?.academy_records ?? [];
  const hof = bundle.data?.hall_of_fame ?? [];
  const recognitions = bundle.data?.recognitions ?? [];
  const empty = !records.length && !hof.length && !recognitions.length;

  return (
    <>
      <PageHero
        eyebrow="Legacy"
        title="Achievements"
        subtitle={`Records, honors, and recognitions from ${tenant.name}.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 space-y-14">
        {empty && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Achievements coming soon.
          </div>
        )}

        {records.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Academy Records</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <Trophy className="size-5" style={{ color: "var(--brand)" }} />
                  <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {r.record_type}
                  </div>
                  <h3 className="mt-1 font-semibold">{r.title}</h3>
                  {r.value && (
                    <div className="mt-2 text-2xl font-bold" style={{ color: "var(--brand)" }}>
                      {r.value}
                    </div>
                  )}
                  {r.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {hof.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Hall of Fame</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hof.map((h) => (
                <div key={h.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <Star className="size-5" style={{ color: "var(--brand)" }} />
                  <h3 className="mt-2 font-semibold">{h.title}</h3>
                  {h.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{h.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {recognitions.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Recognitions</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recognitions.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {r.recognition_type}
                  </div>
                  <h3 className="mt-1 font-semibold">{r.title}</h3>
                  {r.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
