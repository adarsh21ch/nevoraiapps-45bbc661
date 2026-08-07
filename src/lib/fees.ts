import { format } from "date-fns";
import type { Tenant } from "./tenant";
import { resolveMonthlyFee } from "./gender";


export type FeeCycle = "calendar_month" | "joining_date";

export function tenantFeeCycle(t: Tenant): FeeCycle {
  return t.fee_cycle === "joining_date" ? "joining_date" : "calendar_month";
}

/**
 * Helper A — effective monthly fee.
 * Logic: custom_fee ?? (gender_pricing_enabled ? resolveMonthlyFee(plan, gender) : plan.amount)
 */
export function resolveEffectiveMonthlyFee(opts: {
  plan: { amount: number | null; female_amount: number | null } | null;
  gender: string | null | undefined;
  customFee: number | null | undefined;
  isGenderPricingEnabled: boolean;
}): number {
  if (opts.customFee != null) return Number(opts.customFee);
  const base = opts.isGenderPricingEnabled
    ? resolveMonthlyFee(opts.plan as any, opts.gender)
    : Number(opts.plan?.amount ?? 0);
  return base;
}

/**
 * Helper B — paid-period set.
 * Returns a set of period keys for payments of type 'monthly'.
 */
export function getPaidPeriodSet(
  payments: Array<{ type: string | null | undefined; period: string | null | undefined }>,
): Set<string> {
  const set = new Set<string>();
  for (const p of payments) {
    if (p.type === "monthly" && p.period) {
      set.add(p.period);
    }
  }
  return set;
}


export function periodKey(d: Date): string {
  return format(d, "yyyy-MM");
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return format(new Date(y, m - 1, 1), "MMMM yyyy");
}

/** Day-of-month `day` in the given year/month, clamped to the month's length (Jan 31 → Feb 28). */
function clampDay(year: number, monthIdx: number, day: number): Date {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  return new Date(year, monthIdx, Math.min(day, lastDay));
}

/** Most recent monthly joining-anniversary on/before `today`. Never earlier than the joining date. */
export function joiningCycleDue(joinedAt: string, today = new Date()): Date {
  const joined = new Date(joinedAt + "T00:00:00");
  const day = joined.getDate();
  let due = clampDay(today.getFullYear(), today.getMonth(), day);
  if (due.getTime() > today.getTime()) {
    due = clampDay(today.getFullYear(), today.getMonth() - 1, day);
  }
  if (due.getTime() < joined.getTime()) due = joined;
  return due;
}

export type DueStatus =
  | { state: "not_due" }
  | { state: "paid"; period: string; dueDate: Date }
  | { state: "pending"; period: string; dueDate: Date; overdueDays: number };

/**
 * Fee status of one student for the cycle being viewed.
 * calendar_month: due for `selectedMonth`; joining_date: due for the student's current anniversary cycle.
 */
export function studentDue(opts: {
  cycle: FeeCycle;
  joinedAt: string;
  selectedMonth: Date;
  paidPeriods: ReadonlySet<string>;
  today?: Date;
}): DueStatus {
  const today = opts.today ?? new Date();
  const DAY = 86400 * 1000;

  if (opts.cycle === "calendar_month") {
    const period = periodKey(opts.selectedMonth);
    if (period < periodKey(new Date(opts.joinedAt + "T00:00:00"))) return { state: "not_due" };
    const dueDate = new Date(opts.selectedMonth.getFullYear(), opts.selectedMonth.getMonth(), 1);
    if (opts.paidPeriods.has(period)) return { state: "paid", period, dueDate };
    const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / DAY));
    return { state: "pending", period, dueDate, overdueDays };
  }

  const dueDate = joiningCycleDue(opts.joinedAt, today);
  const period = periodKey(dueDate);
  if (opts.paidPeriods.has(period)) return { state: "paid", period, dueDate };
  const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / DAY));
  return { state: "pending", period, dueDate, overdueDays };
}

/** The (at most two) period keys any student's current joining-date cycle can fall in. */
export function candidatePeriods(today = new Date()): string[] {
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return [periodKey(today), periodKey(prev)];
}

export function reminderMessage(opts: {
  tenantName: string;
  studentName: string;
  guardianName?: string | null;
  amount: number;
  period: string;
}): string {
  const greeting = opts.guardianName?.trim()
    ? `Namaste ${opts.guardianName.trim()} ji`
    : "Namaste ji";
  return (
    `${greeting}, ${opts.studentName} ki ${periodLabel(opts.period)} fees ` +
    `₹${opts.amount.toLocaleString("en-IN")} pending hai. Kripya jald payment kar dein. ` +
    `Dhanyavaad 🙏 — ${opts.tenantName}`
  );
}
