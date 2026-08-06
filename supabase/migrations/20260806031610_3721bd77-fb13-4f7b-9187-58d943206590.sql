UPDATE public.students
SET custom_fee = NULL
WHERE gender = 'female'
  AND status = 'active'
  AND tenant_id IN (SELECT id FROM public.tenants WHERE gender_pricing_enabled = true);