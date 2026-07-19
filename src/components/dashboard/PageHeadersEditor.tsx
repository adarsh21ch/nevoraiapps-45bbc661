import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { uploadTenantFile, signedUrl } from "@/lib/storage";
import {
  PAGE_HERO_KEYS,
  MAX_HERO_IMAGES_PER_PAGE,
  type PageHeroKey,
} from "@/lib/page-hero-images";

type HeroMap = Partial<Record<PageHeroKey, string[]>>;

/**
 * Owner-facing editor for per-page hero background carousels + the Fees tab
 * visibility toggle. Reads and writes tenant.page_hero_images (jsonb) and
 * tenant.show_fees_tab (bool). Images are stored under the tenant-assets
 * bucket at "hero/<page>/<uuid>" so the anon-facing site can signedUrl them.
 */
export function PageHeadersEditor({
  tenantId,
  initial,
  initialShowFees,
}: {
  tenantId: string;
  initial: HeroMap | null | undefined;
  initialShowFees: boolean;
}) {
  const qc = useQueryClient();
  const [images, setImages] = useState<HeroMap>(() => normalize(initial));
  const [showFees, setShowFees] = useState<boolean>(initialShowFees);

  useEffect(() => {
    setImages(normalize(initial));
  }, [initial]);
  useEffect(() => {
    setShowFees(initialShowFees);
  }, [initialShowFees]);

  const persist = useMutation({
    mutationFn: async (next: { images: HeroMap; show_fees_tab: boolean }) => {
      const { error } = await supabase
        .from("tenants")
        .update({
          page_hero_images: next.images as any,
          show_fees_tab: next.show_fees_tab,
        } as any)
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Page headers saved");
      qc.invalidateQueries({ queryKey: ["dashboard-tenant", tenantId] });
      qc.invalidateQueries({ queryKey: ["current-tenant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAndPersist = (nextImages: HeroMap, nextShowFees: boolean) => {
    setImages(nextImages);
    setShowFees(nextShowFees);
    persist.mutate({ images: nextImages, show_fees_tab: nextShowFees });
  };

  async function handleUpload(key: PageHeroKey, files: FileList | null) {
    if (!files || files.length === 0) return;
    const existing = images[key] ?? [];
    const room = MAX_HERO_IMAGES_PER_PAGE - existing.length;
    if (room <= 0) {
      toast.error(`Max ${MAX_HERO_IMAGES_PER_PAGE} images per page`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    try {
      const uploaded: string[] = [];
      for (const f of list) {
        const path = await uploadTenantFile(tenantId, `hero/${key}`, f);
        uploaded.push(path);
      }
      const next = { ...images, [key]: [...existing, ...uploaded] };
      updateAndPersist(next, showFees);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    }
  }

  function removeAt(key: PageHeroKey, index: number) {
    const arr = images[key] ?? [];
    const next = { ...images, [key]: arr.filter((_, i) => i !== index) };
    updateAndPersist(next, showFees);
  }

  function move(key: PageHeroKey, from: number, to: number) {
    const arr = [...(images[key] ?? [])];
    if (to < 0 || to >= arr.length) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    updateAndPersist({ ...images, [key]: arr }, showFees);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-semibold">Show Fees tab on public website</Label>
            <p className="text-xs text-muted-foreground">
              When off, the "Fees" link is hidden from the public site's navigation. The internal
              billing module is unaffected.
            </p>
          </div>
          <Switch
            checked={showFees}
            onCheckedChange={(v) => updateAndPersist(images, v)}
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Page header backgrounds</div>
          <p className="text-xs text-muted-foreground">
            Upload up to {MAX_HERO_IMAGES_PER_PAGE} images for each page header. When 2 or more
            images are present, they auto-slide as a carousel behind the page title.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PAGE_HERO_KEYS.map(({ key, label }) => (
            <PageBucket
              key={key}
              label={label}
              paths={images[key] ?? []}
              onUpload={(fs) => handleUpload(key, fs)}
              onRemove={(i) => removeAt(key, i)}
              onMove={(from, to) => move(key, from, to)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function PageBucket({
  label,
  paths,
  onUpload,
  onRemove,
  onMove,
}: {
  label: string;
  paths: string[];
  onUpload: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-muted-foreground">
          {paths.length}/{MAX_HERO_IMAGES_PER_PAGE}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {paths.map((p, i) => (
          <Thumb
            key={`${p}-${i}`}
            path={p}
            onRemove={() => onRemove(i)}
            onLeft={() => onMove(i, i - 1)}
            onRight={() => onMove(i, i + 1)}
          />
        ))}
        {paths.length < MAX_HERO_IMAGES_PER_PAGE ? (
          <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-[11px] text-muted-foreground hover:border-primary hover:text-primary">
            <Upload className="size-4" />
            Add image
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function Thumb({
  path,
  onRemove,
  onLeft,
  onRight,
}: {
  path: string;
  onRemove: () => void;
  onLeft: () => void;
  onRight: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    signedUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return (
    <div className="group relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
      <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/60 via-transparent to-transparent p-1 opacity-0 transition group-hover:opacity-100">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onLeft}
            className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-black hover:bg-white"
            title="Move left"
          >
            <GripVertical className="inline size-3 rotate-90" />←
          </button>
          <button
            type="button"
            onClick={onRight}
            className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-black hover:bg-white"
            title="Move right"
          >
            →
          </button>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-6 px-2"
          onClick={onRemove}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function normalize(raw: unknown): HeroMap {
  if (!raw || typeof raw !== "object") return {};
  const out: HeroMap = {};
  for (const { key } of PAGE_HERO_KEYS) {
    const arr = (raw as any)[key];
    if (Array.isArray(arr)) {
      out[key] = arr.filter((s) => typeof s === "string" && s.length > 0);
    }
  }
  return out;
}
