/**
 * AIContext — the ambient state every tool and prompt receives.
 *
 * Kept intentionally small. The Context Builder gathers ONLY these
 * fields, not raw DB payloads. Anything a tool needs beyond this it
 * must fetch itself, gated by the role/tenant here.
 */

export type AIRole = "owner" | "admin" | "coach" | "parent" | "student" | "platform_admin";

export type AIContext = {
  tenantId: string;
  tenantSlug: string | null;
  tenantName?: string | null;
  role: AIRole;
  userId: string;
  /** Route pathname the caller is currently viewing, if any. */
  currentScreen?: string;
  /** Currently focused academy (multi-tenant admins). */
  currentAcademyId?: string;
  /** Currently selected student (owner/coach viewing a specific player). */
  selectedStudentId?: string;
  /** Currently selected batch. */
  selectedBatchId?: string;
  /** Selected child (parent role). */
  selectedChildId?: string;
  /** Currently selected invoice, if the caller is looking at a bill. */
  selectedInvoiceId?: string;
  /** ISO date the caller has filtered to (attendance, reports, etc.). */
  selectedDate?: string;
  /** Arbitrary filter map the caller has active — passed as read-only hints. */
  currentFilters?: Record<string, string | number | boolean | null>;
  /** ISO date at request time. */
  now: string;
  /** IANA timezone of the caller. Defaults to UTC when unknown. */
  timezone?: string;
  /** Subscription plan + status, if known. */
  subscription?: { plan: string; status: string };
  /** Tenant feature-flag map. */
  features?: Record<string, boolean>;
  /** ISO 639-1 preferred language. */
  language?: string;
};
