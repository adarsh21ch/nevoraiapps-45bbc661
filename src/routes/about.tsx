import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { sectionOne, sectionsBy, siteContentQuery } from "@/lib/site-queries";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About" }, { name: "description", content: "About us" }] }),
  component: () => (
    <TenantGate>
      <AboutContent />
    </TenantGate>
  ),
});

function AboutContent() {
  const tenant = useTenant();
  const { data: sections = [] } = useQuery(siteContentQuery(tenant.id));
  const about = sectionOne<{ heading?: string; body?: string }>(sections, "about");
  const achievements = sectionsBy(sections, "achievements").map((s) => s.content as { text: string });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        About {tenant.name}
      </div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {about?.heading ?? `About ${tenant.name}`}
      </h1>
      {about?.body ? (
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{about.body}</p>
      ) : (
        <p className="mt-6 text-muted-foreground">Details coming soon.</p>
      )}

      {achievements.length > 0 ? (
        <div className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Achievements</h2>
          <ul className="mt-6 space-y-3">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--brand)" }} />
                <span className="text-foreground">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
