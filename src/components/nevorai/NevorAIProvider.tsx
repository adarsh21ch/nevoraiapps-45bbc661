/**
 * NevorAI Global Provider
 * -----------------------
 * NevorAI is a normal dashboard route (`/dashboard/nevorai`). This provider
 * only supplies helpers so any component in the tree can navigate into it —
 * optionally with a pre-filled prompt — and check whether it is currently
 * active. There is no popup/sheet: opening simply routes to the tab, and
 * closing routes back to the dashboard home. This keeps the shell (top
 * header + bottom nav) intact and matches how Attendance / Fees / Manage /
 * Branding open on mobile, so the keyboard and viewport behave correctly.
 */

import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  NevorAIPageContextProvider,
} from "@/lib/nevorai/page-context";

const PENDING_PROMPT_KEY = "nevorai:pendingPrompt";

type NevorAIState = {
  open: (opts?: { prompt?: string }) => void;
  close: () => void;
  isOpen: boolean;
};

const NevorAICtx = createContext<NevorAIState | null>(null);

export function useNevorAI(): NevorAIState {
  return (
    useContext(NevorAICtx) ?? {
      open: () => {},
      close: () => {},
      isOpen: false,
    }
  );
}

export function consumePendingNevorAIPrompt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (v) window.sessionStorage.removeItem(PENDING_PROMPT_KEY);
    return v;
  } catch {
    return null;
  }
}

export function NevorAIProvider({ children }: { children: ReactNode }) {
  return (
    <NevorAIPageContextProvider>
      <NevorAIInner>{children}</NevorAIInner>
    </NevorAIPageContextProvider>
  );
}

function NevorAIInner({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isOpen = pathname === "/dashboard/nevorai" || pathname.startsWith("/dashboard/nevorai/");

  const open = useCallback(
    (opts?: { prompt?: string }) => {
      if (opts?.prompt && typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(PENDING_PROMPT_KEY, opts.prompt);
        } catch {
          /* ignore quota / private mode */
        }
      }
      if (!isOpen) navigate({ to: "/dashboard/nevorai" });
    },
    [isOpen, navigate],
  );

  const close = useCallback(() => {
    if (isOpen) navigate({ to: "/dashboard" });
  }, [isOpen, navigate]);

  const state = useMemo<NevorAIState>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return <NevorAICtx.Provider value={state}>{children}</NevorAICtx.Provider>;
}
