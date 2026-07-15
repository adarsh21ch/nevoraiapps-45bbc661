
CREATE TABLE IF NOT EXISTS public.coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  coach_user_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  coach_role public.app_role NOT NULL DEFAULT 'coach',
  active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coach_assignments_unique_active
  ON public.coach_assignments(batch_id, coach_user_id) WHERE active;
CREATE INDEX IF NOT EXISTS coach_assignments_tenant_idx ON public.coach_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS coach_assignments_coach_idx ON public.coach_assignments(coach_user_id) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_assignments TO authenticated;
GRANT ALL ON public.coach_assignments TO service_role;

ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_assignments owner/admin manage"
  ON public.coach_assignments FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner')
    OR public.has_role(auth.uid(), tenant_id, 'admin')
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), tenant_id, 'owner')
    OR public.has_role(auth.uid(), tenant_id, 'admin')
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "coach_assignments coach reads own"
  ON public.coach_assignments FOR SELECT TO authenticated
  USING (coach_user_id = auth.uid());

CREATE TRIGGER trg_coach_assignments_updated
  BEFORE UPDATE ON public.coach_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  invited_role public.app_role NOT NULL DEFAULT 'coach',
  token TEXT NOT NULL UNIQUE,
  temp_password_hash TEXT,
  invited_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS staff_invitations_tenant_idx ON public.staff_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS staff_invitations_email_idx ON public.staff_invitations(lower(email)) WHERE email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invitations TO authenticated;
GRANT ALL ON public.staff_invitations TO service_role;

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_invitations owner/admin manage"
  ON public.staff_invitations FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), tenant_id, 'owner')
    OR public.has_role(auth.uid(), tenant_id, 'admin')
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), tenant_id, 'owner')
    OR public.has_role(auth.uid(), tenant_id, 'admin')
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "staff_invitations invitee reads own"
  ON public.staff_invitations FOR SELECT TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE TRIGGER trg_staff_invitations_updated
  BEFORE UPDATE ON public.staff_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_coach_for_batch(_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_assignments
    WHERE batch_id = _batch_id
      AND coach_user_id = auth.uid()
      AND active
  );
$$;

REVOKE ALL ON FUNCTION public.is_coach_for_batch(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_for_batch(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_coach_batches()
RETURNS TABLE (
  batch_id UUID,
  tenant_id UUID,
  name TEXT,
  timing TEXT,
  coach_role public.app_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.tenant_id, b.name, b.timing, ca.coach_role
  FROM public.batches b
  JOIN public.coach_assignments ca ON ca.batch_id = b.id
  WHERE ca.coach_user_id = auth.uid()
    AND ca.active
    AND b.active;
$$;

REVOKE ALL ON FUNCTION public.list_my_coach_batches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_coach_batches() TO authenticated;

DROP POLICY IF EXISTS "attendance_sessions coach access" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions coach access"
  ON public.attendance_sessions FOR ALL TO authenticated
  USING (public.is_coach_for_batch(batch_id))
  WITH CHECK (public.is_coach_for_batch(batch_id));

DROP POLICY IF EXISTS "attendance_marks coach access" ON public.attendance_marks;
CREATE POLICY "attendance_marks coach access"
  ON public.attendance_marks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_marks.session_id
        AND public.is_coach_for_batch(s.batch_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = attendance_marks.session_id
        AND public.is_coach_for_batch(s.batch_id)
    )
  );
