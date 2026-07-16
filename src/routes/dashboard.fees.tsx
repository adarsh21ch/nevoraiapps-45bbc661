/**
 * Phase 13.3 — Canonical Billing Migration.
 *
 * The legacy fee register lived here and read/wrote the deprecated
 * `payments` table via `studentDue()`. Both are superseded by the
 * canonical billing engine (`billing_invoices` + `billing_payments`,
 * consumed through `fetchBillingKpis`).
 *
 * This route is kept for backward-compatibility (deep links, bookmarks,
 * older UI, external references from NevorAI actions and reminders).
 * It now redirects internally to `/dashboard/billing`, which is the
 * single source of truth for every finance surface.
 *
 * Do NOT re-introduce `payments` reads or `studentDue` here.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/fees")({
  validateSearch: (search: Record<string, unknown>): { filter?: string } => {
    const f = search.filter;
    return typeof f === "string" ? { filter: f } : {};
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/dashboard/billing",
      search: search as Record<string, unknown>,
      replace: true,
    });
  },
  component: () => null,
});
