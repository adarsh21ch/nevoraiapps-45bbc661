
-- Columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS player_id text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS player_prefix text;

-- Helper: normalize prefix (3 uppercase letters, fallback ACD)
CREATE OR REPLACE FUNCTION public.compute_player_prefix(_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw text;
  clean text;
BEGIN
  SELECT COALESCE(NULLIF(btrim(player_prefix), ''), name)
    INTO raw
  FROM public.tenants WHERE id = _tenant_id;
  IF raw IS NULL THEN RETURN 'ACD'; END IF;
  clean := upper(regexp_replace(raw, '[^A-Za-z]', '', 'g'));
  IF length(clean) >= 3 THEN
    RETURN substring(clean from 1 for 3);
  ELSIF length(clean) > 0 THEN
    RETURN rpad(clean, 3, 'X');
  END IF;
  RETURN 'ACD';
END;
$$;

-- Assign next player_id for a tenant
CREATE OR REPLACE FUNCTION public.assign_player_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  next_num int;
  candidate text;
BEGIN
  IF NEW.player_id IS NOT NULL AND btrim(NEW.player_id) <> '' THEN
    RETURN NEW;
  END IF;

  prefix := public.compute_player_prefix(NEW.tenant_id);

  SELECT COALESCE(
    MAX(
      NULLIF(regexp_replace(player_id, '^[A-Z]+', ''), '')::int
    ),
    999
  ) + 1
  INTO next_num
  FROM public.students
  WHERE tenant_id = NEW.tenant_id
    AND player_id ~ ('^' || prefix || '[0-9]+$');

  IF next_num < 1000 THEN next_num := 1000; END IF;

  LOOP
    candidate := prefix || next_num::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE tenant_id = NEW.tenant_id AND player_id = candidate
    );
    next_num := next_num + 1;
  END LOOP;

  NEW.player_id := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_assign_player_id ON public.students;
CREATE TRIGGER students_assign_player_id
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.assign_player_id();

-- Backfill existing rows in a deterministic order
DO $$
DECLARE
  r RECORD;
  prefix text;
  next_num int;
  candidate text;
BEGIN
  FOR r IN SELECT id, tenant_id FROM public.students
           WHERE player_id IS NULL OR btrim(player_id) = ''
           ORDER BY tenant_id, created_at LOOP
    prefix := public.compute_player_prefix(r.tenant_id);
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(player_id, '^[A-Z]+', ''), '')::int),
      999
    ) + 1
    INTO next_num
    FROM public.students
    WHERE tenant_id = r.tenant_id
      AND player_id ~ ('^' || prefix || '[0-9]+$');
    IF next_num < 1000 THEN next_num := 1000; END IF;
    LOOP
      candidate := prefix || next_num::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.students
        WHERE tenant_id = r.tenant_id AND player_id = candidate
      );
      next_num := next_num + 1;
    END LOOP;
    UPDATE public.students SET player_id = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Uniqueness within a tenant
CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_player_id_uidx
  ON public.students(tenant_id, player_id);

-- Update approve_registration to carry photo + address
CREATE OR REPLACE FUNCTION public.approve_registration(_registration_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.registrations%rowtype;
  new_student_id uuid;
  fee_amount numeric;
begin
  select * into r from public.registrations where id = _registration_id;
  if not found then raise exception 'Registration not found'; end if;

  if not (public.is_tenant_member(auth.uid(), r.tenant_id) or public.is_platform_admin(auth.uid())) then
    raise exception 'Not authorized';
  end if;

  if r.status = 'approved' then
    raise exception 'Registration already approved';
  end if;

  insert into public.students (
    tenant_id, name, phone, dob, guardian_name, guardian_phone,
    batch_id, fee_plan_id, status, photo_url, address
  ) values (
    r.tenant_id, r.name, r.phone, r.dob, r.guardian_name, r.guardian_phone,
    r.batch_id, r.fee_plan_id, 'active', r.photo_url, r.address
  )
  returning id into new_student_id;

  if r.fee_plan_id is not null and r.payment_status = 'verified' then
    select amount into fee_amount from public.fee_plans where id = r.fee_plan_id;
    if fee_amount is not null then
      insert into public.payments (tenant_id, student_id, amount, type, method, note, recorded_by)
      values (r.tenant_id, new_student_id, fee_amount, 'registration',
              coalesce(nullif(r.payment_ref, ''), 'upi'),
              'Auto-recorded on approval of registration ' || r.id::text,
              auth.uid());
    end if;
  end if;

  update public.registrations set status = 'approved' where id = _registration_id;
  return new_student_id;
end;
$function$;
