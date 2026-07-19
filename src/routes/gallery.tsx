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
      <PageHero pageKey="gallery" eyebrow="Moments" title="Gallery" subtitle={`Life at ${tenant.name}.`} />
      {/* Full-bleed masonry — natural aspect ratios, no forced crop */}
      <div className="mx-auto max-w-none px-4 py-16 sm:px-6 lg:px-10">
        {items.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            Photos and videos coming soon.
          </div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3 xl:columns-4">
            {items.map((it, i) => (
              <figure
                key={i}
                className="group relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border/60 bg-muted animate-in fade-in duration-500"
              >
                {it.url && (
                  <StoragedImage
                    path={it.url}
                    alt={it.caption ?? ""}
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                {it.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-medium text-white">
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
