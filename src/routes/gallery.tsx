import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { StoragedImage } from "@/components/site/StoragedImage";
import { useTenant } from "@/lib/tenant-context";
import { sectionsBy, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery" },
      { name: "description", content: "Photo and video gallery from the academy." },
      { property: "og:title", content: "Gallery" },
      { property: "og:description", content: "Photo and video gallery from the academy." },
    ],
  }),
  component: () => (
    <TenantGate>
      <GalleryPage />
    </TenantGate>
  ),
});

function GalleryPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const items = sectionsBy(sections, "gallery").map(
    (s) => s.content as { url?: string; caption?: string },
  );

  return (
    <>
      <PageHero eyebrow="Moments" title="Gallery" subtitle={`Life at ${tenant.name}.`} />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Photos and videos coming soon.
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {items.map((it, i) => (
              <figure
                key={i}
                className="group mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border/60 bg-muted"
              >
                {it.url && (
                  <StoragedImage
                    path={it.url}
                    alt={it.caption ?? ""}
                    className="h-auto w-full rounded-lg object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                {it.caption && (
                  <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                    {it.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
