
-- 1) Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant_coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
