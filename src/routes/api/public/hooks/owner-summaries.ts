/**
 * POST /api/public/hooks/owner-summaries
 * Called by pg_cron. For each active tenant, computes an owner summary for
 * the requested cadence (daily/weekly/monthly) and inserts an
 * `automation_events` row (`daily.summary` | `weekly.summary` |
 * `monthly.summary`). The regular automation-tick then matches the seeded
 * rule (`Push: Daily/Weekly/Monthly summary`) and dispatches through the
 * push provider — reusing the entire notification pipeline.
 *
 * Auth: `apikey` header must match SUPABASE_PUBLISHABLE_KEY / ANON.
 * Body: `{ "cadence": "daily" | "weekly" | "monthly" }` (defaults to daily).
 * Idempotent per (tenant, cadence, YYYY-MM-DD) via a dedupe_key on the event.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  computeOwnerSummary,
  type SummaryCadence,
} from "@/lib/automation/summaries/owner-summary.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

const VALID: readonly SummaryCadence[] = ["daily", "weekly", "monthly"] as const;

export const Route = createFileRoute("/api/public/hooks/owner-summaries")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronAuth(request);
        if (unauthorized) return unauthorized;

        let cadence: SummaryCadence = "daily";
        try {
          const body = (await request.json()) as { cadence?: string };
          if (body?.cadence && VALID.includes(body.cadence as SummaryCadence)) {
            cadence = body.cadence as SummaryCadence;
          }
        } catch {
          // empty body → default daily
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: tenants, error: tErr } = await supabaseAdmin
          .from("tenants")
          .select("id, name")
          .eq("status", "active");
        if (tErr) {
          return Response.json({ ok: false, error: tErr.message }, { status: 500 });
        }

        const eventType = `${cadence}.summary`;
        const today = new Date().toISOString().slice(0, 10);
        let emitted = 0;
        let skipped = 0;
        let errors = 0;

        for (const t of tenants ?? []) {
          try {
            const summary = await computeOwnerSummary(t.id, cadence);
            if (!summary.meaningful) {
              skipped++;
              continue;
            }

            // Merge template vars + rich payload for the rule's push action.
            // The push provider merges event.payload into template vars, so
            // {{Present}} / {{Absent}} / {{Collected}} / {{Pending}} in the
            // seeded summary templates render correctly.
            const payload: Record<string, unknown> = {
              ...summary.templateVars,
              cadence,
              summary,
              // A richer body override for the push message (multi-line).
              body: summary.bodyLines.join("\n") || undefined,
              subtitle: "Attendance • Fees • Revenue",
            };

            const dedupe = `${cadence}:${t.id}:${today}`;

            // Emit the automation event (RLS-bypass — cron context).
            // The unique index on automation_events(tenant_id, event_type, dedupe_key)
            // if present blocks duplicates; otherwise we probe manually.
            const { data: existing } = await supabaseAdmin
              .from("automation_events")
              .select("id")
              .eq("tenant_id", t.id)
              .eq("event_type", eventType)
              .eq("source_id", dedupe)
              .maybeSingle();
            if (existing) {
              skipped++;
              continue;
            }

            const { error: insErr } = await supabaseAdmin
              .from("automation_events")
              .insert({
                tenant_id: t.id,
                event_type: eventType,
                source_module: "owner_summary",
                source_id: dedupe,
                payload: payload as never,
              });
            if (insErr) {
              errors++;
              continue;
            }
            emitted++;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[owner-summaries] tenant failed", t.id, e);
            errors++;
          }
        }

        return Response.json({
          ok: true,
          cadence,
          emitted,
          skipped,
          errors,
          tenants: tenants?.length ?? 0,
        });
      },
    },
  },
});
