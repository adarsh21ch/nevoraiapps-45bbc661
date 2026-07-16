/**
 * Registers every built-in tool with the tool registry.
 *
 * Import this file ONCE from the orchestrator (phase 11.1). It is safe
 * to import from server code; the tools themselves lazy-import server
 * helpers inside their `execute()`.
 */

import { ALL_TOOLS } from "./definitions";
import { registerTools } from "./registry";

let bootstrapped = false;

export function bootstrapTools(): void {
  if (bootstrapped) return;
  registerTools(ALL_TOOLS);
  bootstrapped = true;
}
