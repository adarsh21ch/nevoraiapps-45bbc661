/**
 * Shared auth guard for public cron hooks under /api/public/hooks/*.
 *
 * Preferred: header `x-cron-secret` matching CRON_SECRET (a server-only
 * project secret, never shipped to the browser).
 *
 * Legacy: `apikey` / `Authorization: Bearer` header matching the Supabase
 * publishable/anon key. This key ships in the client bundle so it is NOT
 * a real secret — accepted only to keep existing pg_cron schedules working
 * while they are rotated to `x-cron-secret`. Remove the legacy branch once
 * every scheduled caller sends `x-cron-secret`.
 */
export function requireCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") === secret) return null;

  const legacy = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (legacy && provided === legacy) return null;

  return new Response("Unauthorized", { status: 401 });
}
