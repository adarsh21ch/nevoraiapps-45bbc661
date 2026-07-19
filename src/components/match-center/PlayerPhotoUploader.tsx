import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Avatar } from "@/components/match-center/athlete-ui";
import { uploadTenantFile } from "@/lib/storage";
import { updatePlayerPhoto } from "@/lib/players.functions";
import { cn } from "@/lib/utils";

/**
 * Avatar + camera button. Uploads to tenant-assets/players/ then updates
 * students.photo_url via server fn (auth-scoped: staff or self only).
 */
export function PlayerPhotoUploader({
  tenantId,
  studentId,
  photoUrl,
  name,
  size = 96,
  onUpdated,
  disabled = false,
}: {
  tenantId: string;
  studentId: string;
  photoUrl: string | null;
  name: string;
  size?: number;
  onUpdated?: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(photoUrl);
  const update = useServerFn(updatePlayerPhoto);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8 MB)");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadTenantFile(tenantId, "players", file);
      await update({ data: { studentId, photoUrl: path } });
      setLocalUrl(path);
      onUpdated?.(path);
      toast.success("Photo updated");
    } catch (e) {
      console.error(e);
      toast.error((e as Error)?.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("relative inline-block", disabled && "pointer-events-none opacity-70")}>
      <Avatar src={localUrl} name={name} size={size} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || disabled}
        aria-label="Change photo"
        className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-background shadow-sm transition hover:bg-accent disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
