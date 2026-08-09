import { useEffect } from "react";

let lockCount = 0;
let previousStyle: string | null = null;
let previousScrollY = 0;

/**
 * useBodyLock — prevents the background from scrolling on mobile.
 * Reference-counted to support multiple overlapping shells.
 */
export function useBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    // Only apply on mobile-like viewports where it matters most
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    lockCount++;

    if (lockCount === 1) {
      previousScrollY = window.scrollY;
      previousStyle = document.body.style.cssText;
      
      // We use position: fixed to robustly lock iOS Safari
      document.body.style.cssText = `
        position: fixed;
        top: -${previousScrollY}px;
        left: 0;
        right: 0;
        width: 100%;
        overflow: hidden;
        overscroll-behavior: none;
        ${previousStyle}
      `;
    }

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.cssText = previousStyle || "";
        window.scrollTo(0, previousScrollY);
      }
    };
  }, [active]);
}
