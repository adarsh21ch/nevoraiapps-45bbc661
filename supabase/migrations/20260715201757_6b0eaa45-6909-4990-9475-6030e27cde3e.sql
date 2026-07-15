
-- Phase 10: SaaS subscription + feature flag runtime
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_limits jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_tier_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_tier_check CHECK (plan_tier IN ('starter','professional','enterprise'));

CREATE TABLE IF NOT EXISTS public.feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_id text NOT NULL,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  count integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_id, period_start)
);

GRANT SELECT ON public.feature_usage TO authenticated;
GRANT ALL ON public.feature_usage TO service_role;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_usage tenant members read" ON public.feature_usage;
CREATE POLICY "feature_usage tenant members read" ON public.feature_usage
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "feature_usage platform admin write" ON public.feature_usage;
CREATE POLICY "feature_usage platform admin write" ON public.feature_usage
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS feature_usage_tenant_period_idx
  ON public.feature_usage (tenant_id, period_start DESC);
