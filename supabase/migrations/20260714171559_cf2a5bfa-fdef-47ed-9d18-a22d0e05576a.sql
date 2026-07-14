-- ==========================================================================
-- AcademyOS V2 — Phase 02.2 — Attendance Lifecycle (append-only, extensible)
-- ==========================================================================
-- Goal: Extend attendance_marks with a full check-in / check-out lifecycle
-- while keeping history permanent. All new modules (QR, Face, GPS, NFC,
-- WhatsApp, parent notifications) plug in through the `source` enum and
-- the `check_in_meta` / `check_out_meta` JSONB fields — no future schema
-- redesign required. Zero existing rows: safe to migrate.
-- ==========================================================================

-- 1. Source enum (extensible: manual, qr, face, gps, nfc, correction, auto)
DO $$ BEGIN
  CREATE TYPE public.attendance_source AS ENUM
    ('manual','qr','face','gps','nfc','correction','auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend attendance_marks
ALTER TABLE public.attendance_marks
  ADD COLUMN IF NOT EXISTS check_in_at    timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_at   timestamptz,
  ADD COLUMN IF NOT EXISTS source         public.attendance_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS marked_by      uuid,
  ADD COLUMN IF NOT EXISTS check_in_meta  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS check_out_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS corrects_id    uuid REFERENCES public.attendance_marks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by  uuid REFERENCES public.attendance_marks(id) ON DELETE SET NULL;

-- Generated duration (STORED so it can be indexed / read cheaply)
ALTER TABLE public.attendance_marks DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE public.attendance_marks
  ADD COLUMN duration_minutes int GENERATED ALWAYS AS (
    CASE
      WHEN check_in_at IS NOT NULL AND check_out_at IS NOT NULL
      THEN GREATEST(0, (EXTRACT(EPOCH FROM (check_out_at - check_in_at))::int) / 60)
      ELSE NULL
    END
  ) STORED;

-- 3. One active row per (session, student). Corrections supersede via superseded_by.
DROP INDEX IF EXISTS public.attendance_marks_session_student_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_marks_active_uniq
  ON public.attendance_marks (session_id, student_id)
  WHERE superseded_by IS NULL;

-- Helpful reporting indexes
CREATE INDEX IF NOT EXISTS attendance_marks_tenant_checkin_idx
  ON public.attendance_marks (tenant_id, check_in_at);
CREATE INDEX IF NOT EXISTS attendance_marks_student_idx
  ON public.attendance_marks (student_id);

-- 4. Append-only + validation trigger
CREATE OR REPLACE FUNCTION public.attendance_marks_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Basic validation
    IF NEW.check_out_at IS NOT NULL
       AND NEW.check_in_at IS NOT NULL
       AND NEW.check_out_at <= NEW.check_in_at THEN
      RAISE EXCEPTION 'Check-out must be after check-in';
    END IF;
    IF NEW.source = 'correction' AND NEW.corrects_id IS NULL THEN
      RAISE EXCEPTION 'Correction rows must reference the record they correct';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path — append-only enforcement
  -- Identity fields are immutable, always.
  IF NEW.session_id  IS DISTINCT FROM OLD.session_id
   OR NEW.student_id IS DISTINCT FROM OLD.student_id
   OR NEW.tenant_id  IS DISTINCT FROM OLD.tenant_id
   OR NEW.source     IS DISTINCT FROM OLD.source
   OR NEW.corrects_id IS DISTINCT FROM OLD.corrects_id
   OR NEW.check_in_at IS DISTINCT FROM OLD.check_in_at
   OR NEW.check_in_meta IS DISTINCT FROM OLD.check_in_meta THEN
    RAISE EXCEPTION 'Attendance identity/check-in fields are immutable. Create a correction record instead.';
  END IF;

  -- Once completed (checked out or absent), only superseded_by may change.
  IF (OLD.check_out_at IS NOT NULL) OR (OLD.status = 'absent') THEN
    IF NEW.check_out_at  IS DISTINCT FROM OLD.check_out_at
     OR NEW.check_out_meta IS DISTINCT FROM OLD.check_out_meta
     OR NEW.status       IS DISTINCT FROM OLD.status
     OR NEW.note         IS DISTINCT FROM OLD.note THEN
      RAISE EXCEPTION 'Completed attendance is immutable. Create a correction record instead.';
    END IF;
    RETURN NEW;
  END IF;

  -- Active session: only check-out fields + note may be set
  IF NEW.check_out_at IS NOT NULL
     AND NEW.check_in_at IS NOT NULL
     AND NEW.check_out_at <= NEW.check_in_at THEN
    RAISE EXCEPTION 'Check-out must be after check-in';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_marks_guard_trg ON public.attendance_marks;
CREATE TRIGGER attendance_marks_guard_trg
  BEFORE INSERT OR UPDATE ON public.attendance_marks
  FOR EACH ROW EXECUTE FUNCTION public.attendance_marks_guard();

-- 5. Derived "current state per student today" view — single source of truth
CREATE OR REPLACE VIEW public.attendance_today AS
SELECT
  m.id           AS mark_id,
  m.tenant_id,
  m.student_id,
  m.session_id,
  s.session_date,
  s.batch_id,
  m.status,
  m.check_in_at,
  m.check_out_at,
  m.duration_minutes,
  m.source,
  m.marked_by,
  CASE
    WHEN m.status = 'absent' THEN 'absent'
    WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NULL THEN 'in_academy'
    WHEN m.check_in_at IS NOT NULL AND m.check_out_at IS NOT NULL THEN 'checked_out'
    ELSE 'not_marked'
  END::text AS current_state
FROM public.attendance_marks m
JOIN public.attendance_sessions s ON s.id = m.session_id
WHERE s.session_date = CURRENT_DATE
  AND m.superseded_by IS NULL;

GRANT SELECT ON public.attendance_today TO authenticated;
GRANT ALL    ON public.attendance_today TO service_role;

-- 6. Realtime — attendance is one of the highest-frequency modules.
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_marks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
-- REPLICA IDENTITY FULL so UPDATE payloads include old + new (needed for
-- realtime consumers reconciling check_out and superseded_by transitions).
ALTER TABLE public.attendance_marks    REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_sessions REPLICA IDENTITY FULL;

-- 7. Helper server-side function: append-only correction primitive.
-- Client code inserts a new row + sets superseded_by via this function
-- so the two-step is atomic and RLS-checked.
CREATE OR REPLACE FUNCTION public.correct_attendance(
  _original_id uuid,
  _check_in_at timestamptz,
  _check_out_at timestamptz,
  _status public.attendance_status,
  _note text DEFAULT NULL,
  _check_in_meta jsonb DEFAULT '{}'::jsonb,
  _check_out_meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig public.attendance_marks%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO orig FROM public.attendance_marks WHERE id = _original_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original attendance not found'; END IF;
  IF NOT (public.is_tenant_member(auth.uid(), orig.tenant_id)
          OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF orig.superseded_by IS NOT NULL THEN
    RAISE EXCEPTION 'Record already corrected';
  END IF;

  INSERT INTO public.attendance_marks
    (tenant_id, session_id, student_id, status, check_in_at, check_out_at,
     source, marked_by, corrects_id, note, check_in_meta, check_out_meta)
  VALUES
    (orig.tenant_id, orig.session_id, orig.student_id, _status,
     _check_in_at, _check_out_at, 'correction', auth.uid(), _original_id,
     _note, COALESCE(_check_in_meta,'{}'::jsonb), COALESCE(_check_out_meta,'{}'::jsonb))
  RETURNING id INTO new_id;

  UPDATE public.attendance_marks SET superseded_by = new_id WHERE id = _original_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.correct_attendance(uuid,timestamptz,timestamptz,public.attendance_status,text,jsonb,jsonb) TO authenticated;