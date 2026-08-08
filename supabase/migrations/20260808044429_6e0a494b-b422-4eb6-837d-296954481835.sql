CREATE OR REPLACE FUNCTION public.resubmit_registration(
  _registration_id uuid,
  _name text,
  _phone text,
  _fee_plan_id uuid DEFAULT NULL,
  _batch_id uuid DEFAULT NULL,
  _dob date DEFAULT NULL,
  _guardian_name text DEFAULT NULL,
  _address text DEFAULT NULL,
  _gender text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Strict ownership: caller must be the exact applicant_user_id on the row. No NULL bypass.
  SELECT tenant_id INTO v_tenant_id
  FROM public.registrations
  WHERE id = _registration_id
    AND applicant_user_id = auth.uid()
    AND review_status = 'changes_requested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found or not in editable state.';
  END IF;

  IF _fee_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fee_plans WHERE id = _fee_plan_id AND tenant_id = v_tenant_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Invalid fee plan';
  END IF;

  IF _batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.batches WHERE id = _batch_id AND tenant_id = v_tenant_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Invalid batch';
  END IF;

  UPDATE public.registrations
  SET
    name = _name,
    phone = _phone,
    fee_plan_id = _fee_plan_id,
    batch_id = _batch_id,
    dob = _dob,
    guardian_name = _guardian_name,
    address = _address,
    gender = _gender,
    review_status = 'pending',
    review_notes = NULL,
    updated_at = now()
  WHERE id = _registration_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resubmit_registration(uuid, text, text, uuid, uuid, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_registration(uuid, text, text, uuid, uuid, date, text, text, text) TO service_role;