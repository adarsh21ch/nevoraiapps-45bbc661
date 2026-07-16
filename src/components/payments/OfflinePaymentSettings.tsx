import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ds/Card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, X, ImagePlus } from "lucide-react";
import { useSaveOfflinePaymentSettings } from "@/lib/payments/queries";
import { useDashboard } from "@/lib/dashboard-context";
import { uploadTenantFile, signedUrl } from "@/lib/storage";

export function OfflinePaymentSettings({ tenantId }: { tenantId: string }) {
  const { tenant } = useDashboard();
  const save = useSaveOfflinePaymentSettings();
  const [form, setForm] = useState({
    upi_id: tenant?.upi_id ?? "",
    upi_qr_url: tenant?.upi_qr_url ?? "",
    bank_account_name: (tenant as any)?.bank_account_name ?? "",
    bank_account_number: (tenant as any)?.bank_account_number ?? "",
    bank_ifsc: (tenant as any)?.bank_ifsc ?? "",
    payment_instructions: (tenant as any)?.payment_instructions ?? "",
  });
  const [qrPreview, setQrPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const v = form.upi_qr_url;
    if (!v) {
      setQrPreview("");
      return;
    }
    if (v.startsWith("http") || v.startsWith("data:")) {
      setQrPreview(v);
      return;
    }
    signedUrl(v).then((u) => {
      if (!cancelled) setQrPreview(u);
    });
    return () => {
      cancelled = true;
    };
  }, [form.upi_qr_url]);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadTenantFile(tenantId, "upi_qr_url", file);
      setForm((f) => ({ ...f, upi_qr_url: path }));
      toast.success("QR uploaded — remember to Save");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">Offline payment details shown to parents</div>
      <div className="space-y-3">
        <Field
          label="UPI ID"
          value={form.upi_id}
          onChange={(v) => setForm({ ...form, upi_id: v })}
          placeholder="academy@upi"
        />

        <div className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-400">UPI QR image</span>
          <div className="flex items-start gap-3">
            {qrPreview ? (
              <div className="relative">
                <img
                  src={qrPreview}
                  alt="UPI QR"
                  className="size-24 rounded border object-cover bg-white"
                />
                <button
                  type="button"
                  aria-label="Remove QR"
                  onClick={() => setForm({ ...form, upi_qr_url: "" })}
                  className="absolute -top-2 -right-2 rounded-full bg-neutral-900 text-white p-0.5 shadow"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="size-24 rounded border border-dashed flex items-center justify-center text-neutral-400">
                <ImagePlus className="size-6" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <label
                className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50 ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Upload className="size-3" />
                )}
                {qrPreview ? "Replace QR image" : "Upload QR image"}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                  }}
                />
              </label>
              <p className="text-[11px] text-neutral-500">
                PNG or JPG screenshot of your UPI QR. Parents will scan this to pay.
              </p>
            </div>
          </div>
        </div>

        <Field
          label="Bank account name"
          value={form.bank_account_name}
          onChange={(v) => setForm({ ...form, bank_account_name: v })}
        />
        <Field
          label="Bank account number"
          value={form.bank_account_number}
          onChange={(v) => setForm({ ...form, bank_account_number: v })}
        />
        <Field
          label="IFSC"
          value={form.bank_ifsc}
          onChange={(v) => setForm({ ...form, bank_ifsc: v })}
        />
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-400">
            Payment instructions
          </span>
          <textarea
            rows={3}
            className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900"
            value={form.payment_instructions}
            onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
          />
        </label>
        <Button
          disabled={save.isPending || uploading}
          onClick={() =>
            save
              .mutateAsync({ tenantId, online_payments_enabled: false, ...form })
              .then(() => toast.success("Saved"))
              .catch((e) => toast.error(e.message))
          }
        >
          {save.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Save
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600 dark:text-neutral-400">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900"
      />
    </label>
  );
}
