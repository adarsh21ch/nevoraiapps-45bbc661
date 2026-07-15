import { createContext, useContext } from "react";
import type { ChildContext, ParentChildRow } from "@/lib/parent-app";

export type ParentCtxValue = {
  child: ChildContext | null | undefined;
  childRow: ParentChildRow;
};

export const ParentCtx = createContext<ParentCtxValue | null>(null);

export function useParentChild(): ParentCtxValue {
  const v = useContext(ParentCtx);
  if (!v) throw new Error("useParentChild must be used within /parent");
  return v;
}
