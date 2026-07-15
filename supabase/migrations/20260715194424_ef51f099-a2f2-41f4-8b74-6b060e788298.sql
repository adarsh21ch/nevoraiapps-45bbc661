
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.payment_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  key_id text,
  key_secret_ciphertext text,
  webhook_secret_ciphertext text,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_error text,
  last_webhook_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_configs_scope_shape CHECK (
    (scope = 'platform' AND tenant_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX pp_platform_unique_provider ON public.payment_provider_configs (provider) WHERE scope='platform';
CREATE UNIQUE INDEX pp_tenant_unique_provider ON public.payment_provider_configs (tenant_id, provider) WHERE scope='tenant';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_provider_configs TO authenticated;
GRANT ALL ON public.payment_provider_configs TO service_role;
ALTER TABLE public.payment_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage platform payment configs" ON public.payment_provider_configs FOR ALL TO authenticated
  USING (scope='platform' AND public.is_platform_admin(auth.uid()))
  WITH CHECK (scope='platform' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant owners manage own payment configs" ON public.payment_provider_configs FOR ALL TO authenticated
  USING (scope='tenant' AND tenant_id IS NOT NULL AND public.is_tenant_owner(tenant_id, auth.uid()))
  WITH CHECK (scope='tenant' AND tenant_id IS NOT NULL AND public.is_tenant_owner(tenant_id, auth.uid()));
CREATE TRIGGER trg_ppc_updated BEFORE UPDATE ON public.payment_provider_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','tenant')),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_order_id text,
  provider_payment_id text,
  amount_paise bigint NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',
  purpose text NOT NULL,
  ref_type text,
  ref_id uuid,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_tx_idem ON public.payment_transactions (provider, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX payment_tx_tenant ON public.payment_transactions (tenant_id, created_at DESC);
CREATE INDEX payment_tx_provider_pid ON public.payment_transactions (provider, provider_payment_id);
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read own payment transactions" ON public.payment_transactions FOR SELECT TO authenticated
  USING (
    (scope='tenant' AND tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
    OR (scope='platform' AND public.is_platform_admin(auth.uid()))
  );
CREATE TRIGGER trg_ptx_updated BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  signature text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_webhooks_dedupe ON public.payment_webhooks (provider, event_id);
GRANT ALL ON public.payment_webhooks TO service_role;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS payment_instructions text;
