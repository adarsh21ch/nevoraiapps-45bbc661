ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS fee_plan_id uuid REFERENCES public.fee_plans(id) ON DELETE SET NULL;

-- Backfill: if every student in a session shares one fee plan, adopt it as the session default.
UPDATE public.batches b
SET fee_plan_id = sub.fee_plan_id
FROM (
  SELECT s.batch_id, MIN(s.fee_plan_id::text)::uuid AS fee_plan_id
  FROM public.students s
  WHERE s.batch_id IS NOT NULL AND s.fee_plan_id IS NOT NULL
  GROUP BY s.batch_id
  HAVING COUNT(DISTINCT s.fee_plan_id) = 1
) sub
WHERE b.id = sub.batch_id AND b.fee_plan_id IS NULL;