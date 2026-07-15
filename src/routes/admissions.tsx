import { createFileRoute, Link } from "@tanstack/react-router";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { ArrowRight, FileText, Phone } from "lucide-react";

export const Route = createFileRoute("/admissions")({
  head: () => ({
    meta: [
      { title: "Admissions" },
      { name: "description", content: "Join the academy — quick online registration." },
      { property: "og:title", content: "Admissions" },
      { property: "og:description", content: "Join the academy — quick online registration." },
    ],
  }),
  component: () => (
    <TenantGate>
      <AdmissionsPage />
    </TenantGate>
  ),
});

function AdmissionsPage() {
  const tenant = useTenant();

  return (
    <>
      <PageHero
        eyebrow="Join us"
        title="Admissions"
        subtitle={`Start your journey with ${tenant.name} in minutes.`}
      />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-8">
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span
                className="grid size-6 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                1
              </span>
              <span>Fill out the online registration form.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="grid size-6 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                2
              </span>
              <span>Choose a batch and fee plan.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="grid size-6 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                3
              </span>
              <span>Accept the academy policies and submit.</span>
            </li>
            <li className="flex gap-3">
              <span
                className="grid size-6 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                4
              </span>
              <span>Our team will confirm your admission.</span>
            </li>
          </ol>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Register online <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold"
            >
              <Phone className="size-4" /> Book a demo
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/policies/$kind"
            params={{ kind: "terms" }}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-5 hover:shadow-md"
          >
            <FileText className="mt-0.5 size-5" style={{ color: "var(--brand)" }} />
            <div>
              <div className="font-semibold">Read our policies</div>
              <div className="text-sm text-muted-foreground">Terms, privacy, refunds and more.</div>
            </div>
          </Link>
          <Link
            to="/programs"
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-5 hover:shadow-md"
          >
            <ArrowRight className="mt-0.5 size-5" style={{ color: "var(--brand)" }} />
            <div>
              <div className="font-semibold">Explore programs</div>
              <div className="text-sm text-muted-foreground">See what fits your goals.</div>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
