/* ================================================================
 * Offline queue for Ball Events
 * ----------------------------------------------------------------
 * When submission fails (offline / transient network error) we
 * queue the AppendBallInput in localStorage keyed by innings and
 * retry it when the connection returns. Each entry has a stable
 * client id to prevent duplicate submission if the network response
 * for the original attempt eventually lands.
 * ================================================================ */

import type { AppendBallInput } from "@/lib/mc-ball-events";

export interface QueuedBall {
  clientId: string;
  attemptedAt: number;
  input: AppendBallInput;
}

function key(inningsId: string) {
  return `mc:ballqueue:${inningsId}`;
}

function read(inningsId: string): QueuedBall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(inningsId));
    return raw ? (JSON.parse(raw) as QueuedBall[]) : [];
  } catch {
    return [];
  }
}

function write(inningsId: string, list: QueuedBall[]) {
  if (typeof window === "undefined") return;
  try {
    if (list.length === 0) window.localStorage.removeItem(key(inningsId));
    else window.localStorage.setItem(key(inningsId), JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

export function enqueueBall(input: AppendBallInput): QueuedBall {
  const entry: QueuedBall = {
    clientId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    attemptedAt: Date.now(),
    input,
  };
  const list = read(input.inningsId);
  list.push(entry);
  write(input.inningsId, list);
  return entry;
}

export function peekQueue(inningsId: string): QueuedBall[] {
  return read(inningsId);
}

export function removeFromQueue(inningsId: string, clientId: string) {
  const next = read(inningsId).filter((q) => q.clientId !== clientId);
  write(inningsId, next);
}

export function clearQueue(inningsId: string) {
  write(inningsId, []);
}

/** Attempts to flush the queue for an innings in order.
 *  Stops on the first failure so ordering is preserved. */
export async function flushQueue(
  inningsId: string,
  submit: (input: AppendBallInput) => Promise<void>,
): Promise<{ sent: number; remaining: number }> {
  let sent = 0;
  const list = read(inningsId);
  for (const item of list) {
    try {
      await submit(item.input);
      removeFromQueue(inningsId, item.clientId);
      sent += 1;
    } catch {
      break;
    }
  }
  return { sent, remaining: read(inningsId).length };
}
