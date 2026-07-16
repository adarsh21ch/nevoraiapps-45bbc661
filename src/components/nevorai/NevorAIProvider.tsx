/**
 * NevorAI Global Provider
 * -----------------------
 * Mounts once at the dashboard shell. Owns:
 *   • the slide-over Sheet (desktop right side, mobile bottom sheet)
 *   • a persistent conversation state that survives navigation
 *   • a pending prompt buffer for "Ask NevorAI" deep-links
 *   • the ambient page context that gets sent with every message
 *
 * Any component in the tree can call `useNevorAI()` to open the panel,
 * pre-fill a prompt, or read whether it is open.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ChatPanel } from "@/components/nevorai/ChatPanel";
import {
  NevorAIPageContextProvider,
  useNevorAIPageContext,
} from "@/lib/nevorai/page-context";
import { suggestionsForScreen } from "@/lib/nevorai/product-knowledge";

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

export function NevorAIProvider({ children }: { children: ReactNode }) {
  return (
    <NevorAIPageContextProvider>
      <NevorAIInner>{children}</NevorAIInner>
    </NevorAIPageContextProvider>
  );
}

function useVisualViewportHeight(active: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return height;
}

function NevorAIInner({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const pageContext = useNevorAIPageContext();
  const vvHeight = useVisualViewportHeight(isOpen);

  const open = useCallback((opts?: { prompt?: string }) => {
    if (opts?.prompt) setPendingPrompt(opts.prompt);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const state = useMemo<NevorAIState>(() => ({ open, close, isOpen }), [open, close, isOpen]);

  const suggestions = useMemo(
    () => suggestionsForScreen(pageContext.currentScreen ?? "/"),
    [pageContext.currentScreen],
  );

  // On mobile, size the sheet to the visual viewport so the keyboard
  // never pushes the composer off-screen. On sm+ we fall back to full height.
  const contentStyle: CSSProperties =
    vvHeight != null && typeof window !== "undefined" && window.innerWidth < 640
      ? { height: `${vvHeight}px`, maxHeight: `${vvHeight}px` }
      : {};

  return (
    <NevorAICtx.Provider value={state}>
      {children}
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          style={contentStyle}
          className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden border-l bg-background p-0 pt-0 pb-0 sm:h-full sm:max-h-none sm:max-w-[520px]"
        >
          <div
            className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-md text-white text-xs font-bold"
                style={{ backgroundColor: "var(--brand, #E8873C)" }}
              >
                ✨
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">NevorAI</div>
                <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  AI Academy Manager
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close NevorAI" className="shrink-0">
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ChatPanel
              conversationId={null}
              suggestions={suggestions}
              pageContext={pageContext}
              pendingPrompt={pendingPrompt}
              onPendingPromptConsumed={() => setPendingPrompt(null)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </NevorAICtx.Provider>
  );
}
