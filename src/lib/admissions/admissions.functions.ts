/**
 * Phase 7 — Admissions & Onboarding server functions.
 * Extends the existing students / registrations modules; does not replace them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = z.object({ registrationId: z.string().uuid(), tenantId: z.string().uuid() });

async function assertAdmin(context: { supabase: any; userId: string }, tenantId: string) {
  const { data: tenant } = await context.supabase.from("tenants").select("owner_id").eq("id", tenantId).maybeSingle();
  if (tenant?.owner_id === context.userId) return true;
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "owner"])
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
  return true;
}

/** Approve a registration → creates/updates student, sets lifecycle. */
export const approveRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      registrationId: string;
      tenantId: string;
      batchId?: string | null;
      feePlanId?: string | null;
      rollNumber?: string | null;
      coachName?: string | null;
      admissionDate?: string | null;
      notes?: string | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const { supabase } = context;
    const { data: reg, error: regErr } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", data.registrationId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (regErr || !reg) throw new Error("Registration not found");

    let studentId = reg.student_id as string | null;
    const activationToken = crypto.randomUUID();
    const studentPayload = {
      tenant_id: data.tenantId,
      name: reg.name,
      phone: reg.phone,
      guardian_name: reg.guardian_name,
      guardian_phone: reg.guardian_phone,
      dob: reg.dob,
      photo_url: reg.photo_url,
      batch_id: data.batchId ?? reg.batch_id,
      fee_plan_id: data.feePlanId ?? reg.fee_plan_id,
      address: reg.address,
      gender: reg.gender,
      email: reg.email,
      roll_number: data.rollNumber ?? null,
      coach_name: data.coachName ?? null,
      joined_at: data.admissionDate ?? new Date().toISOString().slice(0, 10),
      user_id: reg.applicant_user_id,
      lifecycle_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: context.userId,
      status: "active",
      activation_token: activationToken,
    };

    if (studentId) {
      const { error } = await supabase.from("students").update(studentPayload).eq("id", studentId);
      if (error) throw error;
    } else {
      const { data: created, error } = await supabase.from("students").insert(studentPayload).select("id").single();
      if (error) throw error;
      studentId = created.id;
    }

    await supabase
      .from("registrations")
      .update({
        review_status: "approved",
        review_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        student_id: studentId,
        status: "approved",
      })
      .eq("id", data.registrationId);

    await supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.registration_approved",
      source_module: "admissions",
      source_id: studentId,
      payload: { registration_id: data.registrationId, student_id: studentId, activation_token: activationToken },
    });

    return { ok: true, studentId, activationToken };
  });

export const rejectRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ reason: z.string().min(1).max(500) }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const { error } = await context.supabase
      .from("registrations")
      .update({
        review_status: "rejected",
        review_notes: data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        status: "rejected",
      })
      .eq("id", data.registrationId)
      .eq("tenant_id", data.tenantId);
    if (error) throw error;
    await context.supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.registration_rejected",
      source_module: "admissions",
      source_id: data.registrationId,
      payload: { reason: data.reason },
    });
    return { ok: true };
  });

export const waitlistRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput.extend({ notes: z.string().max(500).optional() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    await context.supabase
      .from("registrations")
      .update({
        review_status: "waitlisted",
        review_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        status: "waitlisted",
      })
      .eq("id", data.registrationId)
      .eq("tenant_id", data.tenantId);
    await context.supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.waitlisted",
      source_module: "admissions",
      source_id: data.registrationId,
      payload: {},
    });
    return { ok: true };
  });

/** Bulk import imported students (existing academy migration). */
export const bulkImportStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      tenantId: string;
      fileName?: string;
      rows: Array<{
        name: string;
        phone: string;
        guardian_name?: string | null;
        guardian_phone?: string | null;
        dob?: string | null;
        email?: string | null;
        batch_id?: string | null;
        fee_plan_id?: string | null;
        roll_number?: string | null;
        address?: string | null;
      }>;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const { supabase } = context;

    const { data: batch, error: batchErr } = await supabase
      .from("student_import_batches")
      .insert({
        tenant_id: data.tenantId,
        created_by: context.userId,
        source: "excel",
        file_name: data.fileName ?? null,
        row_count: data.rows.length,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw batchErr ?? new Error("Failed to create batch");

    const errors: Array<{ row: number; error: string }> = [];
    let success = 0;
    const inserts = data.rows.map((r) => ({
      tenant_id: data.tenantId,
      name: r.name,
      phone: r.phone,
      guardian_name: r.guardian_name ?? null,
      guardian_phone: r.guardian_phone ?? null,
      dob: r.dob ?? null,
      email: r.email ?? null,
      batch_id: r.batch_id ?? null,
      fee_plan_id: r.fee_plan_id ?? null,
      roll_number: r.roll_number ?? null,
      address: r.address ?? null,
      lifecycle_status: "imported",
      status: "active",
      import_batch_id: batch.id,
      activation_token: crypto.randomUUID(),
    }));

    // Insert in chunks of 100
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error, count } = await supabase.from("students").insert(chunk, { count: "exact" });
      if (error) {
        errors.push({ row: i, error: error.message });
      } else {
        success += count ?? chunk.length;
      }
    }

    await supabase
      .from("student_import_batches")
      .update({
        success_count: success,
        error_count: errors.length,
        status: errors.length === data.rows.length ? "failed" : "completed",
        errors,
      })
      .eq("id", batch.id);

    await supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.imported",
      source_module: "admissions",
      source_id: batch.id,
      payload: { batch_id: batch.id, count: success },
    });

    return { ok: true, batchId: batch.id, success, errors };
  });

