import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { requireCronAuth } from "@/lib/cron-auth.server";

/**
 * POST /api/public/hooks/fee-reminders
 * Called by pg_cron (see supabase insert). Scans every active tenant for
 * overdue students in the current calendar period and queues a WhatsApp
 * reminder row in `reminder_logs`. Owners then tap-to-send from the dashboard.
 * Idempotent per (tenant, student, period, day) thanks to the unique index.
 */
export const Route = createFileRoute("/api/public/hooks/fee-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronAuth(request);
        if (unauthorized) return unauthorized;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const kolkata = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const period = format(kolkata, "yyyy-MM");
        const periodStart = new Date(kolkata.getFullYear(), kolkata.getMonth(), 1);

        // Load active tenants (name + slug for the message)
        const { data: tenants, error: tErr } = await supabaseAdmin
          .from("tenants")
          .select("id, name, slug")
          .eq("status", "active");
        if (tErr) {
          return Response.json({ ok: false, error: tErr.message }, { status: 500 });
        }

        let queued = 0;
        let skipped = 0;

        for (const t of tenants ?? []) {
          // Active students in this tenant with a fee plan
          const { studentDue, resolveEffectiveMonthlyFee, tenantFeeCycle, getPaidPeriodSet } = await import("@/lib/fees");
          const cycle = tenantFeeCycle(t as any);
          const { data: tenantData } = await supabaseAdmin
            .from("tenants")
            .select("gender_pricing_enabled")
            .eq("id", t.id)
            .single();

          const { data: students } = await supabaseAdmin
            .from("students")
            .select(
              "id, name, phone, guardian_name, guardian_phone, joined_at, gender, custom_fee, fee_plans(amount, female_amount, type)",
            )
            .eq("tenant_id", t.id)
            .eq("status", "active")
            .not("fee_plan_id", "is", null);

          if (!students?.length) continue;

          // Payments for this student in this period - Task 4 route to helper
          const { data: payments } = await supabaseAdmin
            .from("payments")
            .select("student_id, period, type")
            .eq("tenant_id", t.id)
            .eq("type", "monthly")
            .eq("period", period);
          const paidByStudent = getPaidPeriodSet((payments ?? []) as any);


          for (const s of students) {
            const paidPeriods = paidByStudent.get(s.id) ?? new Set();
            if (paidPeriods.has(period)) continue;
            const plan = (s.fee_plans as { amount: number; female_amount: number | null; type: string } | null) ?? null;
            if (!plan || plan.type !== "monthly") continue;

            const amount = resolveEffectiveMonthlyFee({
              plan,
              gender: s.gender,
              customFee: s.custom_fee,
              isGenderPricingEnabled: !!tenantData?.gender_pricing_enabled
            });

            // Check if actually due using studentDue
            const due = studentDue({
              cycle,
              joinedAt: s.joined_at!,
              selectedMonth: kolkata,
              paidPeriods,
              today: kolkata
            });

            if (due.state !== "pending") continue;


            const phoneRaw = (s.guardian_phone || s.phone || "").replace(/\D/g, "");
            if (!phoneRaw) {
              skipped++;
              continue;
            }
            const waNumber = phoneRaw.length === 10 ? `91${phoneRaw}` : phoneRaw;

            const greet = s.guardian_name?.trim()
              ? `Namaste ${s.guardian_name.trim()} ji`
              : "Namaste ji";
            const monthLabel = format(periodStart, "MMMM yyyy");
            const message =
              `${greet}, ${s.name} ki ${monthLabel} fees ` +
              `₹${amount.toLocaleString("en-IN")} pending hai. ` +
              `Kripya jald payment kar dein. Dhanyavaad 🙏 — ${t.name}`;
            const whatsapp_url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

            const { error: insErr } = await supabaseAdmin.from("reminder_logs").insert({
              tenant_id: t.id,
              student_id: s.id,
              period,
              channel: "whatsapp",
              message,
              whatsapp_url,
              phone: waNumber,
              amount,
              status: "queued",
            });
            if (!insErr) queued++;
            else skipped++;
          }
        }

        return Response.json({ ok: true, queued, skipped, period });
      },
    },
  },
});
