import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { sectionOne, siteContentQuery } from "@/lib/site-queries";
import { MapPin, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/location")({
  head: () => ({
    meta: [
      { title: "Location" },
      { name: "description", content: "Find and visit us." },
      { property: "og:title", content: "Location" },
      { property: "og:description", content: "Find and visit us." },
    ],
  }),
  component: () => (
    <TenantGate>
      <LocationPage />
    </TenantGate>
  ),
});

function LocationPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const map = sectionOne<{ embed_url?: string; directions_url?: string }>(sections, "map");

  return (
    <>
      <PageHero eyebrow="Visit us" title="Location" subtitle={tenant.address ?? undefined} />
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 space-y-8">
        {map?.embed_url && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <iframe
              src={map.embed_url}
              title="Location map"
              className="h-[420px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {tenant.address && (
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <MapPin className="size-5" style={{ color: "var(--brand)" }} />
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Address
              </div>
              <div className="mt-1 text-sm">{tenant.address}</div>
            </div>
          )}
          {tenant.phone && (
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Phone className="size-5" style={{ color: "var(--brand)" }} />
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Phone
              </div>
              <a href={`tel:${tenant.phone}`} className="mt-1 block text-sm hover:underline">
                {tenant.phone}
              </a>
            </div>
          )}
          {tenant.email && (
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <Mail className="size-5" style={{ color: "var(--brand)" }} />
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Email
              </div>
              <a href={`mailto:${tenant.email}`} className="mt-1 block text-sm hover:underline">
                {tenant.email}
              </a>
            </div>
          )}
        </div>
        {map?.directions_url && (
          <a
            href={map.directions_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Get directions
          </a>
        )}
      </div>
    </>
  );
}
