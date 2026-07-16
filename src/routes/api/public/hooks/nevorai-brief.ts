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

type Body = { period?: BriefPeriod };

export const Route = createFileRoute("/api/public/hooks/nevorai-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
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
