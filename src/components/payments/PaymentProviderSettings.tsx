import { useMemo, useState } from "react";
import { Card } from "@/components/ds/Card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  usePaymentConfigs,
  useSavePaymentConfig,
  useTestPaymentConfig,
  webhookUrlFor,
} from "@/lib/payments/queries";
import { PROVIDER_CATALOG, type PaymentProviderId, type PaymentScope } from "@/lib/payments/types";
import { Copy, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Props = { scope: PaymentScope; tenantId: string | null; onlineEnabled?: boolean };

export function PaymentProviderSettings({ scope, tenantId }: Props) {
  const { data: configs, isLoading } = usePaymentConfigs(scope, tenantId);
  const save = useSavePaymentConfig(scope, tenantId);
  const test = useTestPaymentConfig(scope, tenantId);
  const [provider, setProvider] = useState<PaymentProviderId>("razorpay");
  const current = useMemo(() => configs?.find((c) => c.provider === provider), [configs, provider]);

  const [form, setForm] = useState({ key_id: "", key_secret: "", webhook_secret: "", test_mode: true, enabled: true });

  if (isLoading) return <Card className="p-6 text-sm text-neutral-500">Loading…</Card>;

  const webhookUrl = webhookUrlFor(scope, provider, tenantId);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label className="mb-2 block text-sm font-medium">Provider</label>
        <select
          className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900"
          value={provider}
          onChange={(e) => setProvider(e.target.value as PaymentProviderId)}
        >
          {PROVIDER_CATALOG.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.available}>
              {p.name} {p.available ? "" : "(coming soon)"}
            </option>
          ))}
        </select>
      </Card>

      {current ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Connection status</div>
            <StatusBadge status={current.last_test_status} enabled={current.enabled} hasSecret={current.has_secret} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs text-neutral-500">
            <div>
              <dt>Mode</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">{current.test_mode ? "Sandbox" : "Production"}</dd>
            </div>
            <div>
              <dt>Key ID</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">{current.key_id ?? "—"}</dd>
            </div>
            <div>
              <dt>Last tested</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">
                {current.last_tested_at ? new Date(current.last_tested_at).toLocaleString() : "Never"}
              </dd>
            </div>
            <div>
              <dt>Last webhook</dt>
              <dd className="text-neutral-900 dark:text-neutral-100">
                {current.last_webhook_at ? new Date(current.last_webhook_at).toLocaleString() : "None"}
              </dd>
            </div>
          </dl>
          {current.last_test_error && (
            <p className="mt-2 text-xs text-red-600">{current.last_test_error}</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={test.isPending || !current.has_secret}
              onClick={() =>
                test
                  .mutateAsync(current.id)
                  .then((h) =>
                    h.status === "ok" ? toast.success("Connection OK") : toast.error(h.detail ?? "Failed"),
                  )
              }
            >
              {test.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Test connection
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 text-sm font-medium">
          {current ? "Rotate / update credentials" : "Add credentials"}
        </div>
        <div className="space-y-3">
          <Field label="Key ID" value={form.key_id} onChange={(v) => setForm({ ...form, key_id: v })} placeholder="rzp_test_..." />
          <Field label="Key Secret" type="password" value={form.key_secret} onChange={(v) => setForm({ ...form, key_secret: v })} />
          <Field label="Webhook Secret" type="password" value={form.webhook_secret} onChange={(v) => setForm({ ...form, webhook_secret: v })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.test_mode} onChange={(e) => setForm({ ...form, test_mode: e.target.checked })} />
            Sandbox / test mode
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Enabled
          </label>
          <Button
            disabled={save.isPending || !form.key_id || !form.key_secret}
            onClick={() =>
              save
                .mutateAsync({
                  scope,
                  tenantId,
                  provider,
                  enabled: form.enabled,
                  test_mode: form.test_mode,
                  key_id: form.key_id,
                  key_secret: form.key_secret,
                  webhook_secret: form.webhook_secret || null,
                })
                .then(() => {
                  toast.success("Saved");
                  setForm({ ...form, key_secret: "", webhook_secret: "" });
                })
                .catch((e) => toast.error(e.message))
            }
          >
            {save.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Save credentials
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 text-sm font-medium">Webhook URL</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{webhookUrl}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("Copied");
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Paste this URL into your provider dashboard's webhook settings. Signature verification is enforced
          server-side.
        </p>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-neutral-600 dark:text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm dark:bg-neutral-900"
      />
    </label>
  );
}

function StatusBadge({
  status,
  enabled,
  hasSecret,
}: {
  status: "ok" | "failed" | null;
  enabled: boolean;
  hasSecret: boolean;
}) {
  if (!hasSecret) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Missing keys
      </span>
    );
  }
  if (status === "ok" && enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
        <AlertTriangle className="h-3 w-3" /> Test failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      Not tested
    </span>
  );
}
