import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/coaches")({
  head: () => ({
    meta: [
      { title: "Our Coaches" },
      { name: "description", content: "Meet the coaching staff." },
      { property: "og:title", content: "Our Coaches" },
      { property: "og:description", content: "Meet the coaching staff." },
    ],
  }),
  component: () => (
    <TenantGate>
      <CoachesPage />
    </TenantGate>
  ),
});

function CoachesPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const coaches = sectionsBy(sections, "coaches").map((s) => s.content as {
    name?: string; role?: string; bio?: string; photo_url?: string;
  });

  return (
    <>
      <PageHero
        eyebrow="Coaching staff"
        title="Our Coaches"
        subtitle={`Learn from experienced coaches at ${tenant.name}.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {coaches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Coach profiles coming soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-6 text-center">
                <div className="mx-auto">
                  <PersonAvatar path={c.photo_url ?? null} name={c.name ?? "Coach"} size={112} />
                </div>
                <div className="mt-4 text-lg font-semibold">{c.name}</div>
                {c.role && <div className="text-sm" style={{ color: "var(--brand)" }}>{c.role}</div>}
                {c.bio && <p className="mt-3 text-sm text-muted-foreground">{c.bio}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
