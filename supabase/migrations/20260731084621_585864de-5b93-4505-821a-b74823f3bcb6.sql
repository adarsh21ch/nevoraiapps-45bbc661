DO $$
DECLARE v_id uuid; v_row public.payments%ROWTYPE;
BEGIN
  INSERT INTO public.billing_payments (tenant_id, student_id, amount, method, status, remarks, idempotency_key)
  SELECT tenant_id, student_id, 11, 'upi', 'succeeded', '[period:2026-07] mirror smoke test', 'smoke:' || gen_random_uuid()::text
  FROM public.billing_payments LIMIT 1
  RETURNING id INTO v_id;

  SELECT * INTO v_row FROM public.payments WHERE billing_payment_id = v_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'mirror trigger did not insert'; END IF;
  IF v_row.period <> '2026-07' OR v_row.amount <> 11 OR v_row.note <> 'mirror smoke test' THEN
    RAISE EXCEPTION 'mirror mapping wrong: period=% amount=% note=%', v_row.period, v_row.amount, v_row.note;
  END IF;

  UPDATE public.billing_payments SET status = 'refunded' WHERE id = v_id;
  IF EXISTS (SELECT 1 FROM public.payments WHERE billing_payment_id = v_id) THEN
    RAISE EXCEPTION 'refund did not remove mirrored row';
  END IF;

  DELETE FROM public.billing_payments WHERE id = v_id;
  RAISE NOTICE 'mirror bridge verified';
END $$;