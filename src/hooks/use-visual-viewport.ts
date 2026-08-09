import { useEffect, useState } from "react";

export type ViewportInsets = {
  /** Visible height in px. 0 during SSR — callers must fall back to CSS 100dvh. */
  height: number;
  /** How far the visual viewport has been scrolled inside the layout viewport.
   *  Non-zero on iOS when the keyboard pushes the page up. THIS is what a
   *  position:fixed element must translate by to stay pinned to the screen. */
  offsetTop: number;
  /** True when the on-screen keyboard is open. */
  keyboardOpen: boolean;
};

/**
 * useViewportInsets — the single source of truth for mobile viewport state.
 * Subscribes to visualViewport resize and scroll events with rAF throttling.
 */
export function useViewportInsets(): ViewportInsets {
  const [insets, setInsets] = useState<ViewportInsets>({
    height: 0,
    offsetTop: 0,
    keyboardOpen: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    let rafId: number | null = null;

    const update = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!vv) {
          setInsets({
            height: window.innerHeight,
            offsetTop: 0,
            keyboardOpen: false,
          });
          return;
        }

        const height = vv.height;
        const offsetTop = vv.offsetTop;
        // Threshold of 120px avoids false positives from URL bar hide/show on scroll.
        const keyboardOpen = window.innerHeight - height > 120;

        setInsets({ height, offsetTop, keyboardOpen });
      });
    };

    update();

    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("resize", update);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, []);

  return insets;
}

/**
 * Tracks the real visual viewport height in pixels. On iOS Safari the layout
 * viewport (and `100dvh`) does NOT shrink when the on-screen keyboard opens —
 * only `window.visualViewport.height` reflects the actually visible area.
 *
 * Returns 0 during SSR / before hydration so callers can fall back to CSS.
 */
export function useVisualViewportHeight(): number {
  return useViewportInsets().height;
}

/**
 * True when the on-screen keyboard is likely open.
 */
export function useKeyboardOpen(): boolean {
  return useViewportInsets().keyboardOpen;
}
