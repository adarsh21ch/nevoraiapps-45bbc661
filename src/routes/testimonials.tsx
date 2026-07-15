import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";
import { Quote } from "lucide-react";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "Testimonials" },
      { name: "description", content: "What our students and parents say." },
      { property: "og:title", content: "Testimonials" },
      { property: "og:description", content: "What our students and parents say." },
    ],
  }),
  component: () => (
    <TenantGate>
      <TestimonialsPage />
    </TenantGate>
  ),
});

function TestimonialsPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const items = sectionsBy(sections, "testimonials").map(
    (s) =>
      s.content as {
        name?: string;
        role?: string;
        quote?: string;
      },
  );

  return (
    <>
      <PageHero
        eyebrow="In their words"
        title="Testimonials"
        subtitle={`What the ${tenant.name} community has to say.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Testimonials coming soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => (
              <figure key={i} className="rounded-2xl border border-border/60 bg-card p-6">
                <Quote className="size-6 opacity-30" style={{ color: "var(--brand)" }} />
                {t.quote && (
                  <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                    {t.quote}
                  </blockquote>
                )}
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  {t.role && <span className="text-muted-foreground"> · {t.role}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
