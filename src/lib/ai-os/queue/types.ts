/**
 * Action Queue — write intents live here until the user confirms.
 *
 * Any tool with `requiresConfirmation: true` is enqueued rather than
 * executed. The confirmation UI (later phase) reads the queue, presents
 * `describeConfirmation()`, and — on approval — invokes the same tool
 * with `{ confirmed: true }`.
 */

export type ActionStatus =
  | "pending_confirmation"
  | "approved"
  | "executed"
  | "rejected"
  | "expired"
  | "failed";

export type QueuedAction = {
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  toolName: string;
  input: unknown;
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
  /** Server-function target that will actually perform the write. Descriptive only — the tool's `execute` does the work. */
  target?: string;
  /** Human-readable confirmation blurb (from `describeConfirmation`). */
  confirmationTitle?: string;
  confirmationBody?: string;
  /** Result payload once executed. */
  result?: unknown;
  errorMessage?: string;
};

export interface ActionQueue {
  enqueue(action: Omit<QueuedAction, "id" | "status" | "createdAt" | "updatedAt">): Promise<QueuedAction>;
  get(id: string): Promise<QueuedAction | null>;
  list(filter: { tenantId: string; status?: ActionStatus }): Promise<QueuedAction[]>;
  updateStatus(id: string, status: ActionStatus, patch?: Partial<QueuedAction>): Promise<QueuedAction | null>;
}
