import type { ActionContext, ActionResult, ActionType } from "../types";
import { mockProvider } from "./mock";
import { notificationLogProvider } from "./notification-log";
import { whatsappProvider } from "./whatsapp";
import { pushProvider } from "./push";

export interface ActionProvider {
  /** Unique key, e.g. "whatsapp.meta", "notification.log", "push". */
  key: string;
  /** Action types this provider can serve. */
  handles: ActionType[];
  dispatch(ctx: ActionContext): Promise<ActionResult>;
}

const registry = new Map<string, ActionProvider>();

export function registerProvider(provider: ActionProvider): void {
  registry.set(provider.key, provider);
}

export function getProvider(key: string): ActionProvider | undefined {
  return registry.get(key);
}

/** Resolve a provider for an action. Uses `action.provider` override, else falls back to default map. */
export function resolveProvider(
  actionType: ActionType,
  overrideKey?: string,
): ActionProvider {
  if (overrideKey) {
    const p = registry.get(overrideKey);
    if (p) return p;
  }
  const preferred = defaultProviderKeyFor(actionType);
  const p = preferred ? registry.get(preferred) : undefined;
  return p ?? mockProvider;
}

function defaultProviderKeyFor(type: ActionType): string | null {
  switch (type) {
    case "notification.create":
      return "notification.log";
    case "notification.whatsapp":
      return "whatsapp";
    case "notification.push":
      return "push";
    default:
      return null;
  }
}

// Register built-in providers
registerProvider(mockProvider);
registerProvider(notificationLogProvider);
registerProvider(whatsappProvider);
registerProvider(pushProvider);

export { mockProvider, notificationLogProvider, whatsappProvider, pushProvider };
