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
import { tenantSiteUrl } from "@/lib/tenant";


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
          <a href={tenantSiteUrl(tenant)} target="_blank" rel="noreferrer">
            View site <ExternalLink className="size-3 ml-1" />
          </a>

        </Button>
      </header>

      <Tabs defaultValue="hero">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="founder">Founder</TabsTrigger>
          <TabsTrigger value="coaches">Coaches</TabsTrigger>
          <TabsTrigger value="spotlight">Spotlight</TabsTrigger>
          <TabsTrigger value="stars">Star players</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="cta">CTA banner</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="contact">Contact & UPI</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="pt-4">
          <HeroLikeEditor tenantId={tenant.id} rows={content.data ?? []} section="hero"
            textFields={[
              { key: "headline", label: "Headline" },
              { key: "subheadline", label: "Subheadline", multiline: true, rows: 3 },
              { key: "cta_label", label: "Call-to-action label", placeholder: "Register Now" },
            ]}
            bgLabel="Hero background (image or short video)" />
        </TabsContent>
        <TabsContent value="about" className="pt-4">
          <SingleSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="about"
            fields={[
              { key: "heading", label: "Heading" },
              { key: "body", label: "Body", multiline: true, rows: 6 },
            ]} />
        </TabsContent>
        <TabsContent value="founder" className="pt-4">
          <SingleSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="founder"
            fields={[
              { key: "name", label: "Founder name" },
              { key: "title", label: "Title (e.g. Director & Chief Coach)" },
              { key: "credentials", label: "Credentials (e.g. Padma Shri Awardee)" },
              { key: "bio", label: "Bio / Story", multiline: true, rows: 8 },
            ]}
            imageField="photo_url"
            imageLabel="Founder photo" />
        </TabsContent>
        <TabsContent value="coaches" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="coaches"
            fields={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role (e.g. Head Coach, Batting Coach)" },
              { key: "bio", label: "Short bio (optional)", multiline: true, rows: 2 },
            ]}
            imageField="photo_url" />
        </TabsContent>
        <TabsContent value="spotlight" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="spotlight"
            fields={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role / Title" },
              { key: "bio", label: "Bio / Achievements", multiline: true, rows: 5 },
            ]}
            imageField="photo_url" />
        </TabsContent>
        <TabsContent value="stars" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="star_players"
            fields={[
              { key: "name", label: "Name" },
              { key: "achievement", label: "Achievement" },
            ]}
            imageField="photo_url" />
        </TabsContent>
        <TabsContent value="gallery" className="pt-4">
          <MultiSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="gallery"
            fields={[{ key: "caption", label: "Caption (optional)" }]} imageField="url" />
        </TabsContent>
        <TabsContent value="cta" className="pt-4">
          <HeroLikeEditor tenantId={tenant.id} rows={content.data ?? []} section="cta"
            textFields={[
              { key: "headline", label: "Headline (optional — defaults to 'Ready to join …')" },
              { key: "subheadline", label: "Message", multiline: true, rows: 3 },
            ]}
            bgLabel="CTA banner background image (photo of your ground, stadium, etc.)" />
        </TabsContent>
        <TabsContent value="map" className="pt-4">
          <SingleSectionEditor tenantId={tenant.id} rows={content.data ?? []} section="map"
            fields={[
              { key: "embed_url", label: "Google Maps embed URL", placeholder: "https://www.google.com/maps/embed?pb=…" },
              { key: "directions_url", label: "Directions link (optional)", placeholder: "https://maps.app.goo.gl/…" },
            ]} />
          <p className="text-xs text-muted-foreground mt-2">
            In Google Maps → Share → Embed a map → copy the <code>src</code> URL only (starts with
            <code>https://www.google.com/maps/embed?pb=</code>).
          </p>
        </TabsContent>
        <TabsContent value="contact" className="pt-4">
          <ContactEditor />
        </TabsContent>
      </Tabs>

    </div>
  );
}

type Field = { key: string; label: string; multiline?: boolean; rows?: number; placeholder?: string };

