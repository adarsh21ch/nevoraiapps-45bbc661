/**
 * Push notification templates keyed by automation event type.
 *
 * Each template renders a fully-formed PushMessage (title / body / subtitle /
 * deep link / category). Business modules never build push copy themselves —
 * they emit an automation event and the engine resolves the template here.
 */

import type { AutomationEventType } from "../../types";
import type { PushMessage } from "./types";

export interface TemplateVars {
  ParentName: string;
  StudentName: string;
  AcademyName: string;
  BatchName: string;
  CoachName: string;
  Time: string;
  Date: string;
  Amount?: string;
  DueDate?: string;
  MatchName?: string;
  TournamentName?: string;
  Runs?: string;
  Wickets?: string;
  Present?: string;
  Absent?: string;
  Collected?: string;
  Pending?: string;
  ReportingTime?: string;
  Message?: string;
}

function render(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = (vars as unknown as Record<string, string | undefined>)[key];
    return v == null ? "" : String(v);
  });
}

interface Template {
  title: string;
  body: string;
  subtitle?: string;
  deepLink: string;
  category: string;
  priority?: "default" | "normal" | "high";
}

const TEMPLATES: Partial<Record<AutomationEventType, Template>> = {
  "student.check_in": {
    title: "🟢 {{StudentName}} Checked In",
    body: "Checked in at {{Time}}. {{AcademyName}}.",
    deepLink: "/parent?tab=attendance",
    category: "attendance",
    priority: "high",
  },
  "attendance.marked": {
    title: "🟢 {{StudentName}} Checked In",
    body: "Marked present at {{Time}}. {{AcademyName}}.",
    deepLink: "/parent?tab=attendance",
    category: "attendance",
    priority: "high",
  },
  "student.check_out": {
    title: "🔴 {{StudentName}} Checked Out",
    body: "Checked out at {{Time}}.",
    deepLink: "/parent?tab=attendance",
    category: "attendance",
    priority: "high",
  },
  "fee.generated": {
    title: "💰 New Fee",
    body: "{{StudentName}}'s ₹{{Amount}} fee is generated. Due {{DueDate}}.",
    deepLink: "/parent?tab=fees",
    category: "fees",
  },
  "fee.due_tomorrow": {
    title: "💰 Fee Due Tomorrow",
    body: "{{StudentName}}'s ₹{{Amount}} fee is due tomorrow. Tap to pay now.",
    deepLink: "/parent?tab=fees",
    category: "fees",
    priority: "high",
  },
  "fee.overdue": {
    title: "🔴 Fee Overdue",
    body: "{{StudentName}}'s ₹{{Amount}} fee is overdue. Please pay now.",
    deepLink: "/parent?tab=fees",
    category: "fees",
    priority: "high",
  },
  "fee.paid": {
    title: "✅ Payment Received",
    body: "₹{{Amount}} received successfully. Thank you.",
    deepLink: "/parent?tab=fees",
    category: "fees",
  },
  "student.created": {
    title: "👤 New Student",
    body: "{{StudentName}} was added to {{AcademyName}}.",
    deepLink: "/dashboard/students",
    category: "student",
  },
  "match.started": {
    title: "🏏 Match Started",
    body: "{{MatchName}} has begun.",
    deepLink: "/match-center",
    category: "match",
  },
  "match.finished": {
    title: "🏏 Match Completed",
    body: "{{StudentName}} scored {{Runs}} runs, took {{Wickets}} wickets.",
    deepLink: "/parent?tab=performance",
    category: "match",
  },
  "tournament.published": {
    title: "🏆 {{TournamentName}}",
    body: "Reporting Time: {{ReportingTime}}.",
    deepLink: "/match-center/tournaments",
    category: "tournament",
    priority: "high",
  },
  "communication.sent": {
    title: "📣 Announcement",
    body: "{{Message}}",
    deepLink: "/parent",
    category: "announcement",
  },
  "website.lead_received": {
    title: "🎯 New Lead",
    body: "A new lead was received.",
    deepLink: "/dashboard/leads",
    category: "lead",
  },
  "daily.summary": {
    title: "📊 Daily Academy Summary",
    body: "{{Present}} Present · {{Absent}} Absent · ₹{{Collected}} Collected · {{Pending}} Fees Pending.",
    deepLink: "/dashboard",
    category: "summary",
  },
  "weekly.summary": {
    title: "📊 Weekly Academy Summary",
    body: "{{Present}} attendance total · ₹{{Collected}} collected · {{Pending}} pending.",
    deepLink: "/dashboard",
    category: "summary",
  },
  "monthly.summary": {
    title: "📊 Monthly Academy Summary",
    body: "{{Present}} attendance total · ₹{{Collected}} collected · {{Pending}} pending.",
    deepLink: "/dashboard",
    category: "summary",
  },
};

const DEFAULT: Template = {
  title: "🔔 {{AcademyName}}",
  body: "You have a new update.",
  deepLink: "/parent",
  category: "general",
};

export function renderPushTemplate(
  event: AutomationEventType,
  vars: TemplateVars,
  overrides: Partial<PushMessage> = {},
): PushMessage {
  const tpl = TEMPLATES[event] ?? DEFAULT;
  return {
    title: overrides.title ?? render(tpl.title, vars),
    body: overrides.body ?? render(tpl.body, vars),
    subtitle: overrides.subtitle ?? (tpl.subtitle ? render(tpl.subtitle, vars) : undefined),
    deepLink: overrides.deepLink ?? tpl.deepLink,
    category: overrides.category ?? tpl.category,
    priority: overrides.priority ?? tpl.priority ?? "high",
    data: overrides.data,
    badge: overrides.badge,
    sound: overrides.sound,
    threadId: overrides.threadId ?? tpl.category,
    collapseId: overrides.collapseId,
    ttl: overrides.ttl,
  };
}

export function renderRaw(tpl: string, vars: TemplateVars): string {
  return render(tpl, vars);
}
