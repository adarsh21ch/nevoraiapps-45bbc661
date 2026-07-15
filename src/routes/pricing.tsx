import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { PLANS, formatPrice, TRIAL_DAYS } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · AcademyOS — Sports Operating System" },
      {
        name: "description",
        content: `Simple, transparent pricing for sports academies. Start with a ${TRIAL_DAYS}-day free trial. From ₹999/month.`,
      },
      { property: "og:title", content: "AcademyOS Pricing" },
      {
        property: "og:description",
        content: "Plans for solo coaches to multi-branch academies. Start free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            AcademyOS
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/features" className="text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link to="/pricing" className="font-medium">
              Pricing
            </Link>
            <Link to="/demo" className="text-muted-foreground hover:text-foreground">
              Book a demo
            </Link>
            <Link
              to="/auth"
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--brand)", color: "var(--brand-foreground, white)" }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 px-3 py-1 rounded-full"
          style={{
            color: "var(--brand)",
            background: "color-mix(in oklab, var(--brand) 10%, transparent)",
          }}
        >
          <Sparkles className="size-3.5" /> {TRIAL_DAYS}-day free trial · No card required
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Pricing that grows with your academy
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          One flat monthly fee. All modules. No per-coach charges. Cancel anytime.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className="rounded-2xl border bg-card p-6 flex flex-col relative"
            style={
              plan.popular
                ? {
                    borderColor: "var(--brand)",
                    boxShadow: "0 0 0 1px var(--brand)",
                  }
                : undefined
            }
          >
            {plan.popular && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-2.5 py-0.5 rounded-full"
                style={{ background: "var(--brand)", color: "var(--brand-foreground, white)" }}
              >
                Most popular
              </div>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{formatPrice(plan)}</span>
              {plan.priceMonthly != null && (
                <span className="text-sm text-muted-foreground">/ month</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {plan.studentsIncluded == null
                ? "Unlimited students"
                : `Up to ${plan.studentsIncluded} students`}
            </p>

            <ul className="mt-5 space-y-2 text-sm flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to={plan.key === "custom" ? "/demo" : "/auth"}
              className="mt-6 rounded-lg py-2 text-center text-sm font-medium"
              style={
                plan.popular
                  ? { background: "var(--brand)", color: "var(--brand-foreground, white)" }
                  : { border: "1px solid var(--border)" }
              }
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 border-t">
        <h2 className="text-2xl font-semibold text-center">Frequently asked</h2>
        <div className="mt-8 space-y-6">
          {[
            {
              q: "Is there really a free trial?",
              a: `Yes — ${TRIAL_DAYS} days, all features unlocked. No card required. Pick a plan when you're ready.`,
            },
            {
              q: "Can I switch plans later?",
              a: "Anytime. Upgrades are prorated; downgrades apply from the next billing cycle.",
            },
            {
              q: "Do you support sports other than cricket?",
              a: "Cricket is fully live. Badminton, football, volleyball, basketball, tennis, swimming and gym flows are on the roadmap and enable the shared modules today (attendance, billing, website, portals).",
            },
            {
              q: "How does billing work?",
              a: "Monthly, invoiced by AcademyOS. Enterprise plans can be billed annually.",
            },
          ].map((row) => (
            <div key={row.q}>
              <h3 className="font-medium">{row.q}</h3>
              <p className="text-sm text-muted-foreground mt-1">{row.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-4">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <Link to="/features" className="hover:text-foreground">
            Features
          </Link>
          <Link to="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/demo" className="hover:text-foreground">
            Book demo
          </Link>
          <Link to="/faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link to="/contact" className="hover:text-foreground">
            Contact
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} AcademyOS. The Sports Operating System.</p>
      </footer>
    </div>
  );
}
