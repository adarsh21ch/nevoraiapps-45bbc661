import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { batchesQuery, sectionsBy, siteContentQuery } from "@/lib/site-queries";
import { Clock, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Programs & Batches" },
      { name: "description", content: "Training programs and batches offered by the academy." },
      { property: "og:title", content: "Programs & Batches" },
      {
        property: "og:description",
        content: "Training programs and batches offered by the academy.",
      },
    ],
  }),
  component: () => (
    <TenantGate>
      <ProgramsPage />
    </TenantGate>
  ),
});

function ProgramsPage() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const { data: batches = [] } = useQuery(batchesQuery(tenant.id));
  const programs = sectionsBy(sections, "programs").map(
    (s) =>
      s.content as {
        title?: string;
        description?: string;
        age_group?: string;
      },
  );

  return (
    <>
      <PageHero pageKey="programs"
        eyebrow="What we offer"
        title="Programs & Batches"
        subtitle={`Choose a program that fits your goals at ${tenant.name}.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 space-y-14">
        {programs.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Programs</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/60 bg-card p-6 transition-shadow hover:shadow-md"
                >
                  {p.age_group && (
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {p.age_group}
                    </div>
                  )}
                  <h3 className="mt-1 text-lg font-semibold">{p.title ?? "Program"}</h3>
                  {p.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Batches</h2>
          {batches.length === 0 ? (
            <p className="mt-4 text-muted-foreground">Batch details coming soon.</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batches.map((b) => (
                <div key={b.id} className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Users className="size-3.5" /> Batch
                  </div>
                  <h3 className="mt-1 text-lg font-semibold">{b.name}</h3>
                  {b.timing && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <Clock className="mt-0.5 size-4 flex-shrink-0" />
                      <span>{b.timing}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
          <div className="text-lg font-semibold">Ready to join?</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Register in minutes — no account required to start.
          </p>
          <Link
            to="/register"
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Register now <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
