-- Phase 10.1: Feature usage RPC + subscription grace period

-- Grace period column for subscription expiry cron
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz;

-- Security-definer RPC letting a tenant member increment their own meter.
-- Uses on-conflict UPSERT so counter rows are created lazily.
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _tenant_id uuid,
  _feature_id text,
  _delta integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_member boolean;
BEGIN
  IF _delta = 0 THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id = _tenant_id
  ) OR public.is_platform_admin(auth.uid())
  INTO _is_member;

  IF NOT _is_member THEN
    RAISE EXCEPTION 'not a tenant member';
  END IF;

  INSERT INTO public.feature_usage (tenant_id, feature_id, period_start, count)
  VALUES (_tenant_id, _feature_id, date_trunc('month', now())::date, GREATEST(_delta, 0))
  ON CONFLICT (tenant_id, feature_id, period_start)
  DO UPDATE SET count = public.feature_usage.count + EXCLUDED.count,
                updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_feature_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(uuid, text, integer) TO authenticated;

-- Aggregated snapshot RPC for Founder Intelligence: plan distribution + MRR.
CREATE OR REPLACE FUNCTION public.subscription_platform_snapshot()
RETURNS TABLE(
  plan_tier text,
  tenant_count bigint,
  active_count bigint,
  trial_count bigint,
  suspended_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(t.plan_tier, 'starter') AS plan_tier,
    COUNT(*)::bigint AS tenant_count,
    COUNT(*) FILTER (WHERE t.subscription_status = 'paid')::bigint AS active_count,
    COUNT(*) FILTER (WHERE t.subscription_status = 'trial')::bigint AS trial_count,
    COUNT(*) FILTER (WHERE t.status = 'suspended')::bigint AS suspended_count
  FROM public.tenants t
  WHERE public.is_platform_admin(auth.uid())
  GROUP BY COALESCE(t.plan_tier, 'starter');
$$;

REVOKE ALL ON FUNCTION public.subscription_platform_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscription_platform_snapshot() TO authenticated;