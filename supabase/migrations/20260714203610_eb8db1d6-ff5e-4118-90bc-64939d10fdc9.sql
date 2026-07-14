
-- 1. Extend leads with pipeline fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS counselling_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_rating int,
  ADD COLUMN IF NOT EXISTS trial_remarks text,
  ADD COLUMN IF NOT EXISTS converted_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_pipeline_stage_chk CHECK (pipeline_stage IN
      ('new','contacted','counselling','trial','decision','approved','rejected','converted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_trial_rating_chk CHECK (trial_rating IS NULL OR (trial_rating BETWEEN 1 AND 5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS leads_tenant_pipeline_idx ON public.leads(tenant_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS leads_tenant_assigned_idx ON public.leads(tenant_id, assigned_to);

-- Backfill pipeline_stage from legacy status if present
UPDATE public.leads SET pipeline_stage =
  CASE status
    WHEN 'new' THEN 'new'
    WHEN 'contacted' THEN 'contacted'
    WHEN 'won' THEN 'converted'
    WHEN 'lost' THEN 'rejected'
    ELSE 'new'
  END
WHERE pipeline_stage = 'new';

-- 2. Admission timeline
CREATE TABLE IF NOT EXISTS public.admission_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_stage text,
  to_stage text,
  remark text,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admission_timeline TO authenticated;
GRANT ALL ON public.admission_timeline TO service_role;

ALTER TABLE public.admission_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant read admission_timeline" ON public.admission_timeline;
CREATE POLICY "tenant read admission_timeline" ON public.admission_timeline
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "tenant insert admission_timeline" ON public.admission_timeline;
CREATE POLICY "tenant insert admission_timeline" ON public.admission_timeline
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS admission_timeline_tenant_created_idx ON public.admission_timeline(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admission_timeline_lead_idx ON public.admission_timeline(lead_id);
CREATE INDEX IF NOT EXISTS admission_timeline_student_idx ON public.admission_timeline(student_id);
CREATE INDEX IF NOT EXISTS admission_timeline_reg_idx ON public.admission_timeline(registration_id);

-- 3. RPC: advance_lead_stage
CREATE OR REPLACE FUNCTION public.advance_lead_stage(
  _lead_id uuid, _new_stage text, _remark text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l public.leads%ROWTYPE;
  tl_id uuid;
BEGIN
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), l.tenant_id) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _new_stage NOT IN ('new','contacted','counselling','trial','decision','approved','rejected','converted') THEN
    RAISE EXCEPTION 'Invalid stage %', _new_stage;
  END IF;

  UPDATE public.leads
     SET pipeline_stage = _new_stage,
         status = CASE _new_stage
           WHEN 'converted' THEN 'won'
           WHEN 'rejected' THEN 'lost'
           WHEN 'contacted' THEN 'contacted'
           ELSE status END
   WHERE id = _lead_id;

  INSERT INTO public.admission_timeline
    (tenant_id, lead_id, event_type, from_stage, to_stage, remark, actor_id)
  VALUES
    (l.tenant_id, l.id, 'stage_changed', l.pipeline_stage, _new_stage, _remark, auth.uid())
  RETURNING id INTO tl_id;

  RETURN tl_id;
END; $$;

-- 4. Extend submit_registration with _lead_id
DROP FUNCTION IF EXISTS public.submit_registration(uuid, text, text, uuid, uuid, date, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION public.submit_registration(
  _tenant_id uuid, _name text, _phone text, _fee_plan_id uuid,
  _batch_id uuid DEFAULT NULL, _dob date DEFAULT NULL,
  _guardian_name text DEFAULT NULL, _guardian_phone text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _policy_acceptances jsonb DEFAULT '[]'::jsonb,
  _lead_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id uuid;
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
    dob, batch_id, fee_plan_id, status, payment_status, policy_acceptances
  ) VALUES (
    _tenant_id, btrim(_name), btrim(_phone), NULLIF(btrim(_whatsapp),''),
    NULLIF(btrim(_guardian_name),''), NULLIF(btrim(_guardian_phone),''),
    _dob, _batch_id, _fee_plan_id, 'new', 'pending',
    COALESCE(_policy_acceptances, '[]'::jsonb)
  ) RETURNING id INTO new_id;

  IF _lead_id IS NOT NULL THEN
    UPDATE public.leads
       SET converted_registration_id = new_id,
           pipeline_stage = CASE WHEN pipeline_stage IN ('converted','rejected') THEN pipeline_stage ELSE 'approved' END
     WHERE id = _lead_id AND tenant_id = _tenant_id;

    INSERT INTO public.admission_timeline
      (tenant_id, lead_id, registration_id, event_type, to_stage, remark)
    VALUES
      (_tenant_id, _lead_id, new_id, 'registration_submitted', 'approved', 'Registration form submitted');
  END IF;

  RETURN new_id;
END; $$;

-- 5. Extend approve_registration to link lead + timeline
CREATE OR REPLACE FUNCTION public.approve_registration(_registration_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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

  INSERT INTO public.students (tenant_id, name, phone, dob, gender, guardian_name, guardian_phone, batch_id, fee_plan_id, status)
  VALUES (r.tenant_id, r.name, r.phone, r.dob, r.gender, r.guardian_name, r.guardian_phone, r.batch_id, r.fee_plan_id, 'active')
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

  UPDATE public.registrations SET status = 'approved' WHERE id = _registration_id;

  -- Link back to any originating lead
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
END; $$;
