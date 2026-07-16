/**
 * NevorAI Page Context
 * --------------------
 * A lightweight React context that lets any page register the entity/filter
 * state the user is currently viewing. NevorAI reads this so the assistant
 * always knows "where the owner is" — no need to re-explain in chat.
 *
 * Reuses the AIContext shape (Phase 11.0) — this only mirrors the
 * client-visible slice; server continues to build the authoritative
 * AIContext in `src/lib/ai-os/context/builder.ts`.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

export type NevorAIPageContext = {
  /** Route pathname the user is currently on. */
  currentScreen?: string;
  /** Human label (e.g. "Attendance", "Fees") for prompt suggestions. */
  screenLabel?: string;
  selectedStudentId?: string;
  selectedBatchId?: string;
  selectedInvoiceId?: string;
  selectedChildId?: string;
  selectedDate?: string;
  selectedCampaignId?: string;
  selectedLeadId?: string;
  selectedReportId?: string;
  selectedAutomationId?: string;
  currentFilters?: Record<string, string | number | boolean | null>;
  /** Free-form contextual note the page wants to include ("Editing Invoice INV-123"). */
  note?: string;
};

type Ctx = {
  page: NevorAIPageContext;
  set: (partial: NevorAIPageContext) => void;
  reset: () => void;
};

const NevorAIPageCtx = createContext<Ctx | null>(null);

export function NevorAIPageContextProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [page, setPage] = useState<NevorAIPageContext>({});

  // Keep the pathname in sync automatically.
  useEffect(() => {
    setPage((prev) => ({ ...prev, currentScreen: location.pathname }));
  }, [location.pathname]);

  const value = useMemo<Ctx>(
    () => ({
      page,
      set: (partial) => setPage((prev) => ({ ...prev, ...partial })),
      reset: () => setPage({ currentScreen: location.pathname }),
    }),
    [page, location.pathname],
  );

  return <NevorAIPageCtx.Provider value={value}>{children}</NevorAIPageCtx.Provider>;
}

export function useNevorAIPageContext(): NevorAIPageContext {
  return useContext(NevorAIPageCtx)?.page ?? {};
}

export function useNevorAIPageContextController(): Ctx {
  const ctx = useContext(NevorAIPageCtx);
  if (!ctx) {
    // Safe default so pages outside the provider don't crash.
    return { page: {}, set: () => {}, reset: () => {} };
  }
  return ctx;
}

/**
 * Convenience hook — pages call this once with the entity IDs / filters
 * they care about and NevorAI immediately understands the context.
 */
export function useRegisterPageContext(partial: NevorAIPageContext, deps: unknown[] = []) {
  const { set } = useNevorAIPageContextController();
  useEffect(() => {
    set(partial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
