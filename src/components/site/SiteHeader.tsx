import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/star-players", label: "Star Players" },
  { to: "/fees", label: "Fees" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const tenant = useTenant();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {tenant.name.charAt(0)}
            </div>
          )}
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-foreground">{tenant.name}</div>
            {tenant.tagline ? (
              <div className="text-[11px] text-muted-foreground">{tenant.tagline}</div>
            ) : null}
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={active ? { color: "var(--brand)" } : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/auth"
            className="ml-1 rounded-full border border-border/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            Owner login
          </Link>
          <Link
            to="/register"
            className="ml-1 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Register
          </Link>
        </nav>




        <button
          type="button"
          className="rounded-md p-2 text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-foreground/90 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="mx-1 my-2 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              Register Now
            </Link>
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="mx-1 mb-2 rounded-full border border-border px-4 py-2 text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Owner login
            </Link>

          </div>
        </div>
      ) : null}
    </header>
  );
}
