ALTER TABLE public.manual_payment_submissions
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_by uuid;