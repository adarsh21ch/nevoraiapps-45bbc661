/**
 * Student self-service profile editor.
 *
 * Players fill in whatever the academy left blank (contacts, address, medical,
 * playing style). Academy-owned fields — session, fee plan, status, player ID —
 * are deliberately not editable here; only the owner can change those.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Loader2, Upload, FileCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { uploadTenantFile, signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

type S = Record<string, string | null | undefined>;

const FIELDS: Array<{ key: string; label: string; type?: string; long?: boolean }> = [
  { key: "phone", label: "Mobile", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "dob", label: "Date of birth", type: "date" },
  { key: "gender", label: "Gender" },
  { key: "guardian_name", label: "Parent / guardian name" },
  { key: "guardian_phone", label: "Parent / guardian mobile", type: "tel" },
  { key: "emergency_contact_name", label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact mobile", type: "tel" },
  { key: "address", label: "Address", long: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
  { key: "school_college", label: "School / college" },
  { key: "blood_group", label: "Blood group" },
  { key: "playing_role", label: "Playing role" },
  { key: "batting_style", label: "Batting style" },
  { key: "bowling_style", label: "Bowling style" },
  { key: "medical_notes", label: "Medical notes", long: true },
];

export function EditMyProfileDialog({ student, onSaved }: { student: S; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const start = (v: boolean) => {
    if (v) {
      const init: Record<string, string> = {};
      for (const f of FIELDS) init[f.key] = (student[f.key] as string | null) ?? "";
      setForm(init);
    }
    setOpen(v);
  };

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string> = {};
      for (const f of FIELDS) {
        const v = (form[f.key] ?? "").trim();
        if (v && v !== ((student[f.key] as string | null) ?? "")) patch[f.key] = v;
      }
      if (Object.keys(patch).length === 0) return "unchanged";
      const { error } = await supabase.rpc("update_my_student_profile", { _patch: patch as never });
      if (error) throw error;
      return "saved";
    },
    onSuccess: (r) => {
      toast.success(r === "saved" ? "Profile updated" : "Nothing to update");
      onSaved();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (key: string, file: File) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const tenantId = (student as any).tenant_id || (window as any).__TENANT_ID__;
      const path = await uploadTenantFile(tenantId, "id_proofs", file);
      setForm((prev) => ({ ...prev, [key]: path }));
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={start}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <Pencil className="size-3.5 mr-1.5" /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit my details</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Session, fee plan and player ID are managed by the academy.
        </p>
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              {f.type === "file" ? (
                <DocumentUploadField
                  label={f.label}
                  value={form[f.key]}
                  uploading={uploading[f.key]}
                  onFile={(file) => handleUpload(f.key, file)}
                />
              ) : f.long ? (
                <Textarea
                  rows={2}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  type={f.type ?? "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            className="w-full rounded-xl h-11"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentUploadField({
  label,
  value,
  uploading,
  onFile,
}: {
  label: string;
  value?: string;
  uploading?: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer",
        value ? "border-emerald-500/50 bg-emerald-50/30" : "border-border bg-muted/20 hover:bg-muted/40",
      )}
    >
      <input
        type="file"
        className="hidden"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : value ? (
        <FileCheck className="h-6 w-6 text-emerald-600" />
      ) : (
        <Upload className="h-6 w-6 text-muted-foreground" />
      )}
      <span className={cn("text-[10px] font-medium", value ? "text-emerald-700" : "text-muted-foreground")}>
        {uploading ? "Uploading..." : value ? "Photo selected" : "Tap to upload"}
      </span>
    </label>
  );
}
