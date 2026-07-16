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
  tenantName?: string | null;
  role: AIRole;
  userId: string;
  currentScreen?: string;
  currentAcademyId?: string;
  selectedStudentId?: string;
  selectedBatchId?: string;
  selectedChildId?: string;
  selectedInvoiceId?: string;
  selectedDate?: string;
  currentFilters?: Record<string, string | number | boolean | null>;
  timezone?: string;
  subscription?: { plan: string; status: string };
  features?: Record<string, boolean>;
  language?: string;
};

function inferTimezone(explicit?: string): string {
  if (explicit) return explicit;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

export function buildContext(input: ContextInput): AIContext {
  return {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug ?? null,
    tenantName: input.tenantName ?? null,
    role: input.role,
    userId: input.userId,
    currentScreen: input.currentScreen,
    currentAcademyId: input.currentAcademyId,
    selectedStudentId: input.selectedStudentId,
    selectedBatchId: input.selectedBatchId,
    selectedChildId: input.selectedChildId,
    selectedInvoiceId: input.selectedInvoiceId,
    selectedDate: input.selectedDate,
    currentFilters: input.currentFilters,
    now: new Date().toISOString(),
    timezone: inferTimezone(input.timezone),
    subscription: input.subscription,
    features: input.features,
    language: input.language ?? "en",
  };
}

export type { AIRole };
