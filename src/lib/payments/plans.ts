/**
 * SaaS plans, feature flags, and usage limits.
 *
 * Single source of truth for the runtime feature-flag resolver, plan
 * enforcement (`planAllows`), upgrade cards, and platform-admin overrides.
 * Client-safe.
 */

export type PlanTier = "starter" | "professional" | "enterprise";

export type FeatureId =
  | "attendance"
  | "fees"
  | "students"
  | "admissions"
  | "match_center"
  | "automation"
  | "notifications"
  | "reports"
  | "coach_module"
  | "parent_app"
  | "online_payments"
  | "ai_reports"
  | "custom_branding"
  | "founder_intelligence"
  | "campaigns"
  | "website_builder"
  | "api_access"
  // Future AI Platform (registered, not implemented)
  | "ai_chat"
  | "ai_business_insights"
  | "ai_student_analysis"
  | "ai_attendance_summary"
  | "ai_fee_analysis"
  | "ai_coach_assistant"
  | "ai_parent_summary"
  | "ai_ocr"
  | "ai_founder_brief";

export type LimitId =
  | "students"
  | "coaches"
  | "staff"
  | "parents"
  | "storage_mb"
  | "media_uploads"
  | "matches"
  | "tournaments"
  | "automation_rules"
  | "campaigns"
  | "website_pages"
  | "ai_credits"
  | "push_notifications"
  | "api_calls";

export type FeatureMeta = {
  id: FeatureId;
  name: string;
  minPlan: PlanTier;
  visible?: boolean;
  experimental?: boolean;
  deprecated?: boolean;
};

export const FEATURES: Record<FeatureId, FeatureMeta> = {
  attendance:            { id: "attendance",            name: "Attendance",            minPlan: "starter" },
  fees:                  { id: "fees",                  name: "Fees & Billing",        minPlan: "starter" },
  students:              { id: "students",              name: "Students",              minPlan: "starter" },
  admissions:            { id: "admissions",            name: "Admissions",            minPlan: "starter" },
  notifications:         { id: "notifications",         name: "Notifications",         minPlan: "starter" },
  parent_app:            { id: "parent_app",            name: "Parent App",            minPlan: "starter" },
  match_center:          { id: "match_center",          name: "Match Center",          minPlan: "professional" },
  automation:            { id: "automation",            name: "Automation",            minPlan: "professional" },
  reports:               { id: "reports",               name: "Reports",               minPlan: "professional" },
  coach_module:          { id: "coach_module",          name: "Coach Module",          minPlan: "professional" },
  online_payments:       { id: "online_payments",       name: "Online Payments",       minPlan: "professional" },
  campaigns:             { id: "campaigns",             name: "Campaigns",             minPlan: "professional" },
  website_builder:       { id: "website_builder",       name: "Website Builder",       minPlan: "professional" },
  ai_reports:            { id: "ai_reports",            name: "AI Reports",            minPlan: "enterprise", experimental: true },
  custom_branding:       { id: "custom_branding",       name: "Custom Branding",       minPlan: "enterprise" },
  founder_intelligence:  { id: "founder_intelligence",  name: "Founder Intelligence",  minPlan: "enterprise" },
  api_access:            { id: "api_access",            name: "API Access",            minPlan: "enterprise" },
};

export const FEATURE_MIN_PLAN: Record<FeatureId, PlanTier> = Object.fromEntries(
  Object.entries(FEATURES).map(([k, v]) => [k, v.minPlan]),
) as Record<FeatureId, PlanTier>;

const RANK: Record<PlanTier, number> = { starter: 0, professional: 1, enterprise: 2 };

/** Per-plan usage limits. `null` = unlimited. */
export const PLAN_LIMITS: Record<PlanTier, Record<LimitId, number | null>> = {
  starter: {
    students: 100,
    coaches: 5,
    staff: 3,
    parents: 200,
    storage_mb: 500,
    media_uploads: 200,
    matches: 20,
    tournaments: 2,
    automation_rules: 3,
    campaigns: 2,
    website_pages: 3,
    ai_credits: 0,
    push_notifications: 500,
    api_calls: 0,
  },
  professional: {
    students: 500,
    coaches: 25,
    staff: 15,
    parents: 1000,
    storage_mb: 5000,
    media_uploads: 2000,
    matches: 200,
    tournaments: 20,
    automation_rules: 25,
    campaigns: 20,
    website_pages: 20,
    ai_credits: 500,
    push_notifications: 10000,
    api_calls: 5000,
  },
  enterprise: {
    students: null,
    coaches: null,
    staff: null,
    parents: null,
    storage_mb: null,
    media_uploads: null,
    matches: null,
    tournaments: null,
    automation_rules: null,
    campaigns: null,
    website_pages: null,
    ai_credits: 5000,
    push_notifications: null,
    api_calls: null,
  },
};

export const PLAN_META: Record<PlanTier, { name: string; monthlyPrice: number; highlights: string[] }> = {
  starter: {
    name: "Starter",
    monthlyPrice: 999,
    highlights: ["Students, Attendance, Fees", "Parent app", "Basic notifications"],
  },
  professional: {
    name: "Professional",
    monthlyPrice: 2999,
    highlights: ["Everything in Starter", "Match Center + Coach module", "Automation + Campaigns", "Online payments"],
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 7999,
    highlights: ["Everything in Professional", "AI Reports", "Custom branding", "Founder Intelligence", "API access"],
  },
};

export function planAllows(current: PlanTier, feature: FeatureId): boolean {
  return RANK[current] >= RANK[FEATURES[feature].minPlan];
}

export function nextPlan(current: PlanTier): PlanTier | null {
  if (current === "starter") return "professional";
  if (current === "professional") return "enterprise";
  return null;
}

export function resolvePlanTier(input: {
  subscription_status?: string | null;
  plan_tier?: string | null;
}): PlanTier {
  const explicit = input.plan_tier;
  if (explicit === "starter" || explicit === "professional" || explicit === "enterprise") {
    return explicit;
  }
  if (input.subscription_status === "paid") return "professional";
  return "starter";
}

export type FeatureOverrides = Partial<Record<FeatureId, boolean>>;
export type LimitOverrides = Partial<Record<LimitId, number | null>>;

/** Resolve a feature considering plan + per-tenant override. */
export function resolveFeature(
  plan: PlanTier,
  feature: FeatureId,
  overrides?: FeatureOverrides | null,
): boolean {
  const forced = overrides?.[feature];
  if (typeof forced === "boolean") return forced;
  return planAllows(plan, feature);
}

/** Resolve a limit for a tenant with optional override. */
export function resolveLimit(
  plan: PlanTier,
  limit: LimitId,
  overrides?: LimitOverrides | null,
): number | null {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, limit)) {
    return overrides[limit] ?? null;
  }
  return PLAN_LIMITS[plan][limit];
}
