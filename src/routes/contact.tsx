import { createFileRoute } from "@tanstack/react-router";
import { Phone, MessageCircle, Mail, MapPin, ExternalLink } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact" }, { name: "description", content: "Get in touch" }] }),
  component: () => (
    <TenantGate>
      <ContactContent />
    </TenantGate>
  ),
});

function ContactContent() {
  const tenant = useTenant();
  const wa = (tenant.whatsapp ?? tenant.phone)?.replace(/[^\d]/g, "");
  const mapUrl = tenant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        Get in touch
      </div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Contact us</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Have questions? Reach out — we usually reply the same day.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {tenant.phone ? (
          <a href={`tel:${tenant.phone}`} className="group rounded-2xl border border-border/60 bg-card p-6 hover:shadow-md">
            <Phone className="h-6 w-6" style={{ color: "var(--brand)" }} />
            <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{tenant.phone}</div>
          </a>
        ) : null}

        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border/60 bg-card p-6 hover:shadow-md">
            <MessageCircle className="h-6 w-6" style={{ color: "var(--brand)" }} />
            <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</div>
            <div className="mt-1 text-lg font-semibold text-foreground">Chat with us</div>
          </a>
        ) : null}

        {tenant.email ? (
          <a href={`mailto:${tenant.email}`} className="group rounded-2xl border border-border/60 bg-card p-6 hover:shadow-md">
            <Mail className="h-6 w-6" style={{ color: "var(--brand)" }} />
            <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</div>
            <div className="mt-1 break-all text-lg font-semibold text-foreground">{tenant.email}</div>
          </a>
        ) : null}

        {mapUrl ? (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="group rounded-2xl border border-border/60 bg-card p-6 hover:shadow-md">
            <MapPin className="h-6 w-6" style={{ color: "var(--brand)" }} />
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visit <ExternalLink className="h-3 w-3" />
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">{tenant.address}</div>
          </a>
        ) : null}
      </div>
    </div>
  );
}
