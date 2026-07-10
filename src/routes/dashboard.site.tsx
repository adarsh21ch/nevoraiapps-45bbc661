import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, ExternalLink } from "lucide-react";
import { uploadTenantFile, signedUrl } from "@/lib/storage";
import { tenantSiteUrl } from "@/lib/tenant";
import { SiteContentTabs } from "@/components/dashboard/SiteContentTabs";


export const Route = createFileRoute("/dashboard/site")({
  component: SiteEditor,
});

function SiteEditor() {
  const { tenant } = useDashboard();



  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site editor</h1>
          <p className="text-sm text-muted-foreground">Update what visitors see on your public website.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={tenantSiteUrl(tenant)} target="_blank" rel="noreferrer">
            View site <ExternalLink className="size-3 ml-1" />
          </a>

        </Button>
      </header>

      <Tabs defaultValue="site">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="site">Site content</TabsTrigger>
          <TabsTrigger value="contact">Contact & UPI</TabsTrigger>
        </TabsList>
        <TabsContent value="site" className="pt-4">
          <SiteContentTabs tenantId={tenant.id} />
        </TabsContent>
        <TabsContent value="contact" className="pt-4">
          <ContactEditor />
        </TabsContent>
      </Tabs>

    </div>
  );
}



function ContactEditor() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    phone: tenant.phone ?? "",
    whatsapp: tenant.whatsapp ?? "",
    email: tenant.email ?? "",
    address: tenant.address ?? "",
    upi_id: tenant.upi_id ?? "",
    upi_qr_url: tenant.upi_qr_url ?? "",
    tagline: tenant.tagline ?? "",
    logo_url: tenant.logo_url ?? "",
    short_name: (tenant as any).short_name ?? "",
  });
  const [qrPreview, setQrPreview] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  useEffect(() => { if (form.upi_qr_url) signedUrl(form.upi_qr_url).then(setQrPreview); else setQrPreview(""); }, [form.upi_qr_url]);
  useEffect(() => { if (form.logo_url) signedUrl(form.logo_url).then(setLogoPreview); else setLogoPreview(""); }, [form.logo_url]);

  const invalidateTenant = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-tenant", tenant.id] });
    qc.invalidateQueries({ queryKey: ["current-tenant"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update(form as any).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); invalidateTenant(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(field: "upi_qr_url" | "logo_url", file: File) {
    try {
      const path = await uploadTenantFile(tenant.id, field, file);
      const next = { ...form, [field]: path };
      setForm(next);
      // Auto-persist the single field immediately so the change survives reload.
      const { error } = await supabase.from("tenants").update({ [field]: path } as any).eq("id", tenant.id);
      if (error) throw error;
      toast.success(field === "logo_url" ? "Logo updated" : "QR updated");
      invalidateTenant();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
        <div className="space-y-1.5 md:col-span-2">
          <Label>Short name <span className="text-xs text-muted-foreground">(shown when app is added to phone home screen — max 12 chars)</span></Label>
          <Input
            value={form.short_name}
            maxLength={12}
            placeholder="Sai Sports"
            onChange={(e) => setForm({ ...form, short_name: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 pt-2 border-t">
        <div className="space-y-2">
          <Label>UPI ID</Label>
          <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="yourupi@bank" />
          <Label className="text-xs">UPI QR image</Label>
          <div className="flex items-center gap-3">
            {qrPreview && <img src={qrPreview} alt="" className="size-16 rounded border" />}
            <label className="text-xs cursor-pointer inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Upload className="size-3" /> Upload QR
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("upi_qr_url", e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            {logoPreview && <img src={logoPreview} alt="" className="size-16 rounded border" />}
            <label className="text-xs cursor-pointer inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <Upload className="size-3" /> Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload("logo_url", e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>
          Save contact & branding
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
