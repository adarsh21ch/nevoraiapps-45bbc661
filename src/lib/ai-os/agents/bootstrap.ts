/**
 * Register all built-in agents. Import this once at server bootstrap
 * (alongside `bootstrapTools`) — safe to call multiple times.
 */

import { getAgent, registerAgents } from "./registry";
import { ALL_AGENTS } from "./definitions";

let done = false;

export function bootstrapAgents(): void {
  if (done) return;
  const unseen = ALL_AGENTS.filter((a) => !getAgent(a.id));
  if (unseen.length) registerAgents(unseen);
  done = true;
}
