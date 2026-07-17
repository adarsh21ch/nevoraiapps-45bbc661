import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import {
  StarPlayerCard,
  StarPlayerFeaturedCard,
  normalizeStar,
  pickFeatured,
  type RawStarPlayer,
} from "@/components/site/StarPlayersShowcase";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/star-players")({
  head: () => ({
    meta: [{ title: "Star Players" }, { name: "description", content: "Our champions" }],
  }),
  component: () => (
    <TenantGate>
      <StarPlayersContent />
    </TenantGate>
  ),
});

function StarPlayersContent() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const players = sectionsBy(sections, "star_players")
    .map((s) => normalizeStar(s.content as RawStarPlayer))
    .filter((p) => p.name);
  const { featured, rest } = pickFeatured(players);

  return (
    <section className="relative bg-[#05060a] py-20 text-white sm:py-24">
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ color: tenant.primary_color }}
          >
            Champions of {tenant.name}
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Star Players</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70 sm:text-lg">
            Meet the students who took what they learned here to district, state and national
            levels.
          </p>
        </div>

        {featured ? (
          <div className="mt-14">
            <StarPlayerFeaturedCard player={featured} />
          </div>
        ) : (
          <div className="mt-14 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center text-white/60">
            No star players featured yet.
          </div>
        )}

        {rest.length > 0 ? (
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p, i) => (
              <StarPlayerCard key={i} player={p} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
