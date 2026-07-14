import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  Bell,
  ChevronRight,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/match-center/profile")({
  head: () => ({ meta: [{ title: "Profile · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { tenant, profile, session, signOut } = useDashboard();
  const navigate = useNavigate();
  const owner = isOwner(profile);

  const initials = (session.user.email ?? "?")
    .split("@")[0]
    .split(/[.\-_]/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-xl pb-2">
      {/* Identity card */}
      <div className="rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="grid size-16 shrink-0 place-items-center rounded-2xl text-white text-xl font-bold"
            style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
          >
            {initials || <UserCircle className="size-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold leading-tight">
              {session.user.email}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="truncate">{tenant.name}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">
                <ShieldCheck className="size-3" /> {profile.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-border/60 bg-card/60">
        <Row
          icon={Bell}
          label="Notifications"
          hint="Alerts and match updates"
          onClick={() => {
            /* future notifications */
          }}
          disabled
        />
        <Divider />
        <Row
          icon={SettingsIcon}
          label="Settings"
          hint="Preferences and match defaults"
          onClick={() => navigate({ to: "/match-center/settings" })}
        />
        {owner && (
          <>
            <Divider />
            <Row
              icon={ShieldCheck}
              label="Scorers"
              hint="Manage authorised scorers"
              onClick={() => navigate({ to: "/match-center/scorers" })}
            />
          </>
        )}
      </div>

      {/* Footer action */}
      <div className="mt-6 px-1">
        {owner ? (
          <Button
            className="h-12 w-full rounded-2xl text-[15px] font-semibold"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            <ArrowRightLeft className="mr-2 size-4" />
            Switch to Academy
          </Button>
        ) : (
          <Button
            variant="destructive"
            className="h-12 w-full rounded-2xl bg-destructive/10 text-destructive text-[15px] font-semibold hover:bg-destructive/15"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-2 size-4" /> Log out
          </Button>
        )}
      </div>

      <div className="mt-4 text-center text-[11px] text-muted-foreground">
        Match Center · v1.0.4
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left no-tap-highlight transition-colors",
        disabled ? "opacity-55" : "active:bg-accent/40",
      )}
    >
      <div className="grid size-9 place-items-center rounded-xl bg-muted/70">
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-tight">{label}</div>
        {hint && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <ChevronRight className="size-4 text-muted-foreground/60" />
    </button>
  );
}

function Divider() {
  return <div className="ml-[68px] h-px bg-border/60" />;
}
