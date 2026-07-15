import type { PushAdapter } from "./types";
import { mockPushAdapter } from "./adapters/mock";
import { expoPushAdapter } from "./adapters/expo";
import { webPushAdapter } from "./adapters/web";

const adapters = new Map<string, PushAdapter>();

export function registerPushAdapter(a: PushAdapter): void {
  adapters.set(a.key, a);
}

export function getPushAdapter(key: string): PushAdapter | undefined {
  return adapters.get(key);
}

export function listPushAdapters(): PushAdapter[] {
  return Array.from(adapters.values());
}

registerPushAdapter(mockPushAdapter);
registerPushAdapter(expoPushAdapter);
registerPushAdapter(webPushAdapter);

/** Adapter used for native (ios/android) recipients when no explicit override. */
export const DEFAULT_PUSH_ADAPTER = "expo";
/** Adapter used for web (PushSubscription JSON) recipients. */
export const DEFAULT_WEB_PUSH_ADAPTER = "web-push";
