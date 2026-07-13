CREATE TABLE public.mc_coach_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_name text,
  remark text NOT NULL,
  visible_to_parents boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mc_coach_remarks_student_created_idx
  ON public.mc_coach_remarks (student_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_coach_remarks TO authenticated;
GRANT ALL ON public.mc_coach_remarks TO service_role;

ALTER TABLE public.mc_coach_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage remarks"
  ON public.mc_coach_remarks
  FOR ALL
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Parents view visible remarks for linked children"
  ON public.mc_coach_remarks
  FOR SELECT
  TO authenticated
  USING (
    visible_to_parents = true
    AND EXISTS (
      SELECT 1 FROM public.mc_parent_links l
      WHERE l.parent_user_id = auth.uid()
        AND l.student_id = mc_coach_remarks.student_id
    )
  );

CREATE TRIGGER mc_coach_remarks_touch
  BEFORE UPDATE ON public.mc_coach_remarks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();