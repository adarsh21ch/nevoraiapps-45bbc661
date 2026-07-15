/**
 * Staff & Invitations — server functions.
 *
 * All mutations require an authenticated caller who is owner/admin/platform_admin
 * of the given tenant. RLS enforces the same, but we check explicitly for clean
 * error messages and to authorize before touching `supabaseAdmin` for auth
 * account creation.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

async function assertManager(
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  },
  userId: string,
  tenantId: string,
): Promise<void> {
  const [{ data: isOwner }, { data: isAdmin }, { data: isPlatform }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _tenant_id: tenantId, _role: "owner" }),
    supabase.rpc("has_role", { _user_id: userId, _tenant_id: tenantId, _role: "admin" }),
    supabase.rpc("is_platform_admin", { _uid: userId }),
  ]);
  if (!isOwner && !isAdmin && !isPlatform) {
    throw new Error("Forbidden: staff management requires owner or admin");
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const invitedRoles = ["coach", "head_coach", "assistant_coach", "admin", "staff"] as const;

const inviteInput = z.object({
  tenantId: uuid,
  email: z.string().trim().email().max(255).nullish(),
  phone: z.string().trim().min(6).max(24).nullish(),
  invitedRole: z.enum(invitedRoles),
  tempPassword: z.string().min(8).max(64).nullish(),
  displayName: z.string().trim().min(1).max(120).nullish(),
});

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => {
    const parsed = inviteInput.parse(v);
    if (!parsed.email && !parsed.phone) {
      throw new Error("Provide an email or phone number");
    }
    return parsed;
  })
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);

    const token = randomToken();
    const { data: row, error } = await context.supabase
      .from("staff_invitations")
      .insert({
        tenant_id: data.tenantId,
        email: data.email ?? null,
        phone: data.phone ?? null,
        invited_role: data.invitedRole,
        token,
        temp_password_hash: data.tempPassword ?? null,
        invited_by: context.userId,
      })
      .select("id, tenant_id, email, phone, invited_role, token, expires_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      ...row,
      displayName: data.displayName ?? null,
      inviteUrl: `/auth?invite=${token}`,
    };
  });

const idInput = z.object({ id: uuid, tenantId: uuid });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    const { error } = await context.supabase
      .from("staff_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    const token = randomToken();
    const { data: row, error } = await context.supabase
      .from("staff_invitations")
      .update({
        token,
        expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
        revoked_at: null,
        accepted_at: null,
        accepted_by: null,
      })
      .eq("id", data.id)
      .eq("tenant_id", data.tenantId)
      .select("id, tenant_id, email, phone, invited_role, token, expires_at")
      .single();
    if (error) throw new Error(error.message);
    return { ...row, inviteUrl: `/auth?invite=${token}` };
  });

/** Read a pending invitation by token — safe subset only. Called before sign-in. */
export const getInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("staff_invitations")
      .select("id, tenant_id, email, phone, invited_role, expires_at, accepted_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return null;
    if (inv.revoked_at) return { ...inv, status: "revoked" as const, tenantName: null };
    if (inv.accepted_at) return { ...inv, status: "accepted" as const, tenantName: null };
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return { ...inv, status: "expired" as const, tenantName: null };
    }
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", inv.tenant_id)
      .maybeSingle();
    return { ...inv, status: "pending" as const, tenantName: tenant?.name ?? null };
  });

/** Called after the invitee has signed in with Supabase Auth. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("staff_invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");
    if (inv.revoked_at) throw new Error("Invitation revoked");
    if (inv.accepted_at) throw new Error("Invitation already accepted");
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new Error("Invitation expired");

    const callerEmail = (context.claims?.email as string | undefined) ?? null;
    if (inv.email && callerEmail && inv.email.toLowerCase() !== callerEmail.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address");
    }

    // Upsert profile with tenant + legacy role hint.
    const legacyRole = inv.invited_role === "admin" ? "admin" : "coach";
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: context.userId,
        tenant_id: inv.tenant_id,
        role: legacyRole,
      },
      { onConflict: "user_id" },
    );
    if (profErr) throw new Error(profErr.message);

    // Precise role in user_roles (source of truth).
    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: context.userId,
        tenant_id: inv.tenant_id,
        role: inv.invited_role,
      },
      { onConflict: "user_id,tenant_id,role" },
    );
    if (roleErr) throw new Error(roleErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("staff_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id);
    if (updErr) throw new Error(updErr.message);

    return {
      ok: true,
      tenantId: inv.tenant_id,
      role: inv.invited_role,
    };
  });

const memberInput = z.object({ tenantId: uuid, userId: uuid });

export const disableStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => memberInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    if (data.userId === context.userId) throw new Error("You cannot disable your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove all non-owner roles for this user in this tenant (fully revoking access).
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    // Also deactivate their coach assignments.
    const { error: aerr } = await supabaseAdmin
      .from("coach_assignments")
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq("coach_user_id", data.userId)
      .eq("tenant_id", data.tenantId)
      .eq("active", true);
    if (aerr) throw new Error(aerr.message);
    return { ok: true };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    memberInput
      .extend({
        newRole: z.enum(invitedRoles),
        oldRole: z.enum(["owner", "admin", ...invitedRoles]).nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    if (data.userId === context.userId) throw new Error("You cannot change your own role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe non-owner roles in this tenant, then insert the new one.
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId)
      .neq("role", "owner");
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, tenant_id: data.tenantId, role: data.newRole });
    if (insErr) throw new Error(insErr.message);
    // Sync legacy profiles.role.
    const legacy = data.newRole === "admin" ? "admin" : "coach";
    await supabaseAdmin
      .from("profiles")
      .update({ role: legacy })
      .eq("user_id", data.userId)
      .eq("tenant_id", data.tenantId);
    return { ok: true };
  });

/* ---------- Coach assignments ---------- */

const assignInput = z.object({
  tenantId: uuid,
  batchId: uuid,
  coachUserId: uuid,
  coachRole: z.enum(["head_coach", "coach", "assistant_coach"]).default("coach"),
  notes: z.string().max(500).nullish(),
});

export const assignCoachToBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => assignInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    // If an active assignment exists, update its role/notes. Otherwise insert.
    const { data: existing } = await context.supabase
      .from("coach_assignments")
      .select("id")
      .eq("batch_id", data.batchId)
      .eq("coach_user_id", data.coachUserId)
      .eq("active", true)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await context.supabase
        .from("coach_assignments")
        .update({ coach_role: data.coachRole, notes: data.notes ?? null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id, updated: true };
    }
    const { data: row, error } = await context.supabase
      .from("coach_assignments")
      .insert({
        tenant_id: data.tenantId,
        batch_id: data.batchId,
        coach_user_id: data.coachUserId,
        coach_role: data.coachRole,
        notes: data.notes ?? null,
        assigned_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id, updated: false };
  });

export const removeCoachAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ tenantId: uuid, id: uuid }).parse(v))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.tenantId);
    const { error } = await context.supabase
      .from("coach_assignments")
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
