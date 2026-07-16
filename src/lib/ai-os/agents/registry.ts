/**
 * Agent Registry — pluggable catalog of AI capabilities.
 *
 * The orchestrator resolves an agent through this registry. No hardcoded
 * agent behaviour lives in the orchestrator itself.
 */

import type { AIContext } from "../context/types";
import type { AgentDef, AgentId } from "./types";

const registry = new Map<AgentId, AgentDef>();

export function registerAgent(agent: AgentDef): void {
  registry.set(agent.id, agent);
}

export function registerAgents(agents: AgentDef[]): void {
  for (const a of agents) registerAgent(a);
}

export function getAgent(id: AgentId): AgentDef | undefined {
  return registry.get(id);
}

export function listAgents(): AgentDef[] {
  return Array.from(registry.values());
}

export function agentsForContext(ctx: AIContext): AgentDef[] {
  return listAgents().filter((a) => a.allowedRoles.includes(ctx.role));
}

export function canUseAgent(agent: AgentDef, ctx: AIContext): boolean {
  return agent.allowedRoles.includes(ctx.role);
}
