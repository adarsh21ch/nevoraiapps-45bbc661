-- Hard reset: remove all custom_fee overrides for girls in tenants where gender pricing is enabled.
-- This forces the system to use the (plan.female_amount) which the user says is 700.
UPDATE public.students s
SET custom_fee = NULL
FROM public.tenants t, public.fee_plans fp
WHERE s.tenant_id = t.id
  AND s.fee_plan_id = fp.id
  AND t.gender_pricing_enabled = true
  AND (s.gender = 'female' OR s.gender = 'girl')
  AND fp.female_amount IS NOT NULL
  AND s.status = 'active';

-- Also ensure the public.has_role function handles the app_role enum correctly if it was causing issues
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;