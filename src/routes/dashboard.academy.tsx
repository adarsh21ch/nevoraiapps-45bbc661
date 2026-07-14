import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Users,
  Swords,
  Activity,
  Inbox,
  BarChart3,
  Sparkles,
  BellRing,
  Globe,
  ShieldCheck,
  Settings2,
  CreditCard,
  Palette,
  ChevronRight,
  Search,
  Building2,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";
import { Card } from "@/components/ds/Card";
import { SearchBar } from "@/components/ds/SearchBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/academy")({
  head: () => ({
    meta: [
      { title: "Academy · Operations Hub" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyHub,
});

type Item = {
  to: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
  soon?: boolean;
  keywords?: string[];
};

const operations: Item[] = [
  { to: "/dashboard/students", label: "Players", hint: "Roster, profiles, batches", icon: Users, keywords: ["students", "roster", "athletes"] },
  { to: "/match-center", label: "Match Center", hint: "Fixtures, teams, tournaments", icon: Swords, keywords: ["matches", "fixtures"] },
  { to: "/match-center/live", label: "Live Scoring", hint: "Score matches in real-time", icon: Activity, keywords: ["score", "ball", "live"] },
  { to: "/dashboard/registrations", label: "Registrations", hint: "New trials & sign-ups", icon: Inbox, keywords: ["leads", "trials", "signups"] },
];

const management: Item[] = [
  { to: "/dashboard/reports", label: "Reports", hint: "Attendance, fees, performance", icon: BarChart3 },
  { to: "/dashboard/insights", label: "Insights", hint: "Trends & AI signals", icon: Sparkles },
  { to: "/dashboard/communications", label: "Communications", hint: "Broadcasts, templates & scheduling", icon: BellRing, keywords: ["whatsapp", "sms", "push", "broadcast", "announcement"] },
  { to: "/dashboard/site", label: "Website", hint: "Public academy page", icon: Globe },
];

const administration: Item[] = [
  { to: "/dashboard/admins", label: "Admin Management", hint: "Create, suspend, reset", icon: ShieldCheck, ownerOnly: true },
  { to: "/dashboard/settings", label: "Academy Settings", hint: "Name, hours, contact", icon: Settings2, ownerOnly: true },
  { to: "/dashboard/subscription", label: "Subscription", hint: "Plan & billing", icon: CreditCard, ownerOnly: true, soon: true },
  { to: "/dashboard/branding", label: "Branding", hint: "Logo, theme, colors", icon: Palette, ownerOnly: true, soon: true },
];

function AcademyHub() {
  const { profile, tenant } = useDashboard();
  const owner = isOwner(profile);
  const [q, setQ] = useState("");

  const all = useMemo(() => {
    const groups = [
      { title: "Operations", items: operations },
      { title: "Academy Management", items: management },
      { title: "Administration", items: administration.filter((i) => !i.ownerOnly || owner) },
    ];
    if (!q.trim()) return groups;
    const needle = q.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(needle) ||
            i.hint.toLowerCase().includes(needle) ||
            (i.keywords ?? []).some((k) => k.toLowerCase().includes(needle)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [q, owner]);

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Building2 className="size-3.5" />
            Operations Hub
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight truncate">
            {tenant.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you need to run the academy.
          </p>
        </div>
      </header>

      {/* Search */}
      <SearchBar
        value={q}
        onChange={setQ}
        placeholder="Search players, matches, reports, settings…"
      />

      {all.length === 0 ? (
        <div className="grid place-items-center py-16 text-center text-muted-foreground">
          <Search className="size-6 mb-2" />
          <p className="text-sm">No results for "{q}"</p>
        </div>
      ) : (
        all.map((group) => (
          <Section key={group.title} title={group.title}>
            <div
              className={cn(
                "grid gap-3",
                group.title === "Operations"
                  ? "grid-cols-2"
                  : "grid-cols-2 md:grid-cols-2",
              )}
            >
              {group.items.map((item) => (
                <HubTile
                  key={item.to + item.label}
                  item={item}
                  large={group.title === "Operations"}
                />
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HubTile({ item, large }: { item: Item; large?: boolean }) {
  const Icon = item.icon;
  const content = (
    <Card className={cn("group h-full", large ? "p-4" : "p-3.5")}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid place-items-center rounded-xl shrink-0",
            large ? "size-11" : "size-10",
          )}
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
            color: "var(--brand)",
          }}
        >
          <Icon className={cn(large ? "size-5" : "size-[18px]")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className={cn("font-semibold truncate", large ? "text-[15px]" : "text-sm")}>
              {item.label}
            </div>
            {item.soon ? (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted rounded px-1 py-0.5">
                Soon
              </span>
            ) : null}
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {item.hint}
          </p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/60 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Card>
  );

  if (item.soon) {
    return (
      <div aria-disabled className="opacity-60 pointer-events-none">
        {content}
      </div>
    );
  }
  return (
    <Link to={item.to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] rounded-2xl">
      {content}
    </Link>
  );
}
