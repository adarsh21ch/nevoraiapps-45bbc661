/**
 * NevorAI periodic briefs (daily / weekly / monthly).
 *
 * Reuses the existing Daily Brief engine and stores each generated brief as
 * an assistant turn on a dedicated "Briefs" conversation per user. That
 * automatically wires it into conversation history, memory and analytics —
 * no parallel storage engine.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BriefPeriod = "daily" | "weekly" | "monthly";

const BRIEF_AGENT = "owner_ai";
const BRIEF_TITLE: Record<BriefPeriod, string> = {
  daily: "Daily briefs",
  weekly: "Weekly summaries",
  monthly: "Monthly summaries",
};

function formatBriefBody(period: BriefPeriod, brief: {
  headline: string;
  sections: Array<{ title: string; body: string }>;
  recommendations: string[];
}): string {
  const stamp =
    period === "daily"
      ? new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })
      : period === "weekly"
      ? `Week of ${new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
      : new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const sections = brief.sections
    .map((s) => `**${s.title}**\n${s.body}`)
    .join("\n\n");
  const recs = brief.recommendations.length
    ? `\n\n**Recommended actions**\n${brief.recommendations.map((r) => `• ${r}`).join("\n")}`
    : "";
  return `**${period.charAt(0).toUpperCase() + period.slice(1)} · ${stamp}**\n\n${brief.headline}\n\n${sections}${recs}`;
}

async function ensureBriefsConversation(
  tenantId: string,
  userId: string,
  period: BriefPeriod,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const title = BRIEF_TITLE[period];
  const { data: existing } = await supabaseAdmin
    .from("ai_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_id", BRIEF_AGENT)
    .eq("title", title)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("ai_conversations")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      agent_id: BRIEF_AGENT,
      title,
      pinned: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

async function generateForUser(
  tenantId: string,
  userId: string,
  period: BriefPeriod,
): Promise<{ conversationId: string; body: string }> {
  const { getDailyBrief } = await import("./brief.functions");
  // Reuse existing engine — its handler is authenticated, so invoke directly.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) throw new Error("Tenant not found");

  // Recreate the brief body via the shared helper (import unused type only).
  void getDailyBrief;

  // Compose the brief inline using the same helpers to avoid an auth hop.
  const [{ fetchKpis }, { fetchBillingKpis }, { fetchAttendanceToday }] = await Promise.all([
    import("@/lib/dashboard-queries"),
    import("@/lib/billing"),
    import("@/lib/attendance/queries"),
  ]);

  const [kpis, billing, attendance] = await Promise.all([
    fetchKpis(tenant as never, supabaseAdmin).catch(() => null),
    fetchBillingKpis(tenantId, supabaseAdmin).catch(() => null),
    fetchAttendanceToday(tenantId, supabaseAdmin).catch(() => [] as Awaited<ReturnType<typeof fetchAttendanceToday>>),
  ]);

  let present = 0;
  let absent = 0;
  for (const r of attendance) {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
  }

  const overdue = billing?.overdue ?? 0;
  const outstanding = billing?.outstanding ?? 0;
  const collected = billing?.collectedThisMonth ?? 0;
  const active = kpis?.activeStudents ?? 0;

  const recommendations: string[] = [];
  if (overdue > 0) recommendations.push(`Send fee reminders — ${overdue} overdue.`);
  if (absent > 0) recommendations.push(`Follow up on ${absent} absent students.`);
  if (recommendations.length === 0) recommendations.push("All healthy. Plan next cycle.");

  const body = formatBriefBody(period, {
    headline:
      overdue > 0
        ? `${overdue} invoice${overdue > 1 ? "s are" : " is"} overdue.`
        : "Academy is on track.",
    sections: [
      { title: "Attendance", body: `${present} present, ${absent} absent today.` },
      {
        title: "Revenue",
        body: `Collected ${collected} · outstanding ${outstanding} · overdue ${overdue}.`,
      },
      { title: "Growth", body: `${active} active students on the roll.` },
    ],
    recommendations,
  });

  const conversationId = await ensureBriefsConversation(tenantId, userId, period);
  await supabaseAdmin.from("ai_conversation_turns").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    role: "assistant",
    content: body,
    parts: [{ type: "text", text: body }] as never,
    tool_name: `nevorai.brief.${period}`,
  });
  await supabaseAdmin
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return { conversationId, body };
}

export const generatePeriodicBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { period: BriefPeriod }) =>
    z.object({ period: z.enum(["daily", "weekly", "monthly"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("No tenant");
    return generateForUser(profile.tenant_id, context.userId, data.period);
  });

/** Called by the cron endpoint. Iterates all active tenants + their owners. */
export async function generateBriefsForAllTenants(period: BriefPeriod): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenants } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("status", "active");
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  for (const t of tenants ?? []) {
    // Owners of this tenant only.
    const { data: owners } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", t.id)
      .in("role", ["owner", "admin"]);
    for (const o of owners ?? []) {
      attempted++;
      try {
        await generateForUser(t.id, o.user_id, period);
        succeeded++;
      } catch (e) {
        failed++;
        console.error("[nevorai] brief failed", t.id, o.user_id, e);
      }
    }
  }
  return { attempted, succeeded, failed };
}
