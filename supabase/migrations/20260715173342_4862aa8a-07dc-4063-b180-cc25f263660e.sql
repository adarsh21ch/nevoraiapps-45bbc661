
-- Approval workflow columns for coach remarks
ALTER TABLE public.mc_coach_remarks
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_by_role text;

CREATE INDEX IF NOT EXISTS mc_coach_remarks_pending_idx
  ON public.mc_coach_remarks (tenant_id, approval_status)
  WHERE approval_status = 'pending';

-- Tighten parent visibility: only approved + visible remarks
DROP POLICY IF EXISTS "Parents view visible remarks for linked children" ON public.mc_coach_remarks;
CREATE POLICY "Parents view visible remarks for linked children"
  ON public.mc_coach_remarks
  FOR SELECT TO authenticated
  USING (
    visible_to_parents = true
    AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.mc_parent_links l
      WHERE l.parent_user_id = auth.uid()
        AND l.student_id = mc_coach_remarks.student_id
    )
  );

DROP POLICY IF EXISTS "parent read child remarks" ON public.mc_coach_remarks;
CREATE POLICY "parent read child remarks"
  ON public.mc_coach_remarks
  FOR SELECT TO authenticated
  USING (
    visible_to_parents = true
    AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.mc_parent_links l
      WHERE l.parent_user_id = auth.uid()
        AND l.student_id = mc_coach_remarks.student_id
    )
  );

DROP POLICY IF EXISTS "student self read remarks" ON public.mc_coach_remarks;
CREATE POLICY "student self read remarks"
  ON public.mc_coach_remarks
  FOR SELECT TO authenticated
  USING (
    visible_to_parents = true
    AND approval_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = mc_coach_remarks.student_id
        AND s.user_id = auth.uid()
    )
  );

-- Coach onboarding tracker on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_onboarded_at timestamptz;
