import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { StoragedImage } from "@/components/site/StoragedImage";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/star-players")({
  head: () => ({ meta: [{ title: "Star Players" }, { name: "description", content: "Our champions" }] }),
  component: () => (
    <TenantGate>
      <StarPlayersContent />
    </TenantGate>
  ),
});

type StarPlayer = { name: string; achievement: string; photo_url?: string | null };

function StarPlayersContent() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const players = sectionsBy(sections, "star_players").map((s) => s.content as StarPlayer);

  return (
    <>
      <PageHero
        eyebrow={`Champions of ${tenant.name}`}
        title="Star Players"
        subtitle="Meet the students who took what they learned here to district, state and national levels."
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {players.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            No star players featured yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p, i) => (
              <div key={i} className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition-shadow hover:shadow-xl">
                <div
                  className="relative flex h-56 items-center justify-center overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})` }}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
                  <StoragedImage
                    path={p.photo_url}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    fallback={
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-4xl font-bold text-white backdrop-blur ring-1 ring-white/30">
                        {p.name.charAt(0)}
                      </div>
                    }
                  />
                </div>
                <div className="p-6">
                  <div className="text-lg font-semibold text-foreground">{p.name}</div>
                  <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
                    <span>{p.achievement}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

