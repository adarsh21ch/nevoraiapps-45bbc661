/**
 * Context Builder — assembles an `AIContext` from the caller's session.
 *
 * Pure function over an input snapshot. Does NOT query the database on
 * its own; the caller supplies whatever slices it already has (dashboard
 * context, route params, etc.). This keeps the AI layer decoupled from
 * any specific route or hook.
 */

import type { AIContext, AIRole } from "./types";

export type ContextInput = {
  tenantId: string;
  tenantSlug?: string | null;
  role: AIRole;
  userId: string;
  currentScreen?: string;
  currentAcademyId?: string;
  selectedStudentId?: string;
  selectedBatchId?: string;
  selectedChildId?: string;
  subscription?: { plan: string; status: string };
  features?: Record<string, boolean>;
  language?: string;
};

export function buildContext(input: ContextInput): AIContext {
  return {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug ?? null,
    role: input.role,
    userId: input.userId,
    currentScreen: input.currentScreen,
    currentAcademyId: input.currentAcademyId,
    selectedStudentId: input.selectedStudentId,
    selectedBatchId: input.selectedBatchId,
    selectedChildId: input.selectedChildId,
    now: new Date().toISOString(),
    subscription: input.subscription,
    features: input.features,
    language: input.language ?? "en",
  };
}
