import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { feePlansQuery } from "@/lib/site-queries";

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        Simple, transparent pricing
      </div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Fees & plans</h1>

      {isLoading ? (
        <div className="mt-12 text-muted-foreground">Loading…</div>
      ) : (
        <>
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

          {monthly.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-foreground">Monthly</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {monthly.map((p) => (
                  <PlanCard key={p.id} name={p.name} amount={p.amount} period="per month" desc={p.description} />
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

      <div className="mt-16 rounded-2xl p-8 text-white" style={{ backgroundColor: "var(--brand-ink)" }}>
        <div className="text-lg font-semibold">Ready to join?</div>
        <p className="mt-2 text-sm text-white/70">Register online and pay directly to {tenant.name} via UPI.</p>
        <Link
          to="/register"
          className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:scale-[1.02] transition-transform"
        >
          Register Now
        </Link>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  amount,
  period,
  desc,
}: {
  name: string;
  amount: number;
  period: string;
  desc: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md">
      <div className="text-sm font-medium text-muted-foreground">{name}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">₹{amount.toLocaleString("en-IN")}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      {desc ? <p className="mt-3 text-sm text-muted-foreground">{desc}</p> : null}
    </div>
  );
}
