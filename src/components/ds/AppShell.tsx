import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { safeArea } from "./tokens";

/**
 * AppShell — root container for every authenticated screen.
 *
 * Provides safe-area padding (notch + home indicator), a fixed top bar slot,
 * a fixed bottom nav slot, and a scrollable content region between them.
 *
 * Desktop degrades gracefully — the sticky bars work at every width.
 */
export function AppShell({
  topBar,
  bottomNav,
  children,
  className,
}: {
  topBar?: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-[100dvh] bg-background text-foreground flex flex-col", className)}>
      {/* Safe-area top spacer keeps the top bar off the notch/Dynamic Island. */}
      <div aria-hidden style={{ height: safeArea.top }} className="bg-background" />
      {topBar ? (
        <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
          {topBar}
        </div>
      ) : null}

      <main
        className="flex-1 w-full mx-auto max-w-3xl px-4 pb-24 md:pb-8"
        style={{
          paddingLeft: `max(1rem, ${safeArea.left})`,
          paddingRight: `max(1rem, ${safeArea.right})`,
        }}
      >
        {children}
      </main>

      {bottomNav ? (
        <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">{bottomNav}</div>
      ) : null}
    </div>
  );
}
