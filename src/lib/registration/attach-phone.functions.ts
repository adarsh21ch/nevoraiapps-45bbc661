import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Attach a phone number to the auth user that was just created via the public
 * `/register` flow. Runs unauthenticated (the applicant hasn't signed in yet).
 *
 * Safety gates before touching auth admin:
 *  - The tenant must be active.
 *  - A `registrations` row must exist for this tenant with a matching
 *    `applicant_user_id` AND `phone`. The row is written by
 *    `submit_registration` moments before this fn is called.
 *  - Phone must already be normalized to E.164 (starts with `+`).
 *
 * If the phone is already attached to another auth user (uniqueness conflict),
 * we intentionally succeed with `attached=false` so registration doesn't fail
 * — email login still works.
 */
const inputSchema = z.object({
  tenantId: z.string().uuid(),
  applicantUserId: z.string().uuid(),
  phoneE164: z.string().regex(/^\+\d{8,15}$/),
});

export const attachPhoneToApplicant = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify tenant is active
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, status")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (!tenant || tenant.status !== "active") {
      return { attached: false, reason: "tenant_inactive" as const };
    }

    // Verify a matching registration row was just written for this user + phone.
    // We compare the trimmed local phone by checking either the raw form or a
    // stripped variant (registrations.phone may be stored as entered).
    const rawDigits = data.phoneE164.replace(/^\+/, "");
    const last10 = rawDigits.slice(-10);
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("id, phone, applicant_user_id, tenant_id")
      .eq("tenant_id", data.tenantId)
      .eq("applicant_user_id", data.applicantUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!reg) {
      return { attached: false, reason: "no_registration" as const };
    }
    const regDigits = String(reg.phone ?? "").replace(/\D+/g, "");
    const regLast10 = regDigits.slice(-10);
    if (regLast10 !== last10) {
      return { attached: false, reason: "phone_mismatch" as const };
    }

    // Attach the phone. Conflicts (phone in use by another auth user) are
    // swallowed — email login still works.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.applicantUserId,
      { phone: data.phoneE164, phone_confirm: true },
    );
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("exists") ||
        msg.includes("duplicate") ||
        msg.includes("unique")
      ) {
        return { attached: false, reason: "phone_in_use" as const };
      }
      return { attached: false, reason: "auth_error" as const };
    }
    return { attached: true as const };
  });
