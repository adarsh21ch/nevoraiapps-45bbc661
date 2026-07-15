import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animates numeric changes with a subtle vertical slide + fade.
 * Falls back gracefully for non-numeric strings (renders as-is).
 *
 * Used on scoreboards to make live updates feel alive without
 * flashing a jarring layout shift. Height is locked to `1em` so
 * the container never reflows during the animation.
 */
export function NumberRoll({
  value,
  className,
  duration = 220,
}: {
  value: string | number;
  className?: string;
  duration?: number;
}) {
  const strValue = String(value);
  const [display, setDisplay] = useState(strValue);
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const prev = useRef(strValue);

  useEffect(() => {
    if (prev.current === strValue) return;
    // Determine direction: higher number slides up-in, lower slides down-in.
    const nextNum = Number(strValue.replace(/[^\d.-]/g, ""));
    const prevNum = Number(prev.current.replace(/[^\d.-]/g, ""));
    const direction =
      Number.isFinite(nextNum) && Number.isFinite(prevNum) && nextNum < prevNum ? "down" : "up";

    setPhase("out");
    const t1 = window.setTimeout(() => {
      setDisplay(strValue);
      prev.current = strValue;
      setPhase("in");
      const t2 = window.setTimeout(() => setPhase("idle"), duration);
      (t1 as unknown as { next?: number }).next = t2;
    }, duration / 2);

    return () => {
      window.clearTimeout(t1);
      const nested = (t1 as unknown as { next?: number }).next;
      if (nested) window.clearTimeout(nested);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strValue]);

  return (
    <span
      className={cn("inline-block overflow-hidden align-baseline tabular-nums", className)}
      style={{ lineHeight: 1 }}
    >
      <span
        className="inline-block will-change-transform"
        style={{
          transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${duration}ms ease-out`,
          transform:
            phase === "out"
              ? "translateY(-40%)"
              : phase === "in"
                ? "translateY(0)"
                : "translateY(0)",
          opacity: phase === "out" ? 0 : 1,
        }}
      >
        {display}
      </span>
    </span>
  );
}
