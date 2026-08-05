import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteStudentPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { studentId: string }) => v)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Check if the caller is an owner of the student's tenant
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("tenant_id")
      .eq("id", data.studentId)
      .single();
      
    if (!student) throw new Error("Student not found");
    
    const { data: isOwner } = await context.supabase.rpc("is_tenant_owner", {
      _uid: context.userId,
      _tenant: student.tenant_id,
    });
    
    if (!isOwner) throw new Error("Forbidden");

    // Perform cleanup for RESTRICT foreign keys
    // 1. Billing payment allocations
    await supabaseAdmin
      .from("billing_payment_allocations")
      .delete()
      .in("payment_id", 
        (await supabaseAdmin.from("billing_payments").select("id").eq("student_id", data.studentId)).data?.map(p => p.id) ?? []
      );
      
    // 2. Billing payments
    await supabaseAdmin.from("billing_payments").delete().eq("student_id", data.studentId);
    
    // 3. Billing invoices (and lines)
    const invoiceIds = (await supabaseAdmin.from("billing_invoices").select("id").eq("student_id", data.studentId)).data?.map(i => i.id) ?? [];
    if (invoiceIds.length > 0) {
      await supabaseAdmin.from("billing_invoice_lines").delete().in("invoice_id", invoiceIds);
      await supabaseAdmin.from("billing_invoices").delete().in("id", invoiceIds);
    }
    
    // 4. Billing charges and subscriptions
    await supabaseAdmin.from("billing_charges").delete().eq("student_id", data.studentId);
    await supabaseAdmin.from("billing_subscriptions").delete().eq("student_id", data.studentId);
    
    // 5. Legacy payments
    await supabaseAdmin.from("payments").delete().eq("student_id", data.studentId);
    
    // 6. Finally, the student (other tables like attendance_marks are CASCADE)
    const { error } = await supabaseAdmin.from("students").delete().eq("id", data.studentId);
    if (error) throw error;
    
    return { ok: true };
  });

export const deleteAllArchivedStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { tenantId: string }) => v)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: isOwner } = await context.supabase.rpc("is_tenant_owner", {
      _uid: context.userId,
      _tenant: data.tenantId,
    });
    
    if (!isOwner) throw new Error("Forbidden");

    // Get all 'left' students
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("status", "left");
      
    if (!students || students.length === 0) return { count: 0 };
    
    const studentIds = students.map(s => s.id);

    // Bulk cleanup
    // This is a simplified version for bulk - in a real scenario we'd do it more efficiently
    // but for "test data" cleanup, individual deletes or bulk queries are fine.
    
    // Billing payment allocations
    const paymentIds = (await supabaseAdmin.from("billing_payments").select("id").in("student_id", studentIds)).data?.map(p => p.id) ?? [];
    if (paymentIds.length > 0) {
      await supabaseAdmin.from("billing_payment_allocations").delete().in("payment_id", paymentIds);
    }
    
    await supabaseAdmin.from("billing_payments").delete().in("student_id", studentIds);
    
    const invoiceIds = (await supabaseAdmin.from("billing_invoices").select("id").in("student_id", studentIds)).data?.map(i => i.id) ?? [];
    if (invoiceIds.length > 0) {
      await supabaseAdmin.from("billing_invoice_lines").delete().in("invoice_id", invoiceIds);
      await supabaseAdmin.from("billing_invoices").delete().in("id", invoiceIds);
    }
    
    await supabaseAdmin.from("billing_charges").delete().in("student_id", studentIds);
    await supabaseAdmin.from("billing_subscriptions").delete().in("student_id", studentIds);
    await supabaseAdmin.from("payments").delete().in("student_id", studentIds);
    
    const { error } = await supabaseAdmin.from("students").delete().in("id", studentIds);
    if (error) throw error;
    
    return { count: studentIds.length };
  });
