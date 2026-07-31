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
    SELECT amount INTO fee_amount FROM public.fee_plans WHERE id = r.fee_plan_id;
    IF fee_amount IS NOT NULL THEN
      -- Canonical write: Billing V2. The mirror trigger keeps the legacy
      -- read model (public.payments) in sync for existing reports.
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
         reviewed_by = auth.uid()
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