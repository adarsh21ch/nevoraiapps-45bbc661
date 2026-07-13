/* Overlay helper: when demo mode is ON, prepend demo entities to real data.
 * When OFF, pass real data through unchanged.
 */
import { useMemo } from "react";
import { useDemoData } from "./store";

export function useDemoOverlay<T>(
  tenantId: string,
  real: T[] | undefined,
  pick: (d: NonNullable<ReturnType<typeof useDemoData>>) => T[],
): T[] {
  const demo = useDemoData(tenantId);
  return useMemo(() => {
    const realList = real ?? [];
    if (!demo) return realList;
    return [...pick(demo), ...realList];
  }, [demo, real, pick]);
}
