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
  ClipboardCheck,
  IndianRupee,
  Wallet,
  Trophy,
  LineChart,
  Award,
  MessageCircle,
  Send,
  Mail,
  FileText,
  Image as ImageIcon,
  UserCircle,
  KeyRound,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { useCurrentRole } from "@/hooks/use-current-role";
import { getFeatures } from "@/lib/tenant";
import { Card } from "@/components/ds/Card";
import { SearchBar } from "@/components/ds/SearchBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/academy")({
  head: () => ({
    meta: [
      { title: "Manage · AcademyOS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManageHub,
});

type Item = {
  to: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  /** Feature flag gate — same keys as getFeatures(tenant). */
  requiresFeature?: "fee_tracking";
};

type Group = { title: string; items: Item[] };

/* ------------------------------------------------------------------ */
/* Role-scoped section definitions. Every `to` targets an EXISTING    */
/* route — nothing here is aspirational or a dead link.               */
/* ------------------------------------------------------------------ */

// Ordered by daily-work priority: Players → Attendance → Fees → Matches → Reports → Comms → Website → Team → Settings → Plan.
const OWNER_GROUPS: Group[] = [
  {
    title: "Players",
    items: [
      { to: "/dashboard/students", label: "Players", hint: "Roster & profiles", icon: Users, keywords: ["students", "athletes", "roster"] },
      { to: "/dashboard/registrations", label: "Registrations", hint: "New sign-ups from your site", icon: Inbox, keywords: ["signups", "trials", "admissions", "pipeline"] },
      { to: "/dashboard/attendance", label: "Attendance", hint: "Mark & track daily attendance", icon: ClipboardCheck },
      { to: "/dashboard/batches", label: "Batches", hint: "Timings & groups", icon: Activity, keywords: ["schedule", "sessions"] },
    ],
  },
  {
    title: "Matches",
    items: [
      { to: "/match-center", label: "Match Center", hint: "The full cricket workspace", icon: Swords },
      { to: "/match-center/live", label: "Live Scoring", hint: "Score in real time", icon: Activity, keywords: ["ball", "score"] },
      { to: "/match-center/matches", label: "Fixtures", hint: "Upcoming & past matches", icon: Swords, keywords: ["schedule"] },
      { to: "/match-center/teams", label: "Teams", hint: "Squads & line-ups", icon: Trophy },
      { to: "/match-center/records", label: "Scorecards", hint: "Official scorebooks", icon: FileText },
      { to: "/match-center/insights", label: "Statistics", hint: "Performance & records", icon: LineChart },
    ],
  },
  {
    title: "Fees",
    items: [
      { to: "/dashboard/fees", label: "Student Fees", hint: "Collect & track dues", icon: IndianRupee, requiresFeature: "fee_tracking" },
      { to: "/dashboard/fee-plans", label: "Fee Plans", hint: "Structures & pricing", icon: Wallet, requiresFeature: "fee_tracking" },
      { to: "/dashboard/reminders", label: "Reminders", hint: "Nudge unpaid families", icon: BellRing, requiresFeature: "fee_tracking" },
      { to: "/dashboard/reports", label: "Fee Reports", hint: "Collections & aging", icon: BarChart3, keywords: ["billing", "revenue"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/dashboard/communications", label: "Broadcasts", hint: "Send announcements", icon: Send, keywords: ["whatsapp", "sms", "email", "notifications"] },
      { to: "/dashboard/communications", label: "Templates", hint: "Reusable message templates", icon: FileText },
      { to: "/dashboard/notifications", label: "Notifications", hint: "Delivery history", icon: BellRing },
    ],
  },
  {
    title: "Website",
    items: [
      { to: "/dashboard/site", label: "Public Website", hint: "Edit your public site", icon: Globe, keywords: ["seo", "gallery", "coaches", "programs", "policies", "faq", "admissions"] },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/dashboard/reports", label: "Decision Center", hint: "Attendance, fees, admissions, matches", icon: BarChart3 },
      { to: "/dashboard/insights", label: "Insights", hint: "Trends & AI signals", icon: Sparkles },
    ],
  },
  {
    title: "Team Management",
    items: [
      { to: "/dashboard/admins", label: "Admins & Staff", hint: "Invite, suspend, reset access", icon: ShieldCheck },
    ],
  },
  {
    title: "Academy Settings",
    items: [
      { to: "/dashboard/settings", label: "Academy Profile", hint: "Name, hours, contact", icon: Settings2 },
      { to: "/dashboard/branding", label: "Branding", hint: "Logo, theme, colors", icon: Palette },
    ],
  },
  {
    title: "AcademyOS",
    items: [
      { to: "/dashboard/subscription", label: "Subscription & Plan", hint: "Your AcademyOS plan", icon: CreditCard },
    ],
  },
];

// Admin — hides finances, subscription, website settings, admin-management, branding.
// Everything they see targets `canAccess(admin, ...)` features: attendance, players, match-center.
const ADMIN_GROUPS: Group[] = [
  {
    title: "Players",
    items: [
      { to: "/dashboard/students", label: "Players", hint: "Roster & profiles", icon: Users },
      { to: "/dashboard/registrations", label: "Registrations", hint: "New sign-ups", icon: Inbox },
      { to: "/dashboard/attendance", label: "Attendance", hint: "Daily attendance", icon: ClipboardCheck },
      { to: "/dashboard/batches", label: "Batches", hint: "Timings & groups", icon: Activity },
    ],
  },
  {
    title: "Matches",
    items: [
      { to: "/match-center", label: "Match Center", hint: "Cricket workspace", icon: Swords },
      { to: "/match-center/matches", label: "Fixtures", hint: "Upcoming & past matches", icon: Swords },
      { to: "/match-center/teams", label: "Teams", hint: "Squads & line-ups", icon: Trophy },
      { to: "/match-center/records", label: "Scorecards", hint: "Official scorebooks", icon: FileText },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/dashboard/communications", label: "Broadcasts", hint: "Send announcements", icon: Send },
      { to: "/dashboard/notifications", label: "Notifications", hint: "Delivery history", icon: BellRing },
    ],
  },
  {
    title: "Reports",
    items: [
      { to: "/dashboard/reports", label: "Reports", hint: "Attendance, players, matches", icon: BarChart3 },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/dashboard/profile", label: "Personal Settings", hint: "Your account", icon: UserCircle },
    ],
  },
];

// Player / Parent — personal management area. Uses existing /student and
// /parent routes. Everything else is intentionally omitted.
const PLAYER_GROUPS: Group[] = [
  {
    title: "Profile",
    items: [
      { to: "/student/profile", label: "My Profile", hint: "Personal details", icon: UserCircle, keywords: ["family", "emergency", "contact"] },
    ],
  },
  {
    title: "Training",
    items: [
      { to: "/student", label: "My Attendance", hint: "Sessions & streaks", icon: ClipboardCheck },
      { to: "/student/progress", label: "My Performance", hint: "Progress & milestones", icon: LineChart, keywords: ["stats"] },
    ],
  },
  {
    title: "Matches",
    items: [
      { to: "/student/matches", label: "My Matches", hint: "Fixtures & scorecards", icon: Swords, keywords: ["statistics", "awards"] },
    ],
  },
  {
    title: "Fees",
    items: [
      { to: "/fees", label: "My Fees", hint: "Payments & receipts", icon: IndianRupee, keywords: ["history"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { to: "/dashboard/notifications", label: "Notifications", hint: "Announcements & alerts", icon: BellRing, keywords: ["messages"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/student/profile", label: "Account", hint: "Password & language", icon: KeyRound, keywords: ["help", "support"] },
    ],
  },
];

function groupsFor(role: "owner" | "admin" | "student"): Group[] {
  if (role === "owner") return OWNER_GROUPS;
  if (role === "admin") return ADMIN_GROUPS;
  return PLAYER_GROUPS;
}

function ManageHub() {
  const { profile, tenant } = useDashboard();
  const role = useCurrentRole();
  const features = getFeatures(tenant);
  const [q, setQ] = useState("");

  const groups = useMemo<Group[]>(() => {
    const raw = groupsFor(role);
    // Feature-gate items (hide fee_tracking if disabled).
    const gated = raw
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => !i.requiresFeature || features[i.requiresFeature] !== false,
        ),
      }))
      .filter((g) => g.items.length > 0);

    if (!q.trim()) return gated;
    const needle = q.toLowerCase();
    return gated
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(needle) ||
            i.hint.toLowerCase().includes(needle) ||
            g.title.toLowerCase().includes(needle) ||
            (i.keywords ?? []).some((k) => k.toLowerCase().includes(needle)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [role, q, features]);

  const roleLabel =
    role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Player";

  return (
    <div className="-mt-4 md:-mt-8 space-y-4 pb-4">
      {/* Header — uniform across dashboard tabs */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight leading-tight truncate">
            Manage
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            {tenant.name} · {roleLabel}
          </p>
        </div>
      </header>

      {/* Universal search */}
      <SearchBar
        value={q}
        onChange={setQ}
        placeholder="Search anything — players, matches, reports, settings…"
      />

      {groups.length === 0 ? (
        <div className="grid place-items-center py-16 text-center text-muted-foreground">
          <Search className="size-6 mb-2" />
          <p className="text-sm">No results for "{q}"</p>
        </div>
      ) : (
        groups.map((group) => (
          <Section key={group.title} title={group.title}>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {group.items.map((item) => (
                <HubTile key={group.title + item.to + item.label} item={item} />
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
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HubTile({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
    >
      <Card className="group h-full p-3.5 min-h-[64px]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl"
            style={{
              backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
              color: "var(--brand)",
            }}
          >
            <Icon className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <div
              className="font-semibold leading-tight text-[14px] break-words line-clamp-2"
              title={item.label}
            >
              {item.label}
            </div>
            <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5 break-words line-clamp-2">
              {item.hint}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
