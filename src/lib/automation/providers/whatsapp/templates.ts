/**
 * WhatsApp message templates for platform events.
 *
 * `renderTemplate` performs a lightweight `{{VarName}}` substitution. Callers
 * pass a flat map of variables. Unknown vars render as an empty string.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export const CHECK_IN_TEMPLATE = `✅ Student Checked In

Hello {{ParentName}},

{{StudentName}} has checked in.

Academy: {{AcademyName}}
Batch: {{BatchName}}
Coach: {{CoachName}}
Time: {{Time}}
Date: {{Date}}`;

export const CHECK_OUT_TEMPLATE = `👋 Student Checked Out

Hello {{ParentName}},

{{StudentName}} has checked out.

Time: {{Time}}
Date: {{Date}}

See you tomorrow.`;

export function defaultTemplateFor(eventType: string): string {
  if (eventType === "attendance.marked" || eventType === "student.check_in") {
    return CHECK_IN_TEMPLATE;
  }
  if (eventType === "student.check_out") {
    return CHECK_OUT_TEMPLATE;
  }
  // Generic fallback keeps arbitrary event types deliverable via the same provider.
  return `Hello {{ParentName}}, this is an update from {{AcademyName}} about {{StudentName}}.`;
}

export function buildDefaultMessage(eventType: string, vars: TemplateVars): string {
  return renderTemplate(defaultTemplateFor(eventType), vars);
}
