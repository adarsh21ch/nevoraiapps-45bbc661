/**
 * PWA / service-worker registration — guarded.
 *
 * NEVER registers in dev, iframe, Lovable preview hosts, or when
 * `?sw=off` is present. In any refused context we also *unregister* any
 * matching `/sw.js` registration left behind by earlier visits.
 */

const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true; // iframe
  } catch {
    return true; // cross-origin iframe throws — refuse
  }
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  ) {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => r.active?.scriptURL?.endsWith(SW_PATH))
      .map((r) => r.unregister()),
  );
}

let registered = false;

export async function registerPwa(): Promise<ServiceWorkerRegistration | null> {
  if (registered) return null;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  if (isRefusedContext()) {
    await unregisterMatching();
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    registered = true;
    return reg;
  } catch (err) {
    console.warn("[pwa] Service worker registration failed", err);
    return null;
  }
}
