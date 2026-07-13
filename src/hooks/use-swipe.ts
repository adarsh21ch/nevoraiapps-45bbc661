import { useRef, type PointerEvent as ReactPointerEvent } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Minimum horizontal/vertical pixels to count as a swipe. Default 60. */
  threshold?: number;
  /** Max ms between pointerdown and pointerup to count. Default 600. */
  maxDurationMs?: number;
}

/**
 * Lightweight pointer-based swipe hook. Returns handlers to spread onto
 * any element. Ignores multi-touch, vertical drift on horizontal swipes,
 * and taps under the threshold. No dependencies, works everywhere.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 60,
  maxDurationMs = 600,
}: SwipeHandlers) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dt = Date.now() - s.t;
    if (dt > maxDurationMs) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < threshold && absY < threshold) return;
    if (absX > absY) {
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    } else {
      if (dy > 0) onSwipeDown?.();
      else onSwipeUp?.();
    }
  };

  const onPointerCancel = () => {
    start.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
}
