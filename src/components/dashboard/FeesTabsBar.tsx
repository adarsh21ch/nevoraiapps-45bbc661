/**
 * Shared sub-navigation for the Fees family of pages.
 *
 * Phase 5 (UI discoverability): the owner "Fees" tab in the sidebar now opens
 * a single money-management surface. Every fees-adjacent route renders this
 * bar so the owner can move between:
 *
 *   Collections   — /dashboard/fees              (paid / pending / overdue list)
 *   Approvals     — /dashboard/payment-verification (manual UPI / QR proofs)
 *   Fee Plans     — /dashboard/fee-plans
 *   Setup         — /dashboard/payment-settings   (UPI id, QR image, providers)
 *   Reminders     — /dashboard/reminders          (delivery history)
 *
 * The individual routes stay live so deep links keep working; this bar just
 * makes them reachable from one entry point instead of being orphaned.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDashboard } from "@/lib/dashboard-context";
import { listPendingManualPayments } from "@/lib/payments/manual.functions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tab = {
  to: string;
  label: string;
  matchPrefix?: string[];
};

const TABS: Tab[] = [
  { to: "/dashboard/fees", label: "Collections" },
  { to: "/dashboard/payment-verification", label: "Approvals" },
  { to: "/dashboard/fee-plans", label: "Fee Plans" },
  { to: "/dashboard/payment-settings", label: "Setup" },
  { to: "/dashboard/reminders", label: "Reminders" },
];

export function FeesTabsBar() {
  const { tenant } = useDashboard();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const listPending = useServerFn(listPendingManualPayments);

  // Small badge on Approvals so owners notice when a student sends a proof.
  const pending = useQuery({
    queryKey: ["fees-tabs", "pending-manual", tenant.id],
    queryFn: async () => {
      const rows = await listPending({ data: { tenantId: tenant.id } });
      return Array.isArray(rows) ? rows.length : 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <nav
      aria-label="Fees sections"
      className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.to || (tab.matchPrefix?.some((p) => pathname.startsWith(p)) ?? false);
        const showBadge =
          tab.to === "/dashboard/payment-verification" && (pending.data ?? 0) > 0;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {showBadge && (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                  {pending.data}
                </Badge>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
