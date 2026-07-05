import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Phone, MessageCircle, Sparkles } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant, useTenantState } from "@/lib/tenant-context";
import { feePlansQuery, sectionsBy, sectionOne, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <TenantGate>
      <HomeContent />
    </TenantGate>
  );
}

type Hero = { headline?: string; subheadline?: string; cta_label?: string; image_url?: string };
type StarPlayer = { name: string; achievement: string; photo_url?: string | null };

function HomeContent() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const { data: fees = [] } = useQuery(feePlansQuery(tenant.id));
  const hero = sectionOne<Hero>(sections, "hero");
  const stars = sectionsBy(sections, "star_players").map((s) => s.content as StarPlayer);
  const monthly = fees.filter((f) => f.type === "monthly").slice(0, 3);

  const wa = tenant.whatsapp?.replace(/[^\d]/g, "");

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
        }}
      >
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {tenant.niche === "gym" ? "Modern gym" : tenant.niche === "tuition" ? "Learning centre" : "Sports academy"}
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {hero?.headline ?? tenant.tagline ?? tenant.name}
            </h1>
            {hero?.subheadline ? (
              <p className="mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">{hero.subheadline}</p>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-lg transition-transform hover:scale-[1.02]"
              >
                {hero?.cta_label ?? "Register Now"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {tenant.phone ? (
                <a
                  href={`tel:${tenant.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" />
                  Call us
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { title: "Certified coaches", body: "Experienced, trained mentors focused on real skill-building." },
            { title: "Small batches", body: "Personal attention with structured curriculum and clear milestones." },
            { title: "Transparent fees", body: "One clear price. No surprises, no hidden charges." },
          ].map((h) => (
            <div key={h.title}>
              <div className="h-1 w-10 rounded-full" style={{ backgroundColor: "var(--brand)" }} />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{h.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Star players */}
      {stars.length > 0 ? (
        <section className="bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                  Our champions
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Star players
                </h2>
              </div>
              <Link to="/star-players" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
                See all →
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stars.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-lg"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-xl text-xl font-bold text-white"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <div className="mt-4 text-base font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.achievement}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Fee plans preview */}
      {monthly.length > 0 ? (
        <section className="bg-background py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
                Simple pricing
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Monthly plans</h2>
              <p className="mt-3 text-muted-foreground">Choose what fits. See all plans and one-time fees on the fees page.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {monthly.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="text-sm font-medium text-muted-foreground">{p.name}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">₹{p.amount.toLocaleString("en-IN")}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  {p.description ? <p className="mt-3 text-sm text-muted-foreground">{p.description}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link to="/fees" className="text-sm font-medium" style={{ color: "var(--brand)" }}>
                View all fees →
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl px-6 py-14 text-center sm:px-10" style={{ backgroundColor: "var(--brand-ink)" }}>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to join {tenant.name}?</h2>
          <p className="mt-3 text-white/70">Fill the online registration form and we'll take it from there.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-lg hover:scale-[1.02] transition-transform"
            >
              Register Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
