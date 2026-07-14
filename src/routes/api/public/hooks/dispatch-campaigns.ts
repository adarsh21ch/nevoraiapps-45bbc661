import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron target: dispatches all `scheduled` campaigns whose scheduled_for has
 * elapsed. Configure pg_cron to POST here every minute.
 *
 * Auth: apikey header (Supabase anon/publishable key). Route is public-prefixed
 * so it bypasses SSR auth; PostgREST enforces RLS on any writes done via the
 * client below.
 */
export const Route = createFileRoute("/api/public/hooks/dispatch-campaigns")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("apikey") || request.headers.get("authorization")?.replace("Bearer ", "");
        if (!auth || auth !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: due, error } = await supabase
          .from("comm_campaigns")
          .select("id")
          .eq("status", "scheduled")
          .lte("scheduled_for", new Date().toISOString())
          .limit(50);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        const results: { id: string; ok: boolean; err?: string }[] = [];
        for (const c of due ?? []) {
          const { error: rpcErr } = await supabase.rpc("send_campaign", { _campaign_id: c.id });
          results.push({ id: c.id, ok: !rpcErr, err: rpcErr?.message });
        }
        return new Response(
          JSON.stringify({ processed: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
