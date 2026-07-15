import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/apply/$slug")({
  head: () => ({
    meta: [
      { title: "Apply for Admission" },
      { name: "description", content: "Apply for admission to the academy." },
    ],
  }),
  component: () => (
    <TenantGate>
      <ApplyPage />
    </TenantGate>
  ),
});

const applySchema = z.object({
  name: z.string().trim().min(2).max(100),
  parent_name: z.string().trim().max(100).optional(),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  sport: z.string().max(80).optional(),
  batch_pref: z.string().max(80).optional(),
  dob: z.string().optional(),
  address: z.string().max(500).optional(),
  medical_notes: z.string().max(1000).optional(),
});

function ApplyPage() {
  const tenant = useTenant();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    parent_name: "",
    phone: "",
    email: "",
    password: "",
    sport: "",
    batch_pref: "",
    dob: "",
    address: "",
    medical_notes: "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = applySchema.parse(form);
      // 1) Sign up
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: parsed.email,
        password: parsed.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: parsed.name, tenant_slug: tenant?.slug },
        },
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id ?? null;
      // 2) Insert registration under tenant
      const { error: regErr } = await supabase.from("registrations").insert({
        tenant_id: tenant!.id,
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        guardian_name: parsed.parent_name || null,
        dob: parsed.dob || null,
        address: parsed.address || null,
        sport: parsed.sport || null,
        medical_notes: parsed.medical_notes || null,
        applicant_user_id: userId,
        review_status: "pending",
        status: "submitted",
        joined_at: new Date().toISOString().slice(0, 10),
      });
      if (regErr) throw regErr;
      // 3) Fire automation event (best-effort)
      await supabase.from("automation_events").insert({
        tenant_id: tenant!.id,
        event_type: "student.registration_submitted",
        source_module: "admissions",
        source_id: userId,
        payload: { name: parsed.name, phone: parsed.phone, email: parsed.email },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application submitted! Check your email to confirm.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Application Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Thank you for applying to <strong>{tenant?.name}</strong>. Your application is now under review.</p>
            <p>You can sign in anytime to check your status.</p>
            <Button asChild>
              <a href="/auth">Sign in</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Apply for Admission</h1>
        <p className="text-sm text-muted-foreground">Join {tenant?.name}. We'll review and get back to you.</p>
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <Field label="Student Name *" v={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Parent / Guardian Name" v={form.parent_name} onChange={(v) => setForm({ ...form, parent_name: v })} />
          <Field label="Mobile *" v={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email *" v={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Password *" v={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <Field label="Date of Birth" v={form.dob} onChange={(v) => setForm({ ...form, dob: v })} type="date" />
          <Field label="Sport" v={form.sport} onChange={(v) => setForm({ ...form, sport: v })} />
          <Field label="Preferred Batch" v={form.batch_pref} onChange={(v) => setForm({ ...form, batch_pref: v })} />
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Medical notes (allergies, conditions)</Label>
            <Textarea rows={2} value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Button
              size="lg"
              className="w-full"
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "Submitting…" : "Submit Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  v,
  onChange,
  type = "text",
}: {
  label: string;
  v: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
