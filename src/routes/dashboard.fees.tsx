/**
 * Fees — single money hub.
 *
 * Every fees surface (Collections, Approvals, Fee Plans, Setup, Reminders)
 * lives inside THIS route as an in-page tab panel. No route hops means:
 *   - the header + tab bar never move between tabs (uniform hierarchy)
 *   - switching tabs is instant (no network round trip, React Query cache)
 *   - mobile users get one scroll container, one sticky header
 *
 * The old routes (/dashboard/payment-verification, /dashboard/fee-plans,
 * /dashboard/payment-settings, /dashboard/reminders) redirect here with the
 * matching ?tab= so deep links and bookmarks keep working.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { useDashboard } from "@/lib/dashboard-context";
import { listPendingManualPayments } from "@/lib/payments/manual.functions";
import { CollectionsPanel } from "@/components/fees/CollectionsPanel";
import { ApprovalsPanel } from "@/components/fees/ApprovalsPanel";
import { FeePlansPanel } from "@/components/fees/FeePlansPanel";
import { SetupPanel } from "@/components/fees/SetupPanel";
import { RemindersPanel } from "@/components/fees/RemindersPanel";
import { cn } from "@/lib/utils";
import { BellRing } from "lucide-react";

export type FeesTab = "collections" | "approvals" | "plans" | "setup" | "reminders";
type Filter = "all" | "pending" | "paid" | "overdue";

const TABS: { key: FeesTab; label: string }[] = [
  { key: "collections", label: "Collections" },
  { key: "approvals", label: "Approvals" },
  { key: "plans", label: "Fee Plans" },
  { key: "setup", label: "Setup" },
  { key: "reminders", label: "Reminders" },
];

export const Route = createFileRoute("/dashboard/fees")({
  head: () => ({
    meta: [{ title: "Fees · Academy dashboard" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>): { filter?: Filter; tab?: FeesTab } => {
    const f = search.filter;
    const t = search.tab;
    return {
      ...(f === "pending" || f === "paid" || f === "all" || f === "overdue" ? { filter: f } : {}),
      ...(TABS.some((x) => x.key === t) ? { tab: t as FeesTab } : {}),
    };
  },
  component: () => (
    <OwnerOnly>
      <FeesHub />
    </OwnerOnly>
  ),
});

function FeesHub() {
  const { tenant } = useDashboard();
  const { tab = "collections", filter } = Route.useSearch();
  const navigate = useNavigate();
  const listPending = useServerFn(listPendingManualPayments);

  const pending = useQuery({
    queryKey: ["fees-hub", "pending-manual", tenant.id],
    queryFn: async () => {
      const rows = await listPending({ data: { tenantId: tenant.id } });
      return Array.isArray(rows) ? rows.length : 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const pendingCount = pending.data ?? 0;

  const go = (next: FeesTab) =>
    navigate({
      to: "/dashboard/fees",
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: next }),
      replace: true,
    });

  return (
    <div className="-mt-4 md:-mt-8">
      {/* Sticky, always-identical header. Nothing below it ever shifts it. */}
      <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pt-2 backdrop-blur md:-mx-6 md:px-6">
        <h1 className="text-base font-bold tracking-tight md:text-xl">Fees</h1>
        <p className="mb-2 hidden text-[11px] text-muted-foreground md:block">
          Collections, approvals, plans and payment setup — all in one place.
        </p>

        <nav
          aria-label="Fees sections"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6"
        >
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => go(t.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t.label}
                  {t.key === "approvals" && pendingCount > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        active ? "bg-background text-foreground" : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {pendingCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-3 pb-24">
        {tab === "collections" && (
          <>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => go("approvals")}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-left"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/20">
                  <BellRing className="size-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">
                    {pendingCount} payment {pendingCount === 1 ? "proof" : "proofs"} waiting for you
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Parents sent a screenshot / UTR — verify to mark collected.
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-primary">Review</span>
              </button>
            )}
            <CollectionsPanel initialFilter={filter} />
          </>
        )}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "plans" && <FeePlansPanel />}
        {tab === "setup" && <SetupPanel />}
        {tab === "reminders" && <RemindersPanel />}
      </div>
    </div>
  );
}
