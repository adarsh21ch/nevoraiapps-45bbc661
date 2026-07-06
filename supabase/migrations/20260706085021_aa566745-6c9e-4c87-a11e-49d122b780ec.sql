
CREATE OR REPLACE FUNCTION public.submit_registration(
  _tenant_id uuid,
  _name text,
  _phone text,
  _fee_plan_id uuid,
  _batch_id uuid DEFAULT NULL,
  _dob date DEFAULT NULL,
  _guardian_name text DEFAULT NULL,
  _guardian_phone text DEFAULT NULL,
  _whatsapp text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF _name IS NULL OR btrim(_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF _phone IS NULL OR btrim(_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF _fee_plan_id IS NULL THEN RAISE EXCEPTION 'Fee plan is required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND status = 'active') THEN
    RAISE EXCEPTION 'Academy not accepting registrations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fee_plans WHERE id = _fee_plan_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid fee plan';
  END IF;
  IF _batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.batches WHERE id = _batch_id AND tenant_id = _tenant_id AND active = true) THEN
    RAISE EXCEPTION 'Invalid batch';
  END IF;

  INSERT INTO public.registrations (
    tenant_id, name, phone, whatsapp, guardian_name, guardian_phone,
    dob, batch_id, fee_plan_id, status, payment_status
  ) VALUES (
    _tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_whatsapp),''),
    NULLIF(btrim(_guardian_name),''), NULLIF(btrim(_guardian_phone),''),
    _dob, _batch_id, _fee_plan_id, 'new', 'pending'
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_payment_ref(
  _registration_id uuid,
  _payment_ref text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _payment_ref IS NULL OR btrim(_payment_ref) = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;
  UPDATE public.registrations
     SET payment_ref = btrim(_payment_ref)
   WHERE id = _registration_id
     AND status = 'new';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found or already processed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_registration(uuid, text, text, uuid, uuid, date, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_registration(uuid, text, text, uuid, uuid, date, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.attach_payment_ref(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_payment_ref(uuid, text) TO anon, authenticated;
