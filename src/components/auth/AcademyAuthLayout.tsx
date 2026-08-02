import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { signedUrl } from "@/lib/storage";
import { getPageHeroImages } from "@/lib/page-hero-images";
import { useTenantState } from "@/lib/tenant-context";
import { AcademyLogo } from "./AcademyLogo";

export interface AcademyBrand {
  name: string;
  initials: string;
  accent: string;
  logoPath: string | null;
  tagline: string | null;
  heroImage: string | null;
  resolved: boolean;
}

/** Resolves brand identity for the auth surface from the current tenant (hostname-based). */
export function useAcademyBrand(): AcademyBrand {
  const state = useTenantState();
  const tenant = state.status === "ready" || state.status === "suspended" ? state.tenant : null;
  return useMemo(() => {
    const name = tenant?.name ?? "AcademyOS";
    const initials =
      (tenant?.short_name?.trim() ||
        name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")) ?? "A";
    return {
      name,
      initials: initials.slice(0, 3).toUpperCase(),
      accent: tenant?.primary_color || "#2563EB",
      logoPath: tenant?.logo_url ?? null,
      tagline: tenant?.tagline ?? null,
      heroImage: getPageHeroImages(tenant, "home")[0] ?? null,
      resolved: !!tenant,
    };
  }, [tenant]);
}

/** Resolves one storage path (or URL) to a displayable background URL. */
function useBackgroundUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith("http") || path.startsWith("/")) {
      setUrl(path);
      return;
    }
    let active = true;
    signedUrl(path)
      .then((u) => active && setUrl(u || null))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

/**
 * Full-screen member-portal shell.
 * Mobile: single column, safe-area aware, uses 100dvh so the mobile keyboard
 * and browser chrome never trap the CTA. Desktop: brand panel + form panel.
 */
export function AcademyAuthLayout({ children }: { children: ReactNode }) {
  const brand = useAcademyBrand();
  const bg = useBackgroundUrl(brand.heroImage);

  return (
    <div
      className="relative min-h-dvh w-full overflow-x-hidden bg-auth-bg text-auth-foreground"
      style={{ "--brand-accent-auth": brand.accent } as React.CSSProperties}
    >
      {/* Background: academy imagery when available, always behind a heavy navy scrim */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {bg ? (
          <img
            src={bg}
            alt=""
            aria-hidden
            fetchPriority="low"
            className="size-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,24,0.86),rgba(4,10,24,0.97))]" />
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-25 blur-[130px]"
          style={{ backgroundColor: brand.accent }}
        />
      </div>

      <div className="mx-auto grid min-h-dvh w-full lg:grid-cols-[1.05fr_1fr]">
        <BrandPanel brand={brand} />
        <main
          className="flex w-full flex-col justify-center px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8"
          style={{ minHeight: "100dvh" }}
        >
          <div className="mx-auto w-full max-w-[400px]">
            {/* Compact brand lockup — mobile only */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <AcademyLogo
                path={brand.logoPath}
                name={brand.name}
                initials={brand.initials}
                accent={brand.accent}
                className="size-11"
              />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight">{brand.name}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-auth-subtle">
                  Member portal
                </p>
              </div>
            </div>
            {children}
            <div className="mt-7 text-center">
              <Link
                to="/"
                className="text-xs text-auth-subtle transition-colors hover:text-auth-foreground"
              >
                ← Back to {brand.resolved ? "academy website" : "home"}
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrandPanel({ brand }: { brand: AcademyBrand }) {
  return (
    <aside className="relative hidden flex-col justify-between p-12 lg:flex">
      <Link to="/" className="flex items-center gap-3">
        <AcademyLogo
          path={brand.logoPath}
          name={brand.name}
          initials={brand.initials}
          accent={brand.accent}
          className="size-12"
        />
        <span>
          <span className="block text-[17px] font-semibold leading-tight">{brand.name}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-auth-subtle">
            Member portal
          </span>
        </span>
      </Link>

      <div className="max-w-md">
        <h2 className="text-5xl font-bold leading-[1.02] tracking-tight">Train. Track. Improve.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-auth-muted">
          Your academy, performance and progress — all in one place.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {["Training", "Attendance", "Matches", "Performance"].map((f) => (
            <li
              key={f}
              className="rounded-full border border-auth-border bg-auth-elevated px-3 py-1.5 text-xs font-medium text-auth-muted backdrop-blur"
            >
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[10px] uppercase tracking-[0.28em] text-auth-subtle">
        {brand.tagline ?? "Students · Parents · Academy staff"}
      </p>
    </aside>
  );
}
