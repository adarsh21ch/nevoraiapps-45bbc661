-- Migration to standardize gender data and fix fee resolution in the database

-- 1. Create a function to normalize gender in the DB
CREATE OR REPLACE FUNCTION public.normalize_gender_db(g text)
RETURNS text AS $$
BEGIN
  IF g IS NULL THEN RETURN NULL; END IF;
  IF lower(trim(g)) IN ('female', 'girl') THEN RETURN 'female'; END IF;
  IF lower(trim(g)) IN ('male', 'boy') THEN RETURN 'male'; END IF;
  RETURN lower(trim(g));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Create a function to resolve the monthly fee for a student
CREATE OR REPLACE FUNCTION public.resolve_student_monthly_fee(
  p_fee_plan_id uuid,
  p_gender text,
  p_tenant_id uuid
)
RETURNS numeric AS $$
DECLARE
  v_amount numeric;
  v_female_amount numeric;
  v_gender_pricing_enabled boolean;
BEGIN
  -- Check if gender pricing is enabled for the tenant
  SELECT gender_pricing_enabled INTO v_gender_pricing_enabled 
  FROM public.tenants WHERE id = p_tenant_id;

  SELECT amount, female_amount INTO v_amount, v_female_amount
  FROM public.fee_plans WHERE id = p_fee_plan_id;

  IF v_gender_pricing_enabled AND public.normalize_gender_db(p_gender) = 'female' AND v_female_amount IS NOT NULL THEN
    RETURN v_female_amount;
  END IF;

  RETURN COALESCE(v_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Update registrations submission to normalize gender
UPDATE public.registrations SET gender = public.normalize_gender_db(gender) WHERE gender IS NOT NULL;
UPDATE public.students SET gender = public.normalize_gender_db(gender) WHERE gender IS NOT NULL;

-- 4. Fix approve_registration to use gender-specific pricing when recording verification payment
CREATE OR REPLACE FUNCTION public.approve_registration(_registration_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.registrations%ROWTYPE;
  new_student_id uuid;
  fee_amount numeric;
  linked_lead uuid;
BEGIN
  SELECT * INTO r FROM public.registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF NOT (public.is_tenant_member(auth.uid(), r.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF r.status = 'approved' THEN RAISE EXCEPTION 'Registration already approved'; END IF;

  -- Ensure gender is normalized before inserting student
  r.gender := public.normalize_gender_db(r.gender);

  INSERT INTO public.students (
    tenant_id, name, phone, dob, gender, guardian_name, guardian_phone,
    batch_id, fee_plan_id, status, user_id, email
  )
  VALUES (
    r.tenant_id, r.name, r.phone, r.dob, r.gender, r.guardian_name, r.guardian_phone,
    r.batch_id, r.fee_plan_id, 'active', r.applicant_user_id, r.email
  )
  RETURNING id INTO new_student_id;

  IF r.applicant_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (r.applicant_user_id, r.tenant_id, 'student')
    ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  END IF;

  IF r.fee_plan_id IS NOT NULL AND r.payment_status = 'verified' THEN
    -- Use the centralized fee resolution function
    fee_amount := public.resolve_student_monthly_fee(r.fee_plan_id, r.gender, r.tenant_id);

    IF fee_amount IS NOT NULL THEN
      INSERT INTO public.billing_payments (
        tenant_id, student_id, amount, method, status, collected_at,
        collected_by, created_by, remarks, idempotency_key
      )
      VALUES (
        r.tenant_id, new_student_id, fee_amount,
        COALESCE(NULLIF(r.payment_ref, ''), 'upi'), 'succeeded', now(),
        auth.uid(), auth.uid(),
        '[period:' || to_char(now(), 'YYYY-MM') || '] registration — auto-recorded on approval of registration ' || r.id::text,
        'registration:' || r.id::text
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE public.registrations
     SET status = 'approved',
         review_status = 'approved',
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         gender = r.gender -- Store normalized back to registration
   WHERE id = _registration_id;

  SELECT id INTO linked_lead FROM public.leads
   WHERE tenant_id = r.tenant_id AND converted_registration_id = r.id
   LIMIT 1;

  IF linked_lead IS NOT NULL THEN
    UPDATE public.leads
       SET pipeline_stage = 'converted',
           converted_student_id = new_student_id,
           status = 'won'
     WHERE id = linked_lead;
  END IF;

  INSERT INTO public.admission_timeline
    (tenant_id, lead_id, registration_id, student_id, event_type, to_stage, remark, actor_id)
  VALUES
    (r.tenant_id, linked_lead, r.id, new_student_id, 'student_created', 'converted',
     'Registration approved and student created', auth.uid());

  RETURN new_student_id;
END; $function$;
