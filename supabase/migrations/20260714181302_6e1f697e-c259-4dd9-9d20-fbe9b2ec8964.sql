
-- 1) Extra player fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS playing_role text,
  ADD COLUMN IF NOT EXISTS batting_style text,
  ADD COLUMN IF NOT EXISTS bowling_style text,
  ADD COLUMN IF NOT EXISTS bowling_arm text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS school_college text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS medical_notes text,
  ADD COLUMN IF NOT EXISTS coach_name text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_email_lower_uniq
  ON public.students (tenant_id, lower(email)) WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS students_tenant_status_idx ON public.students(tenant_id, status);
CREATE INDEX IF NOT EXISTS students_tenant_joined_idx ON public.students(tenant_id, joined_at);
CREATE INDEX IF NOT EXISTS students_tenant_role_idx  ON public.students(tenant_id, playing_role);

-- 2) Player-ID format: SSA-YYYY-NNNN for new players; existing IDs untouched
CREATE OR REPLACE FUNCTION public.assign_player_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prefix text;
  year_part text;
  next_num int;
  candidate text;
BEGIN
  IF NEW.player_id IS NOT NULL AND btrim(NEW.player_id) <> '' THEN
    RETURN NEW;
  END IF;

  prefix := public.compute_player_prefix(NEW.tenant_id);
  year_part := to_char(COALESCE(NEW.joined_at, CURRENT_DATE), 'YYYY');

  SELECT COALESCE(
    MAX(
      NULLIF(regexp_replace(player_id, '^' || prefix || '-' || year_part || '-', ''), '')::int
    ),
    0
  ) + 1
  INTO next_num
  FROM public.students
  WHERE tenant_id = NEW.tenant_id
    AND player_id ~ ('^' || prefix || '-' || year_part || '-[0-9]+$');

  LOOP
    candidate := prefix || '-' || year_part || '-' || lpad(next_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE tenant_id = NEW.tenant_id AND player_id = candidate
    );
    next_num := next_num + 1;
  END LOOP;

  NEW.player_id := candidate;
  RETURN NEW;
END;
$function$;

-- 3) Status history
CREATE TABLE IF NOT EXISTS public.student_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_status_history TO authenticated;
GRANT ALL ON public.student_status_history TO service_role;

ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read status history" ON public.student_status_history;
CREATE POLICY "tenant members read status history"
  ON public.student_status_history FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS ssh_student_idx ON public.student_status_history(student_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS ssh_tenant_idx  ON public.student_status_history(tenant_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_student_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.student_status_history(tenant_id, student_id, previous_status, new_status, changed_by)
    VALUES (NEW.tenant_id, NEW.id, NULL, COALESCE(NEW.status,'active'), auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.student_status_history(tenant_id, student_id, previous_status, new_status, reason, changed_by)
    VALUES (NEW.tenant_id, NEW.id, OLD.status, NEW.status, NEW.archive_reason, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_status_history ON public.students;
CREATE TRIGGER trg_students_status_history
AFTER INSERT OR UPDATE OF status ON public.students
FOR EACH ROW EXECUTE FUNCTION public.log_student_status_change();

-- 4) Security fix: security_invoker on shared views
ALTER VIEW public.attendance_today SET (security_invoker = on);
ALTER VIEW public.attendance_visits SET (security_invoker = on);

-- 5) Security fix: restrict tenants public exposure via column-level GRANTs
CREATE OR REPLACE VIEW public.tenants_public_directory
WITH (security_invoker = on) AS
SELECT
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix
FROM public.tenants
WHERE status = 'active';

GRANT SELECT ON public.tenants_public_directory TO anon, authenticated;

DROP POLICY IF EXISTS "public read active tenants" ON public.tenants;
DROP POLICY IF EXISTS "auth reads active tenant public info" ON public.tenants;

CREATE POLICY "anon read active tenant marketing cols"
  ON public.tenants FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "auth read active tenant marketing cols"
  ON public.tenants FOR SELECT TO authenticated
  USING (status = 'active');

REVOKE SELECT ON public.tenants FROM anon;
REVOKE SELECT ON public.tenants FROM authenticated;

GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix
) ON public.tenants TO anon;

GRANT SELECT (
  id, slug, name, short_name, tagline, custom_domain,
  logo_url, primary_color, secondary_color, niche, features,
  phone, whatsapp, email, address,
  upi_id, upi_qr_url, status, fee_cycle, player_prefix,
  monthly_price, billing_day, last_paid_date,
  setup_fee, platform_notes, subscription_status, created_at
) ON public.tenants TO authenticated;
