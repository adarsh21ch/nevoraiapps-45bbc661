import { useEffect, useState } from "react";

/**
 * useBodyLock — prevents the background from scrolling on mobile.
 * Reference-counted to support multiple overlapping shells.
 */
export function useBodyLock(active: boolean) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!active || !isMobile) return;

    // We use a property on window to track count safely across mounts
    const win = window as any;
    win.__bodyLockCount = (win.__bodyLockCount || 0) + 1;

    if (win.__bodyLockCount === 1) {
      win.__previousScrollY = window.scrollY;
      win.__previousStyle = document.body.style.cssText;
      
      // We use position: fixed to robustly lock iOS Safari
      // previousStyle first so it doesn't override our lock properties
      document.body.style.cssText = `
        ${win.__previousStyle || ""};
        position: fixed;
        top: -${win.__previousScrollY}px;
        left: 0;
        right: 0;
        width: 100%;
        overflow: hidden;
        overscroll-behavior: none;
      `;
    }

    return () => {
      win.__bodyLockCount--;
      if (win.__bodyLockCount === 0) {
        document.body.style.cssText = win.__previousStyle || "";
        window.scrollTo(0, win.__previousScrollY || 0);
        win.__previousStyle = null;
        win.__previousScrollY = 0;
      }
    };
  }, [active, isMobile]);
}
