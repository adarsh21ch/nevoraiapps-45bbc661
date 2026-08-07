/**
 * Canonical enrolment → billing bridge (Billing V2).
 *
 * One place that turns "this student trains in this session on this fee plan"
 * into real money: a recurring subscription for the session fee plus a one-time
 * admission / registration charge for brand-new students.
 *
 * Rules:
 *  - The student's `fee_plan_id` (a `monthly`-type plan) drives the recurring amount.
 *  - The tenant's `registration` / `admission` fee plan (if any) is billed ONCE,
 *    on the very first invoice of that student.
 *  - Idempotent: a student who already has a subscription is skipped, and the
 *    admission line is never added twice.
 */
import { supabase } from "@/integrations/supabase/client";
import { createSubscription, createDraftInvoice, issueInvoice, type BillingCycle } from "@/lib/billing";
import { resolveMonthlyFee } from "@/lib/gender";

export type FeePlanLite = {
  id: string;
  name: string;
  amount: number | null;
  type: string | null;
  billing_cycle?: string | null;
  cycle_anchor_day?: number | null;
};

const ADMISSION_TYPES = ["registration", "admission", "one_time", "joining"];

/** The tenant's one-time joining charge, if the academy configured one. */
export function findAdmissionPlan(plans: FeePlanLite[]): FeePlanLite | null {
  return (
    plans.find((p) => ADMISSION_TYPES.includes((p.type ?? "").toLowerCase())) ??
    plans.find((p) => /registration|admission|joining/i.test(p.name)) ??
    null
  );
}

/** Recurring plans only — what a session can be priced with. */
export function recurringPlans(plans: FeePlanLite[]): FeePlanLite[] {
  const admission = findAdmissionPlan(plans);
  return plans.filter((p) => p.id !== admission?.id);
}

/** What a student will be charged when enrolled — used for live UI previews. */
export function previewEnrollmentCharges(
  plans: FeePlanLite[],
  feePlanId: string | null | undefined,
  includeAdmission: boolean,
  gender?: string | null,
  isGenderPricingEnabled?: boolean,
) {
  const plan = feePlanId ? plans.find((p) => p.id === feePlanId) ?? null : null;
  const admission = includeAdmission ? findAdmissionPlan(plans) : null;
  const recurring = isGenderPricingEnabled 
    ? resolveMonthlyFee(plan as any, gender)
    : Number(plan?.amount ?? 0);
  const oneTime = Number(admission?.amount ?? 0);
  return { plan, admission, recurring, oneTime, total: recurring + oneTime };
}

function endOfCycle(start: Date, cycle: BillingCycle) {
  const d = new Date(start);
  const months = cycle === "quarterly" ? 3 : cycle === "half_yearly" ? 6 : cycle === "yearly" ? 12 : 1;
  if (cycle === "one_time") return start;
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type EnrollResult = { skipped: boolean; reason?: string; invoiceId?: string };

/**
 * Create the subscription + first invoice for one student.
 * Safe to call repeatedly — existing subscriptions short-circuit.
 */
export async function enrollStudentInBilling(input: {
  tenantId: string;
  studentId: string;
  feePlanId: string | null | undefined;
  plans: FeePlanLite[];
  /** Charge the one-time admission fee (new joiners only). */
  chargeAdmission?: boolean;
  startDate?: string;
  issue?: boolean;
  gender?: string | null;
}): Promise<EnrollResult> {
  const plan = input.feePlanId ? input.plans.find((p) => p.id === input.feePlanId) : null;
  if (!plan) return { skipped: true, reason: "no_fee_plan" };

  const { data: existing } = await supabase
    .from("billing_subscriptions")
    .select("id")
    .eq("student_id", input.studentId)
    .limit(1);
  if ((existing ?? []).length > 0) return { skipped: true, reason: "already_enrolled" };

  const { resolveEffectiveMonthlyFee } = await import("./fees");

  const { data: tenantData } = await supabase.from('tenants').select('gender_pricing_enabled').eq('id', input.tenantId).single();
  const isGenderPricingEnabled = tenantData?.gender_pricing_enabled === true;
  const resolvedAmount = resolveEffectiveMonthlyFee({
    plan: plan as any,
    gender: input.gender,
    customFee: null, // enrollment uses plan defaults, custom_fee is set later
    isGenderPricingEnabled
  });


  const sub = await createSubscription({
    tenant_id: input.tenantId,
    student_id: input.studentId,
    fee_plan_id: plan.id,
    unit_amount: resolvedAmount,
    billing_cycle: cycle,
    cycle_anchor_day: plan.cycle_anchor_day ?? start.getDate(),
    start_date: iso(start),
  });

  const lines: Parameters<typeof createDraftInvoice>[0]["lines"] = [];

  if (input.chargeAdmission !== false) {
    const admission = findAdmissionPlan(input.plans);
    // Only ever billed on a student's very first invoice.
    const { data: priorInvoices } = await supabase
      .from("billing_invoices")
      .select("id")
      .eq("student_id", input.studentId)
      .limit(1);
    if (admission && Number(admission.amount ?? 0) > 0 && (priorInvoices ?? []).length === 0) {
      lines.push({
        line_type: "one_time",
        description: admission.name,
        unit_amount: Number(admission.amount),
      });
    }
  }

  lines.push({
    line_type: "charge",
    description: plan.name,
    unit_amount: resolvedAmount,
    period_start: iso(start),
    period_end: iso(periodEnd),
  });

  const invoice = await createDraftInvoice({
    tenant_id: input.tenantId,
    student_id: input.studentId,
    subscription_id: sub.id,
    due_date: iso(start),
    period_start: iso(start),
    period_end: iso(periodEnd),
    lines,
  });

  if (input.issue !== false) {
    try {
      await issueInvoice(invoice.id);
    } catch {
      /* leave as draft — the owner can issue it from the Fees hub */
    }
  }

  return { skipped: false, invoiceId: invoice.id };
}

/** Enrol many students, one at a time so a single failure never blocks the rest. */
export async function enrollManyInBilling(
  inputs: Array<{ studentId: string; feePlanId: string | null | undefined; gender?: string | null; startDate?: string }>,
  shared: { tenantId: string; plans: FeePlanLite[]; chargeAdmission?: boolean },
) {
  let enrolled = 0;
  let skipped = 0;
  for (const i of inputs) {
    try {
      const res = await enrollStudentInBilling({ ...shared, ...i });
      if (res.skipped) skipped += 1;
      else enrolled += 1;
    } catch {
      skipped += 1;
    }
  }
  return { enrolled, skipped };
}
