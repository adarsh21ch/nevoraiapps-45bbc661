import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { uploadTenantFile, signedUrl } from "@/lib/storage";
import { fetchSiteContent, qk } from "@/lib/dashboard-queries";

type Field = { key: string; label: string; multiline?: boolean; rows?: number; placeholder?: string };

export function SiteContentTabs({ tenantId }: { tenantId: string }) {
  const content = useQuery({ queryKey: qk.site(tenantId), queryFn: () => fetchSiteContent(tenantId) });
  const rows = content.data ?? [];

  return (
    <Tabs defaultValue="hero">
      <TabsList className="w-full flex-wrap h-auto">
        <TabsTrigger value="hero">Hero</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
        <TabsTrigger value="founder">Founder</TabsTrigger>
        <TabsTrigger value="coaches">Coaches</TabsTrigger>
        <TabsTrigger value="programs">Programs</TabsTrigger>
        <TabsTrigger value="facilities">Facilities</TabsTrigger>
        <TabsTrigger value="spotlight">Spotlight</TabsTrigger>
        <TabsTrigger value="stars">Star players</TabsTrigger>
        <TabsTrigger value="gallery">Gallery</TabsTrigger>
        <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="cta">CTA banner</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
      </TabsList>

      <TabsContent value="hero" className="pt-4">
        <HeroLikeEditor tenantId={tenantId} rows={rows} section="hero"
          textFields={[
            { key: "headline", label: "Headline" },
            { key: "subheadline", label: "Subheadline", multiline: true, rows: 3 },
            { key: "cta_label", label: "Call-to-action label", placeholder: "Register Now" },
          ]}
          bgLabel="Hero background (image or short video)" />
      </TabsContent>
      <TabsContent value="about" className="pt-4">
        <SingleSectionEditor tenantId={tenantId} rows={rows} section="about"
          fields={[
            { key: "heading", label: "Heading" },
            { key: "body", label: "Body", multiline: true, rows: 6 },
          ]} />
      </TabsContent>
      <TabsContent value="founder" className="pt-4">
        <SingleSectionEditor tenantId={tenantId} rows={rows} section="founder"
          fields={[
            { key: "name", label: "Founder name" },
            { key: "title", label: "Title (e.g. Director & Chief Coach)" },
            { key: "credentials", label: "Credentials" },
            { key: "bio", label: "Bio / Story", multiline: true, rows: 8 },
          ]}
          imageField="photo_url" imageLabel="Founder photo" />
      </TabsContent>
      <TabsContent value="coaches" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="coaches"
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "bio", label: "Short bio", multiline: true, rows: 2 },
          ]} imageField="photo_url" />
      </TabsContent>
      <TabsContent value="programs" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="programs"
          fields={[
            { key: "title", label: "Program title" },
            { key: "age_group", label: "Age group (optional)", placeholder: "U-12, U-16, Adults…" },
            { key: "description", label: "Description", multiline: true, rows: 3 },
          ]} />
      </TabsContent>
      <TabsContent value="facilities" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="facilities"
          fields={[
            { key: "title", label: "Facility name" },
            { key: "description", label: "Description", multiline: true, rows: 3 },
          ]} imageField="image_url" />
      </TabsContent>
      <TabsContent value="spotlight" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="spotlight"
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role / Title" },
            { key: "bio", label: "Bio / Achievements", multiline: true, rows: 5 },
          ]} imageField="photo_url" />
      </TabsContent>
      <TabsContent value="stars" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="star_players"
          fields={[
            { key: "name", label: "Name" },
            { key: "achievement", label: "Achievement" },
          ]} imageField="photo_url" />
      </TabsContent>
      <TabsContent value="gallery" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="gallery"
          fields={[{ key: "caption", label: "Caption (optional)" }]} imageField="url" />
      </TabsContent>
      <TabsContent value="testimonials" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="testimonials"
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role (e.g. Parent, Student)" },
            { key: "quote", label: "Quote", multiline: true, rows: 4 },
          ]} />
      </TabsContent>
      <TabsContent value="faq" className="pt-4">
        <MultiSectionEditor tenantId={tenantId} rows={rows} section="faq"
          fields={[
            { key: "question", label: "Question" },
            { key: "answer", label: "Answer", multiline: true, rows: 4 },
          ]} />
      </TabsContent>
      <TabsContent value="cta" className="pt-4">
        <HeroLikeEditor tenantId={tenantId} rows={rows} section="cta"
          textFields={[
            { key: "headline", label: "Headline (optional)" },
            { key: "subheadline", label: "Message", multiline: true, rows: 3 },
          ]}
          bgLabel="CTA banner background (image or short video)" />
      </TabsContent>
      <TabsContent value="map" className="pt-4">
        <SingleSectionEditor tenantId={tenantId} rows={rows} section="map"
          fields={[
            { key: "embed_url", label: "Google Maps embed URL", placeholder: "https://www.google.com/maps/embed?pb=…" },
            { key: "directions_url", label: "Directions link (optional)" },
          ]} />
      </TabsContent>
      <TabsContent value="pricing" className="pt-4">
        <PricingVisibilityEditor tenantId={tenantId} rows={rows} />
      </TabsContent>
    </Tabs>
  );
}

function PricingVisibilityEditor({ tenantId, rows }: { tenantId: string; rows: any[] }) {
  const qc = useQueryClient();
  const existing = rows.find((r) => r.section === "pricing");
  const initial = (existing?.content as any)?.visible === "true";
  const [visible, setVisible] = useState<boolean>(initial);
  useEffect(() => { setVisible((existing?.content as any)?.visible === "true"); }, [existing?.id]);
  const save = useMutation({
    mutationFn: async () =>
      persistSectionContent(tenantId, "pricing", existing?.id ?? null, { visible: visible ? "true" : "false" }),
    onSuccess: () => {
      toast.success(visible ? "Pricing section is now visible" : "Pricing section hidden");
      qc.invalidateQueries({ queryKey: qk.site(tenantId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-5 space-y-4">
      <div>
        <div className="font-semibold">Show monthly pricing on the landing page</div>
        <p className="text-sm text-muted-foreground mt-1">
          When off, the "Simple pricing" section is completely hidden from the public site. Fee plans still work inside the dashboard and on the private fees page.
        </p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <span className="relative inline-block h-6 w-11">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          <span className="absolute inset-0 rounded-full bg-muted peer-checked:bg-emerald-500 transition-colors" />
          <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
        <span className="text-sm font-medium">
          {visible ? "Visible on landing page" : "Hidden from landing page"}
        </span>
      </label>
      <div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "var(--brand)", color: "white" }}>
          Save
        </Button>
      </div>
    </Card>
  );
}

async function persistSectionContent(tenantId: string, section: string, existingId: string | null, content: Record<string, unknown>) {
  if (existingId) {
    const { error } = await supabase.from("site_content").update({ content: content as any }).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await supabase.from("site_content")
    .insert({ tenant_id: tenantId, section, content: content as any, sort_order: 0 })
    .select("id").single();
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
          {f.multiline
            ? <Textarea rows={f.rows ?? 3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            : <Input value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
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
        <p className="text-xs text-muted-foreground">Uploads save instantly. JPG/PNG/WebP up to ~5 MB, or short MP4/WebM.</p>
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
    onSuccess: () => invalidate(),
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
      const { error } = await supabase.from("site_content").update({ content: next }).eq("id", row.id);
      if (error) throw error;
      toast.success("Photo updated"); onChange();
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
