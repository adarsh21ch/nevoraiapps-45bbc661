/**
 * Automation Queue Tick — public cron endpoint.
 *
 * Called by pg_cron / external scheduler at a short interval (e.g. every
 * minute). Authenticated by Supabase anon key header, then delegates to the
 * server-only engine (which uses supabaseAdmin, RLS-bypass, for the queue).
 *
 * External callers cannot inject events through this endpoint — it only
 * drains the already-persisted queue and processes due retries.
 */

import { createFileRoute } from "@tanstack/react-router";
import { processPendingEvents, processDueRetries } from "@/lib/automation/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronAuth(request);
        if (unauthorized) return unauthorized;
        try {
          const [events, retries] = await Promise.all([
            processPendingEvents(50),
            processDueRetries(50),
          ]);
          return Response.json({ ok: true, events, retries });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
