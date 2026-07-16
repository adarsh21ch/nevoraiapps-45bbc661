/**
 * In-memory Action Queue — dev-only. Phase 11.2+ swaps to Supabase.
 */

import type { ActionQueue, ActionStatus, QueuedAction } from "./types";

let counter = 0;

export class InMemoryActionQueue implements ActionQueue {
  private byId = new Map<string, QueuedAction>();

  async enqueue(
    action: Omit<QueuedAction, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<QueuedAction> {
    counter += 1;
    const now = new Date().toISOString();
    const item: QueuedAction = {
      ...action,
      id: `act_${Date.now()}_${counter}`,
      status: "pending_confirmation",
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<QueuedAction | null> {
    return this.byId.get(id) ?? null;
  }

  async list(filter: { tenantId: string; status?: ActionStatus }): Promise<QueuedAction[]> {
    return Array.from(this.byId.values()).filter(
      (a) => a.tenantId === filter.tenantId && (!filter.status || a.status === filter.status),
    );
  }

  async updateStatus(
    id: string,
    status: ActionStatus,
    patch: Partial<QueuedAction> = {},
  ): Promise<QueuedAction | null> {
    const cur = this.byId.get(id);
    if (!cur) return null;
    const next: QueuedAction = { ...cur, ...patch, status, updatedAt: new Date().toISOString() };
    this.byId.set(id, next);
    return next;
  }
}
