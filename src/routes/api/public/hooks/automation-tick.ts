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

export const Route = createFileRoute("/api/public/hooks/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
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
