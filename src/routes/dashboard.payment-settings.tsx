import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { PaymentProviderSettings } from "@/components/payments/PaymentProviderSettings";
import { OfflinePaymentSettings } from "@/components/payments/OfflinePaymentSettings";
import { Card } from "@/components/ds/Card";

export const Route = createFileRoute("/dashboard/payment-settings")({
  head: () => ({ meta: [{ title: "Payment Settings · AcademyOS" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const { tenant } = useDashboard();
  const [online, setOnline] = useState(tenant?.online_payments_enabled ?? false);
  const tenantId = tenant?.id ?? null;

  const heading = useMemo(
    () => (
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Payment Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure how parents pay fees to your academy. Use your own payment gateway keys — they never leave your
          academy.
        </p>
      </header>
    ),
    [],
  );

  if (!tenantId) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {heading}

      <Card className="mb-4 p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={online}
            onChange={(e) => setOnline(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">Accept online payments (Razorpay / etc.)</span>
        </label>
        <p className="mt-2 text-xs text-neutral-500">
          When off, parents see your UPI / QR / bank transfer details instead of an online checkout.
        </p>
      </Card>

      {online ? (
        <PaymentProviderSettings scope="tenant" tenantId={tenantId} onlineEnabled />
      ) : (
        <OfflinePaymentSettings tenantId={tenantId} />
      )}
    </div>
  );
}
