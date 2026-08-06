-- Fix incorrect subscription amounts for female students
-- We only target subscriptions where the amount equals the plan's boy_fee 
-- and a girl_fee is available, ensuring we don't overwrite manual overrides.

WITH incorrect_subs AS (
  SELECT sub.id, p.female_amount
  FROM public.billing_subscriptions sub
  JOIN public.students s ON sub.student_id = s.id
  JOIN public.fee_plans p ON sub.fee_plan_id = p.id
  JOIN public.tenants t ON s.tenant_id = t.id
  WHERE t.gender_pricing_enabled = true
  AND public.normalize_gender_db(s.gender) = 'female'
  AND p.female_amount IS NOT NULL
  AND sub.unit_amount = p.amount
)
UPDATE public.billing_subscriptions
SET unit_amount = incorrect_subs.female_amount,
    updated_at = now()
FROM incorrect_subs
WHERE public.billing_subscriptions.id = incorrect_subs.id;

-- Also fix any draft invoices that inherited the wrong amount
WITH incorrect_lines AS (
  SELECT li.id, p.female_amount
  FROM public.billing_invoice_lines li
  JOIN public.billing_invoices inv ON li.invoice_id = inv.id
  JOIN public.billing_subscriptions sub ON inv.subscription_id = sub.id
  JOIN public.students s ON inv.student_id = s.id
  JOIN public.fee_plans p ON sub.fee_plan_id = p.id
  JOIN public.tenants t ON inv.tenant_id = t.id
  WHERE t.gender_pricing_enabled = true
  AND public.normalize_gender_db(s.gender) = 'female'
  AND p.female_amount IS NOT NULL
  AND inv.status = 'draft'
  AND li.line_type = 'charge'
  AND li.unit_amount = p.amount
)
UPDATE public.billing_invoice_lines
SET unit_amount = incorrect_lines.female_amount,
    amount = (quantity * incorrect_lines.female_amount)
FROM incorrect_lines
WHERE public.billing_invoice_lines.id = incorrect_lines.id;
