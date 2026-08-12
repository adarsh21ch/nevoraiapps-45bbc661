# Security Audit and Fixes - Phase 1

This plan addresses several security issues identified during the manual audit of the AcademyOS codebase, focusing on RLS hardening, server function protection, and environment variable safety.

## Database (RLS & Functions)

- **Hardening `site_content` RLS**: The `site_content` table has a broad `SELECT TO anon USING (true)` policy. I will restrict this to specific content types or ensure it only exposes non-sensitive data.
- **Security Definer Functions**: Several migrations contain `SECURITY DEFINER` functions without an explicit `search_path`. This is a security risk as it can be exploited via path hijacking. I will add `SET search_path = public` to these functions.
- **Privilege Cleanup**: Revoke `EXECUTE` on sensitive internal `SECURITY DEFINER` functions from the `public` and `anon` roles.

## Server Functions

- **Auth Verification**: Audit `createServerFn` declarations that lack `.middleware([requireSupabaseAuth])` but perform sensitive operations.
- **Tenant Isolation**: Ensure all server functions that take a `tenantId` perform a membership check (e.g., using `assertAdmin` or `assertMember`) inside the handler.

## Environment Variables

- **Leak Prevention**: Move `process.env` reads from module scope into function handlers to prevent values from leaking into the client-side bundle and to ensure correctness in edge runtimes (like Cloudflare Workers).

## Implementation Details

### Database Migrations
Create a new migration `supabase/migrations/20260812090000_security_hardening.sql`:
- Fix `SECURITY DEFINER` search paths.
- Tighten RLS on `site_content`.
- Revoke execution rights on internal helpers.

### Server-side Fixes
- **`src/lib/automation/providers/whatsapp/adapters/meta.ts`**: Move `process.env` reads inside `readConfig()` and other functions.
- **`src/lib/automation/providers/push/adapters/expo.ts`**: (If exists) Move env reads inside handlers.
- **`src/integrations/supabase/client.ts`**: Ensure env reads are correctly gated for SSR vs Client.

## Verification Plan

- Run `lovable-exec build:dev` to ensure no environment variable leaks break the build.
- Manually verify RLS policies in the Supabase dashboard (or via `supabase--read_query`).
- Check that `requireSupabaseAuth` middleware is present on all non-public server functions.
