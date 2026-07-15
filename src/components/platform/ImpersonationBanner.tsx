import { useEffect, useState } from "react";
import {
  getImpersonation,
  stopImpersonation,
  subscribeImpersonation,
  type ImpersonationState,
} from "@/lib/platform-impersonation";
import { AlertTriangle } from "lucide-react";

export function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    setState(getImpersonation());
    return subscribeImpersonation(() => setState(getImpersonation()));
  }, []);

  if (!state) return null;

  return (
    <div className="sticky top-0 z-[100] w-full border-b-2 border-rose-500 bg-rose-950/95 text-rose-100 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-rose-300" />
        <div className="flex-1 min-w-0 truncate">
          <span className="font-semibold">Impersonating</span> · viewing{" "}
          <span className="font-mono">{state.tenant_name}</span>
          <span className="text-rose-300"> · every action is audited</span>
        </div>
        <button
          className="rounded-md border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-medium hover:bg-rose-500/30"
          onClick={async () => {
            try {
              await stopImpersonation();
            } finally {
              window.location.href = "/platform-admin";
            }
          }}
        >
          Stop impersonation
        </button>
      </div>
    </div>
  );
}
