-- Add gender-specific fee columns to fee_plans
ALTER TABLE public.fee_plans 
ADD COLUMN IF NOT EXISTS female_amount numeric;

-- Also add a toggle to tenants to enable/disable gender-based pricing globally
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS gender_pricing_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.fee_plans.female_amount IS 'Optional override fee for female students';
COMMENT ON COLUMN public.tenants.gender_pricing_enabled IS 'If true, sessions show separate pricing for girls';
