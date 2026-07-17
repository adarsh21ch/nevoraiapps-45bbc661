import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboard } from "@/lib/dashboard-context";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ExternalLink,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  UserCircle,
  BellRing,
  Palette,
  Settings2,
  CreditCard,
  Globe,
  ShieldCheck,
  LifeBuoy,
  AlertTriangle,
  Database,
  ChevronRight,
  KeyRound,
  Zap,
  HeartPulse,
} from "lucide-react";
import { StoragedImage } from "@/components/site/StoragedImage";
import { tenantSiteUrl } from "@/lib/tenant";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({
    meta: [{ title: "Profile · AcademyOS" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

type Row = {
  to: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  danger?: boolean;
};
type Section = { title: string; rows: Row[] };

function ProfilePage() {
  const { tenant, session, profile, signOut } = useDashboard();
  const role = useCurrentRole();
  const wa = tenant.whatsapp?.replace(/[^\d]/g, "");
  const isOwner = role === "owner";

  const sections: Section[] = [];

  // My Account — everyone
  sections.push({
    title: "My Account",
    rows: [
      {
        to: "/dashboard/settings",
        label: "My Profile",
        hint: "Name and personal details",
        icon: UserCircle,
      },
      {
        to: "/dashboard/settings",
        label: "Password",
        hint: "Change your password",
        icon: KeyRound,
      },
      {
        to: "/dashboard/notifications",
        label: "Notifications",
        hint: "Delivery history & alerts",
        icon: BellRing,
      },
      {
        to: "/dashboard/settings",
        label: "Language & Theme",
        hint: "Interface preferences",
        icon: Palette,
      },
    ],
  });

  // Academy Settings — owner only
  if (isOwner) {
    sections.push({
      title: "Academy Settings",
      rows: [
        {
          to: "/dashboard/settings",
          label: "Academy Profile",
          hint: "Name, hours, contact, address",
          icon: Settings2,
        },
        {
          to: "/dashboard/branding",
          label: "Branding",
          hint: "Logo, theme, colors",
          icon: Palette,
        },
        {
          to: "/dashboard/site",
          label: "Public Website",
          hint: "Edit pages, SEO, social, payments",
          icon: Globe,
        },
        {
          to: "/dashboard/payment-settings",
          label: "Payment Settings",
          hint: "Providers, offline payments & receipts",
          icon: CreditCard,
        },
        {
          to: "/dashboard/automation-settings",
          label: "Automation",
          hint: "Rules, triggers & scheduled workflows",
          icon: Zap,
        },
        {
          to: "/dashboard/subscription",
          label: "Subscription & Plan",
          hint: "Your AcademyOS plan",
          icon: CreditCard,
        },
      ],
    });

    sections.push({
      title: "Data",
      rows: [
        {
          to: "/dashboard/students",
          label: "Import & Export Students",
          hint: "Bulk upload, downloads & backup",
          icon: Database,
        },
      ],
    });
  }

  sections.push({
    title: "Security",
    rows: [
      {
        to: "/dashboard/staff",
        label: "Team & Access",
        hint: "Members, invitations & role assignments",
        icon: ShieldCheck,
      },
    ],
  });

  sections.push({
    title: "Support",
    rows: [
      {
        to: "/dashboard/settings",
        label: "Help & Support",
        hint: "Contact us and get help",
        icon: LifeBuoy,
      },
      ...(isOwner
        ? [
            {
              to: "/dashboard/nevorai-health",
              label: "NevorAI Health",
              hint: "AI service status & diagnostics",
              icon: HeartPulse,
            } as Row,
          ]
        : []),
    ],
  });

  if (isOwner) {
    sections.push({
      title: "Danger Zone",
      rows: [
        {
          to: "/dashboard/settings",
          label: "Delete or Transfer Academy",
          hint: "Destructive actions",
          icon: AlertTriangle,
          danger: true,
        },
      ],
    });
  }

  return (
    <div className="space-y-5 pb-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and academy configuration.</p>
      </header>

      {/* Identity card */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div
            className="size-14 rounded-xl grid place-items-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: "var(--brand, #0ea5e9)" }}
          >
            {tenant.logo_url ? (
              <StoragedImage
                path={tenant.logo_url}
                alt={tenant.name}
                className="size-14 rounded-xl object-cover"
                fallback={<span>{tenant.name.slice(0, 2).toUpperCase()}</span>}
              />
            ) : (
              tenant.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{tenant.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {session.user.email} · <span className="capitalize">{profile.role}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          {tenant.phone ? (
            <a
              href={`tel:${tenant.phone}`}
              className="flex items-center gap-2 text-foreground hover:opacity-80"
            >
              <Phone className="h-4 w-4" style={{ color: "var(--brand)" }} /> {tenant.phone}
            </a>
          ) : null}
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-foreground hover:opacity-80"
            >
              <MessageCircle className="h-4 w-4" style={{ color: "var(--brand)" }} /> WhatsApp
            </a>
          ) : null}
          {tenant.email ? (
            <a
              href={`mailto:${tenant.email}`}
              className="flex items-center gap-2 text-foreground hover:opacity-80"
            >
              <Mail className="h-4 w-4" style={{ color: "var(--brand)" }} /> {tenant.email}
            </a>
          ) : null}
          {tenant.address ? (
            <div className="flex items-start gap-2 text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} />{" "}
              {tenant.address}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={tenantSiteUrl(tenant)} target="_blank" rel="noreferrer">
              View public site <ExternalLink className="size-3 ml-1" />
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </div>
      </Card>

      {/* Grouped settings sections */}
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {section.title}
          </h2>
          <Card className="overflow-hidden p-0 divide-y divide-border">
            {section.rows.map((row) => {
              const Icon = row.icon;
              return (
                <Link
                  key={section.title + row.label}
                  to={row.to}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 active:bg-muted/80 transition-colors"
                >
                  <span
                    className={
                      "inline-flex size-9 items-center justify-center rounded-lg " +
                      (row.danger
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground")
                    }
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        "text-[15px] font-medium leading-tight " +
                        (row.danger ? "text-destructive" : "")
                      }
                    >
                      {row.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{row.hint}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
