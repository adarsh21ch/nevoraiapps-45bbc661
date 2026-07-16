/**
 * Shared auth guard for public cron hooks under /api/public/hooks/*.
 *
 * Preferred: header `x-cron-secret` matching CRON_SECRET (a project secret,
 * server-only, never shipped to the browser).
 *
 * Backward compat: if CRON_SECRET is not set, fall back to the previous
 * Supabase publishable/anon-key check via `apikey` or `Authorization: Bearer`.
 * The anon key ships in the client bundle, so this fallback is NOT real auth
 * and exists only to keep existing schedules working during rollout.
 */
export function requireCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get("x-cron-secret") === secret
      ? null
      : new Response("Unauthorized", { status: 401 });
  }
  const legacy = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (legacy && provided === legacy) return null;
  return new Response("Unauthorized", { status: 401 });
}
