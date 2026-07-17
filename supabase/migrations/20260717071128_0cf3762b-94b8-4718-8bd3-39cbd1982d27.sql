-- Update approve_registration: set review_status, link students to applicant
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

  -- Mark BOTH status and review_status so the student-side gate clears
  -- immediately (review_status='pending' otherwise keeps redirecting them
  -- to /student/pending).
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

-- Backfill: link existing "dsff" student to the applicant + mark the
-- registration's review_status as approved so this account can sign in
-- straight into the student dashboard.
UPDATE public.students
   SET user_id = 'baf3985e-185c-4dc1-b3e5-7207f4442516',
       email = 'virallcomment@gmail.com'
 WHERE id = '3f2492ff-67ad-4cf2-85f1-084a87026e2a'
   AND user_id IS NULL;

UPDATE public.registrations
   SET review_status = 'approved',
       reviewed_at = COALESCE(reviewed_at, now())
 WHERE id = 'cacaa32f-a54e-4629-828a-d8e8787a2062'
   AND status = 'approved'
   AND review_status <> 'approved';