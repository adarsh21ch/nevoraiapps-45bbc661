/**
 * Shared auth guard for public cron hooks under /api/public/hooks/*.
 *
 * Only the `x-cron-secret` header matching CRON_SECRET (a server-only
 * project secret, never shipped to the browser) is accepted. The previous
 * anon-key / Authorization: Bearer fallback was removed after all pg_cron
 * jobs were rotated to send `x-cron-secret` (Phase 4).
 */
export function requireCronAuth(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("x-cron-secret") === secret) return null;
  return new Response("Unauthorized", { status: 401 });
}
