import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { feePlansQuery } from "@/lib/site-queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/fees")({
  head: () => ({ meta: [{ title: "Fees" }, { name: "description", content: "Fee plans" }] }),
  component: () => (
    <TenantGate>
      <FeesContent />
    </TenantGate>
  ),
});

function FeesContent() {
  const tenant = useTenant();
  const { data: fees = [], isLoading } = useQuery(feePlansQuery(tenant.id));
  const registration = fees.filter((f) => f.type === "registration");
  const monthly = fees.filter((f) => f.type === "monthly");

  // Determine "most popular" — the middle plan when there are 3, else the median-priced plan.
  const sortedMonthly = [...monthly].sort((a, b) => a.amount - b.amount);
  const popularId =
    sortedMonthly.length >= 2
      ? sortedMonthly[Math.floor(sortedMonthly.length / 2)]?.id
      : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        Simple, transparent pricing
      </div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Fees & plans</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Pay directly to {tenant.name} via UPI. No hidden fees, no card surcharges.
      </p>

      {isLoading ? (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {monthly.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-foreground">Monthly plans</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedMonthly.map((p) => (
                  <PlanCard
                    key={p.id}
                    name={p.name}
                    amount={p.amount}
                    period="per month"
                    desc={p.description}
                    popular={p.id === popularId && sortedMonthly.length >= 2}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {registration.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-foreground">One-time</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {registration.map((p) => (
                  <PlanCard key={p.id} name={p.name} amount={p.amount} period="one-time" desc={p.description} />
                ))}
              </div>
            </section>
          ) : null}

          {fees.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
              Fee plans coming soon.
            </div>
          ) : null}
        </>
      )}

      <div className="mt-16 overflow-hidden rounded-3xl p-8 text-white sm:p-10" style={{ backgroundColor: "var(--brand-ink)" }}>
        <div className="text-lg font-semibold">Ready to join?</div>
        <p className="mt-2 text-sm text-white/70">Register online and pay directly to {tenant.name} via UPI.</p>
        <Link
          to="/register"
          className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-transform hover:scale-[1.02]"
        >
          Register Now
        </Link>
      </div>
    </div>
  );
}

function PlanCard({
  name, amount, period, desc, popular,
}: {
  name: string; amount: number; period: string; desc: string | null; popular?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border bg-card p-6 transition-all ${
        popular ? "border-transparent shadow-xl sm:scale-[1.03]" : "border-border/60 hover:shadow-md"
      }`}
      style={
        popular
          ? {
              outline: "2px solid var(--brand)",
              boxShadow: "0 12px 40px -12px color-mix(in oklab, var(--brand) 40%, transparent)",
            }
          : undefined
      }
    >
      {popular ? (
        <div
          className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Sparkles className="h-3 w-3" /> Most popular
        </div>
      ) : null}
      <div className="text-sm font-medium text-muted-foreground">{name}</div>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
          ₹{amount.toLocaleString("en-IN")}
        </span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      {desc ? <p className="mt-4 text-sm text-muted-foreground">{desc}</p> : null}
      <ul className="mt-5 space-y-2 text-sm text-foreground">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
          <span>Direct UPI payment</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--brand)" }} />
          <span>Digital receipt</span>
        </li>
      </ul>
    </div>
  );
}
