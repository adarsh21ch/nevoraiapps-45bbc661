import { createFileRoute, Link } from "@tanstack/react-router";
import { useDashboard } from "@/lib/dashboard-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  ExternalLink,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Wallet,
  ClipboardCheck,
  BellRing,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";
import { StoragedImage } from "@/components/site/StoragedImage";
import { tenantSiteUrl } from "@/lib/tenant";


export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { tenant, session, profile, signOut } = useDashboard();
  const wa = tenant.whatsapp?.replace(/[^\d]/g, "");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and academy details.</p>
      </header>

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
            <a href={`tel:${tenant.phone}`} className="flex items-center gap-2 text-foreground hover:opacity-80">
              <Phone className="h-4 w-4" style={{ color: "var(--brand)" }} /> {tenant.phone}
            </a>
          ) : null}
          {wa ? (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-foreground hover:opacity-80">
              <MessageCircle className="h-4 w-4" style={{ color: "var(--brand)" }} /> WhatsApp
            </a>
          ) : null}
          {tenant.email ? (
            <a href={`mailto:${tenant.email}`} className="flex items-center gap-2 text-foreground hover:opacity-80">
              <Mail className="h-4 w-4" style={{ color: "var(--brand)" }} /> {tenant.email}
            </a>
          ) : null}
          {tenant.address ? (
            <div className="flex items-start gap-2 text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} /> {tenant.address}
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

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Manage</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { to: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
            { to: "/dashboard/reminders", label: "Reminders", icon: BellRing },
            { to: "/dashboard/batches", label: "Batches", icon: CalendarDays },
            { to: "/dashboard/fee-plans", label: "Fee plans", icon: Wallet },
            { to: "/dashboard/reports", label: "Reports", icon: BarChart3 },
          ].map((l) => {

            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-xs font-medium text-foreground hover:bg-muted"
              >
                <Icon className="size-5" style={{ color: "var(--brand)" }} />
                {l.label}
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 text-sm">
        <h2 className="font-semibold mb-1">Need help?</h2>
        <p className="text-muted-foreground">
          Message us on WhatsApp and we'll help you set up anything — from adding students to sending fee reminders.
        </p>
      </Card>
    </div>
  );
}
