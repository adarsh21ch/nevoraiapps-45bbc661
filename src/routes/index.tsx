import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Phone, MessageCircle, Sparkles, Trophy, Users, ShieldCheck } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
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
        {/* Grid mask */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
        {/* Ambient glow blobs */}
        <div className="pointer-events-none absolute -top-40 -left-20 h-[520px] w-[520px] rounded-full bg-white/20 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-[460px] w-[460px] rounded-full bg-black/25 blur-[130px]" />
        <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28 lg:py-32">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {tenant.niche === "gym" ? "Modern gym" : tenant.niche === "tuition" ? "Learning centre" : "Sports academy"}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {hero?.headline ?? tenant.tagline ?? tenant.name}
            </motion.h1>
            {hero?.subheadline ? (
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mt-6 max-w-2xl text-lg text-white/85 sm:text-xl"
              >
                {hero.subheadline}
              </motion.p>
            ) : null}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.02]"
              >
                {hero?.cta_label ?? "Register Now"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {tenant.phone ? (
                <a
                  href={`tel:${tenant.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
                >
                  <Phone className="h-4 w-4" />
                  Call us
                </a>
              ) : null}
            </motion.div>
          </div>

          {/* Glass stat row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative mt-14 grid gap-3 sm:mt-20 sm:grid-cols-3"
          >
            {[
              { icon: Users, label: "Certified coaches", value: "Trained mentors" },
              { icon: Trophy, label: "Structured training", value: "Skill-first curriculum" },
              { icon: ShieldCheck, label: "Transparent fees", value: "No surprises" },
            ].map((s) => (
              <div
                key={s.label}
                className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl transition-transform hover:-translate-y-0.5"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-opacity group-hover:opacity-70" />
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">{s.label}</div>
                    <div className="text-sm font-semibold text-white">{s.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
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
