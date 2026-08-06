/**
 * NevorAI scheduled brief endpoint.
 *
 * Invoked by pg_cron for daily / weekly / monthly cadences. Reuses the
 * existing brief engine — no side channels, no new automation engine.
 *
 * Auth: Supabase anon key in the `apikey` header (standard cron pattern).
 */

import { createFileRoute } from "@tanstack/react-router";
import { generateBriefsForAllTenants, type BriefPeriod } from "@/lib/nevorai/reports.functions";
import { requireCronAuth } from "@/lib/cron-auth.server";

type Body = { period?: BriefPeriod };

export const Route = createFileRoute("/api/public/hooks/nevorai-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronAuth(request);
        if (unauthorized) return unauthorized;
        let period: BriefPeriod = "daily";
        try {
          const body = (await request.json()) as Body;
          if (body?.period === "weekly" || body?.period === "monthly" || body?.period === "daily") {
            period = body.period;
          }
        } catch {
          // empty body → daily
        }
        const result = await generateBriefsForAllTenants(period);
        return Response.json({ ok: true, period, ...result });
      },
    },
  },
});
