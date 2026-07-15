import type { PushAdapter } from "./types";
import { mockPushAdapter } from "./adapters/mock";
import { expoPushAdapter } from "./adapters/expo";

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

export const DEFAULT_PUSH_ADAPTER = "expo";
