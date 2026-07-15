import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TenantGate } from "@/components/site/TenantGate";
import { PageHero } from "@/components/site/PageHero";
import { useTenant } from "@/lib/tenant-context";
import { POLICY_LABELS, publishedPoliciesQuery, type PolicyKind } from "@/lib/site-queries";

const VALID_KINDS: PolicyKind[] = [
  "terms",
  "privacy",
  "refund",
  "fee",
  "conduct",
  "leave",
  "medical",
];

export const Route = createFileRoute("/policies/$kind")({
  head: ({ params }) => {
    const label = POLICY_LABELS[params.kind as PolicyKind] ?? "Policies";
    return {
      meta: [
        { title: label },
        { name: "description", content: `${label} — academy policy.` },
        { property: "og:title", content: label },
        { property: "og:description", content: `${label} — academy policy.` },
      ],
    };
  },
  component: () => (
    <TenantGate>
      <PolicyPage />
    </TenantGate>
  ),
});

function PolicyPage() {
  const tenant = useTenant();
  const params = Route.useParams();
  const kind = params.kind as PolicyKind;

  if (!VALID_KINDS.includes(kind)) throw notFound();

  const { data: policies = [], isLoading } = useQuery(publishedPoliciesQuery(tenant.id));
  const doc = policies.find((p) => p.kind === kind);
  const label = POLICY_LABELS[kind];

  return (
    <>
      <PageHero
        eyebrow="Policy"
        title={doc?.title ?? label}
        subtitle={`Effective policy for ${tenant.name}.`}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <nav className="mb-8 flex flex-wrap gap-2 text-xs">
          {VALID_KINDS.map((k) => (
            <Link
              key={k}
              to="/policies/$kind"
              params={{ kind: k }}
              className={`rounded-full border px-3 py-1 ${k === kind ? "border-transparent text-white" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
              style={k === kind ? { backgroundColor: "var(--brand)" } : undefined}
            >
              {POLICY_LABELS[k]}
            </Link>
          ))}
        </nav>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : !doc ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
            This policy has not been published yet.
          </div>
        ) : (
          <article className="prose prose-neutral max-w-none dark:prose-invert">
            <div className="mb-6 text-xs text-muted-foreground">
              Version {doc.version}
              {doc.published_at
                ? ` · Published ${new Date(doc.published_at).toLocaleDateString()}`
                : ""}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {doc.body_md}
            </pre>
          </article>
        )}
      </div>
    </>
  );
}
