
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present','absent','late');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, session_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_sessions_tenant_all" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.attendance_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_marks TO authenticated;
GRANT ALL ON public.attendance_marks TO service_role;
ALTER TABLE public.attendance_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_marks_tenant_all" ON public.attendance_marks
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS attendance_marks_session_idx ON public.attendance_marks(session_id);
CREATE INDEX IF NOT EXISTS attendance_marks_student_idx ON public.attendance_marks(student_id);
CREATE INDEX IF NOT EXISTS attendance_sessions_tenant_date_idx ON public.attendance_sessions(tenant_id, session_date DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS att_sessions_touch ON public.attendance_sessions;
CREATE TRIGGER att_sessions_touch BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS att_marks_touch ON public.attendance_marks;
CREATE TRIGGER att_marks_touch BEFORE UPDATE ON public.attendance_marks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period text NOT NULL,
  sent_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  channel text NOT NULL DEFAULT 'whatsapp',
  message text,
  whatsapp_url text,
  phone text,
  amount numeric,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, period, sent_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_tenant_all" ON public.reminder_logs
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS reminder_logs_tenant_created_idx ON public.reminder_logs(tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS reminders_touch ON public.reminder_logs;
CREATE TRIGGER reminders_touch BEFORE UPDATE ON public.reminder_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
