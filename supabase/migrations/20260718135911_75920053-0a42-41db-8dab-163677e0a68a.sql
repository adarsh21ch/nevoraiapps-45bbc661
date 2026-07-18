-- Phase 22: authoritative post-login routing RPC + approve_registration role grant + backfill

CREATE OR REPLACE FUNCTION public.my_post_login_route()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN 'none'; END IF;

  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = uid) THEN
    RETURN 'platform_admin';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = uid
       AND role IN ('owner','admin','coach','head_coach','assistant_coach','staff')
  ) THEN
    RETURN 'staff';
  END IF;

  IF EXISTS (SELECT 1 FROM public.mc_parent_links WHERE user_id = uid) THEN
    RETURN 'parent';
  END IF;

  IF EXISTS (SELECT 1 FROM public.students WHERE user_id = uid) THEN
    RETURN 'student';
  END IF;

  IF EXISTS (SELECT 1 FROM public.registrations WHERE applicant_user_id = uid) THEN
    RETURN 'student';
  END IF;

  RETURN 'none';
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_post_login_route() TO authenticated;

-- Update approve_registration to also insert user_roles(role='student') so
-- routing resolves 'staff'/'student' cleanly. Idempotent via ON CONFLICT.
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
      INSERT INTO public.payments (tenant_id, student_id, amount, type, method, note, recorded_by)
      VALUES (r.tenant_id, new_student_id, fee_amount, 'registration',
              COALESCE(NULLIF(r.payment_ref, ''), 'upi'),
              'Auto-recorded on approval of registration ' || r.id::text,
              auth.uid());
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

-- Backfill: any active student with user_id set but no user_roles row → insert one.
INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT DISTINCT s.user_id, s.tenant_id, 'student'::app_role
  FROM public.students s
 WHERE s.user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = s.user_id
        AND ur.tenant_id = s.tenant_id
        AND ur.role = 'student'
   )
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;