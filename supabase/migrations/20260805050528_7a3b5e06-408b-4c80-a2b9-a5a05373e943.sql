ALTER TABLE public.students ADD COLUMN IF NOT EXISTS card_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS students_card_token_key ON public.students(card_token);

CREATE OR REPLACE FUNCTION public.staff_scan_student_card(_card_token uuid, _local_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t         public.tenants%ROWTYPE;
  s         public.students%ROWTYPE;
  v_uid     uuid := auth.uid();
  v_date    date := coalesce(_local_date, CURRENT_DATE);
  v_session uuid;
  v_open    public.attendance_marks%ROWTYPE;
  v_last    timestamptz;
  v_action  text;
  v_total   int;
  v_meta    jsonb;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'result', 'not_signed_in');
  END IF;

  SELECT * INTO s FROM public.students WHERE card_token = _card_token;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'result', 'invalid_card');
  END IF;

  SELECT * INTO t FROM public.tenants WHERE id = s.tenant_id;
  IF t.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'result', 'invalid_card');
  END IF;

  v_allowed := (t.owner_id = v_uid)
    OR public.has_role(v_uid, t.id, 'owner')
    OR public.has_role(v_uid, t.id, 'admin')
    OR public.has_role(v_uid, t.id, 'head_coach')
    OR public.has_role(v_uid, t.id, 'coach')
    OR public.has_role(v_uid, t.id, 'assistant_coach')
    OR (s.batch_id IS NOT NULL AND public.is_coach_for_batch(s.batch_id));

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'result', 'not_staff');
  END IF;

  IF s.lifecycle_status = 'left' OR s.status = 'left' THEN
    RETURN jsonb_build_object('ok', false, 'result', 'inactive_student');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(s.id::text, 0));

  IF v_date < CURRENT_DATE - 1 OR v_date > CURRENT_DATE + 1 THEN
    v_date := CURRENT_DATE;
  END IF;

  SELECT max(created_at) INTO v_last
  FROM public.attendance_qr_scans
  WHERE student_id = s.id AND result = 'ok';

  IF v_last IS NOT NULL
     AND v_last > now() - make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120)) THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, result)
    VALUES (t.id, s.id, v_uid, 'rate_limited');
    RETURN jsonb_build_object(
      'ok', false,
      'result', 'rate_limited',
      'student_name', s.name,
      'retry_after_seconds',
      greatest(1, ceil(extract(epoch FROM (
        v_last + make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120)) - now()
      )))::int)
    );
  END IF;

  PERFORM public.auto_close_student_stale_attendance(s.id, v_date);

  v_meta := jsonb_build_object('via', 'id_card', 'scanned_by', v_uid);

  SELECT m.* INTO v_open
  FROM public.attendance_marks m
  JOIN public.attendance_sessions ses ON ses.id = m.session_id
  WHERE m.tenant_id = t.id
    AND m.student_id = s.id
    AND m.superseded_by IS NULL
    AND m.status = 'present'
    AND m.check_in_at IS NOT NULL
    AND m.check_out_at IS NULL
    AND ses.session_date = v_date
  ORDER BY m.check_in_at DESC
  LIMIT 1;

  IF v_open.id IS NOT NULL THEN
    UPDATE public.attendance_marks
    SET check_out_at = now(), check_out_meta = v_meta
    WHERE id = v_open.id AND check_out_at IS NULL;
    v_action := 'check_out';
  ELSE
    IF s.batch_id IS NULL THEN
      INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, result)
      VALUES (t.id, s.id, v_uid, 'no_batch');
      RETURN jsonb_build_object('ok', false, 'result', 'no_batch', 'student_name', s.name);
    END IF;

    INSERT INTO public.attendance_sessions (tenant_id, batch_id, session_date)
    VALUES (t.id, s.batch_id, v_date)
    ON CONFLICT (batch_id, session_date) DO NOTHING;

    SELECT id INTO v_session
    FROM public.attendance_sessions
    WHERE tenant_id = t.id AND batch_id = s.batch_id AND session_date = v_date;

    IF v_session IS NULL THEN
      RAISE EXCEPTION 'attendance session unavailable';
    END IF;

    BEGIN
      INSERT INTO public.attendance_marks
        (tenant_id, session_id, student_id, status, check_in_at, source, marked_by, check_in_meta)
      VALUES
        (t.id, v_session, s.id, 'present', now(), 'qr', v_uid, v_meta);
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    v_action := 'check_in';
  END IF;

  INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, action, result)
  VALUES (t.id, s.id, v_uid, v_action, 'ok');

  SELECT coalesce(sum(m.duration_minutes), 0)::int INTO v_total
  FROM public.attendance_marks m
  JOIN public.attendance_sessions ses ON ses.id = m.session_id
  WHERE m.student_id = s.id
    AND m.superseded_by IS NULL
    AND ses.session_date = v_date;

  RETURN jsonb_build_object(
    'ok', true,
    'result', 'ok',
    'action', v_action,
    'student_name', s.name,
    'player_id', s.player_id,
    'academy_name', t.name,
    'at', now(),
    'total_minutes_today', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_scan_student_card(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_scan_student_card(uuid, date) TO authenticated;