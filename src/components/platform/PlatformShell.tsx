import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, Building2, Plus, Receipt, LogOut, Menu, Shield, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/lib/platform-context";

const nav = [
  { to: "/platform-admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/platform-admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/platform-admin/subscriptions", label: "Subscriptions", icon: Receipt },
  { to: "/platform-admin/new", label: "Onboard new client", icon: Plus },
  { to: "/platform-admin/settings", label: "Contact settings", icon: Settings },
];

export function PlatformShell({ children }: { children: ReactNode }) {
  const { session, signOut } = usePlatform();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-neutral-950 text-neutral-100 border-r border-white/10">
              <Inner onNavigate={() => setOpen(false)} onSignOut={signOut} email={session.user.email ?? ""} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-md grid place-items-center bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow">
              <Shield className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Platform admin</div>
              <div className="text-[10px] uppercase tracking-wide text-neutral-400 truncate">
                {session.user.email}
              </div>
            </div>
          </div>

          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={signOut} className="hidden md:inline-flex text-white hover:bg-white/10">
              <LogOut className="size-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden md:block w-64 border-r border-white/10 bg-neutral-950 sticky top-[57px] h-[calc(100vh-57px)]">
          <Inner onSignOut={signOut} email={session.user.email ?? ""} />
        </aside>
        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

function Inner({
  onNavigate, onSignOut, email,
}: { onNavigate?: () => void; onSignOut: () => void; email: string }) {
  const loc = useLocation();
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b border-white/10 hidden md:block">
        <div className="text-xs uppercase tracking-widest text-neutral-400">Signed in</div>
        <div className="text-sm truncate">{email}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {nav.map((n) => {
          const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-white/10 text-white font-medium" : "text-neutral-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-white/10">
        <Button variant="ghost" size="sm" className="w-full justify-start text-neutral-300 hover:text-white hover:bg-white/10" onClick={onSignOut}>
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}
