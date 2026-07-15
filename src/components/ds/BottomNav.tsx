import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentRole } from "@/hooks/use-current-role";
import { navByRole, type NavItem } from "@/lib/nav-config";
import { getFeatures } from "@/lib/tenant";
import { useDashboardOptional } from "@/lib/dashboard-context";
import { safeArea } from "./tokens";

/**
 * BottomNav — role-aware, safe-area-aware, native-feeling bottom navigation.
 *
 * Mobile only (hidden md+). Replaces both `GlobalBottomNav` and
 * `MatchCenterBottomNav`. Items come from `navByRole` and are filtered by
 * tenant feature flags where applicable.
 */
export function BottomNav({
  badges,
  liveKeys,
  className,
}: {
  /** Numeric badges keyed by nav item `to`. */
  badges?: Record<string, number>;
  /** Pulse-dot keys keyed by nav item `to` (e.g. live match indicator). */
  liveKeys?: string[];
  className?: string;
}) {
  const role = useCurrentRole();
  const dash = useDashboardOptional();
  const features = dash ? getFeatures(dash.tenant) : { fee_tracking: true };
  const location = useLocation();

  const items = navByRole[role].filter(
    (n: NavItem) => !n.requiresFeature || features[n.requiresFeature] !== false,
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      style={{ paddingBottom: safeArea.bottom }}
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active =
            item.to === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const badge = badges?.[item.to] ?? 0;
          const isLive = liveKeys?.includes(item.to) ?? false;
          const ariaLabel = isLive
            ? `${item.label} — live`
            : badge > 0
              ? `${item.label}, ${badge} pending`
              : item.label;
          return (
            <li key={`${item.to}-${item.label}`}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                aria-label={ariaLabel}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 pt-1.5 pb-1 text-[10.5px] font-medium outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:rounded-md",
                  "transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-b-full"
                    style={{ backgroundColor: "var(--brand)" }}
                  />
                )}
                <span className="relative inline-flex">
                  <Icon className="size-[22px]" />
                  {isLive ? (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-1 size-2 rounded-full bg-rose-600 ring-2 ring-background animate-pulse"
                    />
                  ) : null}
                  {badge > 0 && !isLive ? (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 grid place-items-center rounded-full text-[9px] font-bold text-white bg-rose-600 ring-2 ring-background"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate max-w-[72px] leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
