import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";

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
      POST: async () => {
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
          const { data: students } = await supabaseAdmin
            .from("students")
            .select("id, name, phone, guardian_name, guardian_phone, joined_at, fee_plans(amount, type)")
            .eq("tenant_id", t.id)
            .eq("status", "active")
            .not("fee_plan_id", "is", null);
          if (!students?.length) continue;

          // Payments in this period
          const { data: payments } = await supabaseAdmin
            .from("payments")
            .select("student_id")
            .eq("tenant_id", t.id)
            .eq("period", period);
          const paid = new Set((payments ?? []).map((p) => p.student_id));

          for (const s of students) {
            if (paid.has(s.id)) continue;
            const plan = (s.fee_plans as { amount: number; type: string } | null) ?? null;
            if (!plan || plan.type !== "monthly") continue;

            const joined = s.joined_at ? new Date(s.joined_at + "T00:00:00") : null;
            if (joined && joined > periodStart) continue; // not enrolled yet

            const phoneRaw = (s.guardian_phone || s.phone || "").replace(/\D/g, "");
            if (!phoneRaw) { skipped++; continue; }
            const waNumber = phoneRaw.length === 10 ? `91${phoneRaw}` : phoneRaw;

            const greet = s.guardian_name?.trim()
              ? `Namaste ${s.guardian_name.trim()} ji`
              : "Namaste ji";
            const monthLabel = format(periodStart, "MMMM yyyy");
            const message =
              `${greet}, ${s.name} ki ${monthLabel} fees ` +
              `₹${Number(plan.amount).toLocaleString("en-IN")} pending hai. ` +
              `Kripya jald payment kar dein. Dhanyavaad 🙏 — ${t.name}`;
            const whatsapp_url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

            const { error: insErr } = await supabaseAdmin
              .from("reminder_logs")
              .insert({
                tenant_id: t.id,
                student_id: s.id,
                period,
                channel: "whatsapp",
                message,
                whatsapp_url,
                phone: waNumber,
                amount: plan.amount,
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
