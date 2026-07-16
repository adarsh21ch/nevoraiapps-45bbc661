/**
 * Safety guards — human-readable confirmation prompts for write tools.
 *
 * The orchestrator (phase 11.1) presents `describeConfirmation(...)`
 * to the user and only calls `invokeTool(..., { confirmed: true })`
 * after explicit approval.
 */

import type { AIContext } from "../context/types";
import { getTool } from "../tools/registry";

/** Absolutely forbidden — never exposed as tools. */
export const FORBIDDEN_ACTIONS = [
  "delete_records",
  "approve_payment",
  "approve_admission",
  "change_subscription_plan",
] as const;

export type ConfirmationPrompt = {
  toolName: string;
  humanTitle: string;
  humanBody: string;
  input: unknown;
};

const HUMAN_LABELS: Record<string, { title: string; body: (i: unknown) => string }> = {
  send_fee_reminder: {
    title: "Send fee reminder?",
    body: (i) => {
      const studentId = (i as { studentId?: string })?.studentId ?? "the selected student";
      return `A fee reminder will be queued for ${studentId}. This uses the existing reminder queue and can be cancelled from the reminders screen.`;
    },
  },
};

export function describeConfirmation(
  toolName: string,
  input: unknown,
  _ctx: AIContext,
): ConfirmationPrompt | null {
  const tool = getTool(toolName);
  if (!tool || !tool.requiresConfirmation) return null;
  const label = HUMAN_LABELS[toolName];
  return {
    toolName,
    humanTitle: label?.title ?? `Confirm: ${toolName}`,
    humanBody: label?.body(input) ?? `The assistant wants to run "${toolName}" on your behalf.`,
    input,
  };
}