/** Rollback an import batch — deletes imported students who are still in imported/invitation_sent. */
export const rollbackImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { batchId: string; tenantId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const { error } = await context.supabase
      .from("students")
      .delete()
      .eq("import_batch_id", data.batchId)
      .eq("tenant_id", data.tenantId)
      .in("lifecycle_status", ["imported", "invitation_sent"]);
    if (error) throw error;
    await context.supabase
      .from("student_import_batches")
      .update({ rolled_back_at: new Date().toISOString(), status: "rolled_back" })
      .eq("id", data.batchId);
    return { ok: true };
  });

/** Send activation to imported students (marks invitation_sent, refreshes token). */
export const sendActivations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string; studentIds: string[] }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const now = new Date().toISOString();
    const results: Array<{ studentId: string; token: string }> = [];
    for (const id of data.studentIds) {
      const token = crypto.randomUUID();
      const { error } = await context.supabase
        .from("students")
        .update({
          activation_token: token,
          activation_sent_at: now,
          lifecycle_status: "invitation_sent",
        })
        .eq("id", id)
        .eq("tenant_id", data.tenantId);
      if (!error) results.push({ studentId: id, token });
    }
    await context.supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.activation_sent",
      source_module: "admissions",
      source_id: null,
      payload: { count: results.length, student_ids: results.map((r) => r.studentId) },
    });
    return { ok: true, results };
  });

/** Activate a student via activation token (called from public activation route). */
export const activateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: student, error } = await context.supabase
      .from("students")
      .select("id, tenant_id, lifecycle_status")
      .eq("activation_token", data.token)
      .maybeSingle();
    if (error || !student) throw new Error("Invalid activation token");
    const { error: updErr } = await context.supabase
      .from("students")
      .update({
        activated_at: new Date().toISOString(),
        activation_token: null,
        lifecycle_status: "activated",
        user_id: context.userId,
      })
      .eq("id", student.id);
    if (updErr) throw updErr;
    await context.supabase.from("automation_events").insert({
      tenant_id: student.tenant_id,
      event_type: "student.activated",
      source_module: "admissions",
      source_id: student.id,
      payload: { student_id: student.id },
    });
    return { ok: true, studentId: student.id, tenantId: student.tenant_id };
  });

/** Request changes on a submitted registration. */
export const requestRegistrationChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { registrationId: string; tenantId: string; notes: string; missingDocs?: string[] }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const { error } = await context.supabase
      .from("registrations")
      .update({
        review_status: "changes_requested",
        review_notes: data.notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        status: "changes_requested",
      })
      .eq("id", data.registrationId)
      .eq("tenant_id", data.tenantId);
    if (error) throw error;
    await context.supabase.from("automation_events").insert({
      tenant_id: data.tenantId,
      event_type: "student.registration_changes_requested",
      source_module: "admissions",
      source_id: data.registrationId,
      payload: { notes: data.notes, missing_docs: data.missingDocs ?? [] },
    });
    return { ok: true };
  });

/** Bulk update lifecycle / batch / fee plan for many students in one call. */
export const bulkUpdateStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      tenantId: string;
      studentIds: string[];
      batchId?: string | null;
      feePlanId?: string | null;
      lifecycleStatus?: string | null;
      status?: string | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context, data.tenantId);
    const patch: Record<string, string | null> = {};
    if (data.batchId !== undefined) patch.batch_id = data.batchId;
    if (data.feePlanId !== undefined) patch.fee_plan_id = data.feePlanId;
    if (data.lifecycleStatus !== undefined && data.lifecycleStatus !== null)
      patch.lifecycle_status = data.lifecycleStatus;
    if (data.status !== undefined && data.status !== null) patch.status = data.status;
    if (Object.keys(patch).length === 0) return { ok: true, count: 0 };
    const { data: updated, error } = await context.supabase
      .from("students")
      .update(patch as any)
      .in("id", data.studentIds)
      .eq("tenant_id", data.tenantId)
      .select("id");
    if (error) throw error;
    return { ok: true, count: updated?.length ?? 0 };
  });

