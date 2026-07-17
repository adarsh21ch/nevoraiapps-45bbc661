import { useEffect, useState } from "react";

/**
 * Tracks the real visual viewport height in pixels. On iOS Safari the layout
 * viewport (and `100dvh`) does NOT shrink when the on-screen keyboard opens —
 * only `window.visualViewport.height` reflects the actually visible area.
 *
 * Returns 0 during SSR / before hydration so callers can fall back to CSS.
 */
export function useVisualViewportHeight(): number {
  const [h, setH] = useState<number>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const read = () => setH(vv?.height ?? window.innerHeight);
    read();
    if (vv) {
      vv.addEventListener("resize", read);
      vv.addEventListener("scroll", read);
      return () => {
        vv.removeEventListener("resize", read);
        vv.removeEventListener("scroll", read);
      };
    }
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return h;
}

/**
 * True when the on-screen keyboard is likely open — i.e. the visual viewport
 * is meaningfully shorter than the layout viewport. Threshold of 120px avoids
 * false positives from URL bar hide/show on scroll.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const read = () => {
      const diff = window.innerHeight - vv.height;
      setOpen(diff > 120);
    };
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, []);
  return open;
}
