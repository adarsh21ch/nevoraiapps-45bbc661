import { logPlatformAction } from "./platform-audit";

const KEY = "platform.impersonation";

export type ImpersonationState = {
  tenant_id: string;
  tenant_name: string;
  actor_id: string;
  started_at: string;
};

export function getImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

export async function startImpersonation(actorId: string, tenantId: string, tenantName: string) {
  const state: ImpersonationState = {
    tenant_id: tenantId,
    tenant_name: tenantName,
    actor_id: actorId,
    started_at: new Date().toISOString(),
  };
  await logPlatformAction({
    tenantId,
    targetType: "impersonation",
    targetId: tenantId,
    action: "impersonate_start",
    after: state,
  });
  window.sessionStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("platform:impersonation"));
}

export async function stopImpersonation() {
  const state = getImpersonation();
  if (!state) return;
  await logPlatformAction({
    tenantId: state.tenant_id,
    targetType: "impersonation",
    targetId: state.tenant_id,
    action: "impersonate_end",
    before: state,
  });
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("platform:impersonation"));
}

export function subscribeImpersonation(cb: () => void) {
  const handler = () => cb();
  window.addEventListener("platform:impersonation", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("platform:impersonation", handler);
    window.removeEventListener("storage", handler);
  };
}
