import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const cleanupOrphanedApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only ever deletes the CALLER's own account, and only if it's provably orphaned —
    // this must never be usable to delete someone else's or a real account.
    const [{ count: regCount }, { count: roleCount }] = await Promise.all([
      supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }).eq("applicant_user_id", context.userId),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", context.userId),
    ]);
    if ((regCount ?? 0) > 0 || (roleCount ?? 0) > 0) {
      throw new Error("Account is not orphaned; refusing to delete.");
    }
    await supabaseAdmin.auth.admin.deleteUser(context.userId);
    return { ok: true };
  });
