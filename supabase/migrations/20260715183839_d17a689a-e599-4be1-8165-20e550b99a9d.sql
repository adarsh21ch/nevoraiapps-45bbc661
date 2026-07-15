
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS roll_number text,
  ADD COLUMN IF NOT EXISTS activation_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS activation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.validate_student_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.lifecycle_status NOT IN (
    'applied','registration_in_progress','registration_submitted','registration_fee_pending',
    'under_review','approved','rejected','waitlisted','imported','invitation_sent',
    'activated','profile_completed','fee_plan_assigned','batch_assigned',
    'active','inactive','transferred','alumni'
  ) THEN
    RAISE EXCEPTION 'Invalid lifecycle_status: %', NEW.lifecycle_status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_student_lifecycle ON public.students;
CREATE TRIGGER trg_validate_student_lifecycle
  BEFORE INSERT OR UPDATE OF lifecycle_status ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_lifecycle();

CREATE OR REPLACE FUNCTION public.log_student_lifecycle_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    INSERT INTO public.student_status_history(tenant_id, student_id, previous_status, new_status, changed_by)
    VALUES (NEW.tenant_id, NEW.id, OLD.lifecycle_status, NEW.lifecycle_status, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_student_lifecycle ON public.students;
CREATE TRIGGER trg_log_student_lifecycle
  AFTER UPDATE OF lifecycle_status ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_lifecycle_change();

CREATE TABLE IF NOT EXISTS public.student_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'excel',
  file_name text,
  row_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  rolled_back_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_import_batches TO authenticated;
GRANT ALL ON public.student_import_batches TO service_role;
ALTER TABLE public.student_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read import batches"
  ON public.student_import_batches FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tenant owner writes import batches"
  ON public.student_import_batches FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id));

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS sport text,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid,
  ADD COLUMN IF NOT EXISTS student_id uuid;

CREATE INDEX IF NOT EXISTS idx_students_tenant_lifecycle ON public.students(tenant_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_students_activation_token ON public.students(activation_token) WHERE activation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_tenant_review ON public.registrations(tenant_id, review_status);
CREATE INDEX IF NOT EXISTS idx_registrations_applicant ON public.registrations(applicant_user_id) WHERE applicant_user_id IS NOT NULL;

DROP POLICY IF EXISTS "applicant reads own registration" ON public.registrations;
CREATE POLICY "applicant reads own registration"
  ON public.registrations FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());
