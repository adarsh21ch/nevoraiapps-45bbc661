import { useState } from "react";
import { Card } from "@/components/ds/Card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSaveOfflinePaymentSettings } from "@/lib/payments/queries";
import { useDashboard } from "@/lib/dashboard-context";

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

  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium">Offline payment details shown to parents</div>
      <div className="space-y-3">
        <Field label="UPI ID" value={form.upi_id} onChange={(v) => setForm({ ...form, upi_id: v })} placeholder="academy@upi" />
        <Field label="UPI QR image URL" value={form.upi_qr_url} onChange={(v) => setForm({ ...form, upi_qr_url: v })} />
        <Field label="Bank account name" value={form.bank_account_name} onChange={(v) => setForm({ ...form, bank_account_name: v })} />
        <Field label="Bank account number" value={form.bank_account_number} onChange={(v) => setForm({ ...form, bank_account_number: v })} />
        <Field label="IFSC" value={form.bank_ifsc} onChange={(v) => setForm({ ...form, bank_ifsc: v })} />
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-400">Payment instructions</span>
          <textarea
            rows={3}
            className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900"
            value={form.payment_instructions}
            onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
          />
        </label>
        <Button
          disabled={save.isPending}
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
