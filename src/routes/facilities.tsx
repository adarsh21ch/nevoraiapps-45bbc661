import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { StoragedImage } from "@/components/site/StoragedImage";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";
import { Check } from "lucide-react";

export const Route = createFileRoute("/facilities")({
  head: () => ({
    meta: [
      { title: "Facilities" },
      { name: "description", content: "Facilities and infrastructure at the academy." },
      { property: "og:title", content: "Facilities" },
      { property: "og:description", content: "Facilities and infrastructure at the academy." },
    ],
  }),
  component: () => (
    <TenantGate>
      <FacilitiesPage />
    </TenantGate>
  ),
});

function FacilitiesPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const facilities = sectionsBy(sections, "facilities").map((s) => s.content as {
    title?: string; description?: string; image_url?: string;
  });

  return (
    <>
      <PageHero
        eyebrow="Infrastructure"
        title="Facilities"
        subtitle={`World-class facilities at ${tenant.name}.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {facilities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Facility details coming soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {facilities.map((f, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {f.image_url && (
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                    <StoragedImage path={f.image_url} alt={f.title ?? ""} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start gap-2">
                    <Check className="mt-1 size-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
                    <div>
                      <h3 className="text-lg font-semibold">{f.title ?? "Facility"}</h3>
                      {f.description && <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>}
                    </div>
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
