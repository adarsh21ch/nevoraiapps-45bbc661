import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  tenantId: z.string().uuid(),
});

/**
 * Platform-admin-only: creates an auth user (or reuses an existing one) and
 * links them to the given tenant as owner. Uses the service-role admin client
 * inside the handler so nothing leaks to the browser bundle.
 */
export const createTenantOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => schema.parse(raw))
  .handler(async ({ data, context }) => {
    // Verify caller is a platform admin (RLS wouldn't protect service-role calls below).
    const { data: adminRow, error: adminErr } = await context.supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (adminErr) throw new Error(adminErr.message);
    if (!adminRow) throw new Error("Forbidden: platform admins only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or create the auth user.
    let userId: string | null = null;
    const { data: existing, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const found = existing.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (found) {
      userId = found.id;
      // Reset password to the temp one the admin chose so they can share it once.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user?.id ?? null;
    }
    if (!userId) throw new Error("Failed to resolve user id");

    // Link profile — replace any prior tenant assignment for this user.
    const { error: delErr } = await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      tenant_id: data.tenantId,
      role: "owner",
    });
    if (insErr) throw new Error(insErr.message);

    return { userId, email: data.email };
  });
