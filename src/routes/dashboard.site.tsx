import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchSiteContent, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { uploadTenantFile, signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/dashboard/site")({
  component: SiteEditor,
});

function SiteEditor() {
  const { tenant } = useDashboard();
  const content = useQuery({ queryKey: qk.site(tenant.id), queryFn: () => fetchSiteContent(tenant.id) });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site editor</h1>
          <p className="text-sm text-muted-foreground">Update what visitors see on your public website.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/?tenant=${tenant.slug}`} target="_blank" rel="noreferrer">
            View site <ExternalLink className="size-3 ml-1" />
          </a>
        </Button>
      </header>

      <Tabs defaultValue="hero">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="stars">Star players</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="contact">Contact & UPI</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="pt-4">
          <SingleSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="hero"
            fields={[
              { key: "headline", label: "Headline" },
              { key: "subheadline", label: "Subheadline", multiline: true },
              { key: "cta_label", label: "Call-to-action label" },
            ]} />
        </TabsContent>
        <TabsContent value="about" className="pt-4">
          <SingleSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="about"
            fields={[
              { key: "heading", label: "Heading" },
              { key: "body", label: "Body", multiline: true, rows: 6 },
            ]} />
        </TabsContent>
        <TabsContent value="stars" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="star_players"
            fields={[
              { key: "name", label: "Name" },
              { key: "achievement", label: "Achievement" },
            ]}
            imageField="photo" />
        </TabsContent>
        <TabsContent value="gallery" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="gallery"
            fields={[{ key: "caption", label: "Caption" }]} imageField="url" />
        </TabsContent>
        <TabsContent value="contact" className="pt-4">
          <ContactEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Field = { key: string; label: string; multiline?: boolean; rows?: number };

function SingleSectionEditor({ tenantId, rows, section, fields }: {
  tenantId: string; rows: any[]; section: string; fields: Field[];
}) {
  const qc = useQueryClient();
  const existing = rows.find((r) => r.section === section);
  const [values, setValues] = useState<Record<string, string>>(() => (existing?.content as any) ?? {});
  useEffect(() => { setValues((existing?.content as any) ?? {}); }, [existing?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (existing) {
        const { error } = await supabase.from("site_content").update({ content: values }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_content").insert({
          tenant_id: tenantId, section, content: values, sort_order: 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: qk.site(tenantId) }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5 space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}</Label>
          {f.multiline ? (
            <Textarea rows={f.rows ?? 3} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : (
            <Input value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div><Button onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>Save</Button></div>
    </Card>
  );
}

function MultiSectionEditor({ tenantId, rows, section, fields, imageField }: {
  tenantId: string; rows: any[]; section: string; fields: Field[]; imageField?: string;
}) {
  const qc = useQueryClient();
  const items = rows.filter((r) => r.section === section);
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.site(tenantId) });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_content").insert({
        tenant_id: tenantId, section, content: {}, sort_order: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <ItemCard key={it.id} row={it} fields={fields} imageField={imageField} tenantId={tenantId} onChange={invalidate} />
      ))}
      <Button variant="outline" onClick={() => add.mutate()}>
        <Plus className="size-4 mr-1" /> Add {section.replace("_", " ")}
      </Button>
    </div>
  );
}

function ItemCard({ row, fields, imageField, tenantId, onChange }: {
  row: any; fields: Field[]; imageField?: string; tenantId: string; onChange: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(row.content ?? {});
  const [uploading, setUploading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string>("");

  useEffect(() => {
    const p = imageField ? values[imageField] : "";
    if (p) signedUrl(p).then(setImgUrl); else setImgUrl("");
  }, [values, imageField]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_content").update({ content: values }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_content").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !imageField) return;
    setUploading(true);
    try {
      const path = await uploadTenantFile(tenantId, row.section, f);
      setValues({ ...values, [imageField]: path });
      toast.success("Uploaded — remember to Save");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-4">
        {imageField && (
          <div className="w-24 shrink-0">
            <div className="aspect-square rounded-md bg-muted overflow-hidden grid place-items-center">
              {imgUrl ? <img src={imgUrl} className="w-full h-full object-cover" alt="" /> : <Upload className="size-6 text-muted-foreground" />}
            </div>
            <label className="mt-2 block">
              <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                <Upload className="size-3" /> {uploading ? "Uploading…" : "Upload"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
          </div>
        )}
        <div className="flex-1 space-y-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              {f.multiline
                ? <Textarea rows={f.rows ?? 2} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                : <Input value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => confirm("Delete this item?") && del.mutate()}>
          <Trash2 className="size-4 mr-1" /> Delete
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>
          Save
        </Button>
      </div>
    </Card>
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
  });
  const [qrPreview, setQrPreview] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string>("");
  useEffect(() => { if (form.upi_qr_url) signedUrl(form.upi_qr_url).then(setQrPreview); }, [form.upi_qr_url]);
  useEffect(() => { if (form.logo_url) signedUrl(form.logo_url).then(setLogoPreview); }, [form.logo_url]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update(form).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["dashboard-tenant", tenant.id] });
      qc.invalidateQueries({ queryKey: ["current-tenant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(field: "upi_qr_url" | "logo_url", file: File) {
    try {
      const path = await uploadTenantFile(tenant.id, field, file);
      setForm({ ...form, [field]: path });
      toast.success("Uploaded — remember to Save");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
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