async function persistSectionContent(tenantId: string, section: string, existingId: string | null, content: Record<string, unknown>) {
  if (existingId) {
    const { error } = await supabase.from("site_content").update({ content: content as any }).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase.from("site_content")
    .insert({ tenant_id: tenantId, section, content: content as any, sort_order: 0 })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

function SingleSectionEditor({ tenantId, rows, section, fields, imageField, imageLabel }: {
  tenantId: string; rows: any[]; section: string; fields: Field[]; imageField?: string; imageLabel?: string;
}) {
  const qc = useQueryClient();
  const existing = rows.find((r) => r.section === section);
  const [values, setValues] = useState<Record<string, string>>(() => (existing?.content as any) ?? {});
  const [imgPreview, setImgPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setValues((existing?.content as any) ?? {}); }, [existing?.id]);
  useEffect(() => {
    const p = imageField ? values[imageField] : "";
    if (p) signedUrl(p).then(setImgPreview); else setImgPreview("");
  }, [values, imageField]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.site(tenantId) });

  const save = useMutation({
    mutationFn: async () => persistSectionContent(tenantId, section, existing?.id ?? null, values),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !imageField) return;
    setUploading(true);
    try {
      const path = await uploadTenantFile(tenantId, section, f);
      const next = { ...values, [imageField]: path };
      setValues(next);
      await persistSectionContent(tenantId, section, existing?.id ?? null, next);
      toast.success("Photo updated"); invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  return (
    <Card className="p-5 space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}</Label>
          {f.multiline ? (
            <Textarea rows={f.rows ?? 3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : (
            <Input value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      {imageField && (
        <div className="space-y-2 pt-3 border-t">
          <Label>{imageLabel ?? "Photo"}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-24 w-24 rounded-md border overflow-hidden bg-muted grid place-items-center">
              {imgPreview ? <img src={imgPreview} alt="" className="h-full w-full object-cover" /> : <Upload className="size-6 text-muted-foreground" />}
            </div>
            <label className="text-xs cursor-pointer inline-flex items-center gap-1 px-3 py-2 rounded-md border hover:bg-muted">
              <Upload className="size-3" /> {uploading ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={onImage} />
            </label>
          </div>
        </div>
      )}
      <div><Button onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>Save</Button></div>
    </Card>
  );
}

/* Reusable hero-like editor with text fields + background image/video upload (auto-saved) */
function HeroLikeEditor({ tenantId, rows, section, textFields, bgLabel }: {
  tenantId: string; rows: any[]; section: string; textFields: Field[]; bgLabel: string;
}) {
  const qc = useQueryClient();
  const existing = rows.find((r) => r.section === section);
  const [values, setValues] = useState<Record<string, string>>(() => (existing?.content as any) ?? {});
  const [bgPreview, setBgPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setValues((existing?.content as any) ?? {}); }, [existing?.id]);
  useEffect(() => {
    const p = values.background_url;
    if (p) signedUrl(p).then(setBgPreview); else setBgPreview("");
  }, [values.background_url]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.site(tenantId) });

  const save = useMutation({
    mutationFn: async () => persistSectionContent(tenantId, section, existing?.id ?? null, values),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const path = await uploadTenantFile(tenantId, section, f);
      const isVideo = f.type.startsWith("video/");
      const next = { ...values, background_url: path, background_type: isVideo ? "video" : "image" };
      setValues(next);
      await persistSectionContent(tenantId, section, existing?.id ?? null, next);
      toast.success("Background updated"); invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  async function clearBg() {
    const next = { ...values, background_url: "", background_type: "" };
    setValues(next);
    try {
      await persistSectionContent(tenantId, section, existing?.id ?? null, next);
      toast.success("Background cleared"); invalidate();
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <Card className="p-5 space-y-4">
      {textFields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label>{f.label}</Label>
          {f.multiline
            ? <Textarea rows={f.rows ?? 3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            : <Input value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
        </div>
      ))}

      <div className="space-y-2 pt-3 border-t">
        <Label>{bgLabel}</Label>
        <p className="text-xs text-muted-foreground">Uploads save instantly. JPG/PNG/WebP up to ~5 MB, or short MP4.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-24 w-40 rounded-md border overflow-hidden bg-muted grid place-items-center">
            {bgPreview
              ? (values.background_type === "video"
                  ? <video src={bgPreview} muted className="h-full w-full object-cover" />
                  : <img src={bgPreview} alt="" className="h-full w-full object-cover" />)
              : <span className="text-xs text-muted-foreground">No background</span>}
          </div>
          <label className="text-xs cursor-pointer inline-flex items-center gap-1 px-3 py-2 rounded-md border hover:bg-muted">
            <Upload className="size-3" /> {uploading ? "Uploading…" : "Upload background"}
            <input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={onBgFile} />
          </label>
          {values.background_url && (
            <Button variant="ghost" size="sm" className="text-rose-600" onClick={clearBg}>Remove</Button>
          )}
        </div>
      </div>

      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>Save text</Button>
      </div>
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
      const next = { ...values, [imageField]: path };
      setValues(next);
      // Auto-persist immediately so the user doesn't need to click Save.
      const { error } = await supabase.from("site_content").update({ content: next }).eq("id", row.id);
      if (error) throw error;
      toast.success("Photo updated");
      onChange();
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
          Save text
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
