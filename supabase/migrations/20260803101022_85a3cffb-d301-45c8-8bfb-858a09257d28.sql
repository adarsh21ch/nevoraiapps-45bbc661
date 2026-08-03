-- Auto-close one student's stale (previous-day) open attendance visits.
CREATE OR REPLACE FUNCTION public.auto_close_student_stale_attendance(_student_id uuid, _today date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH open_marks AS (
    SELECT m.id, m.check_in_at, ses.session_date
    FROM public.attendance_marks m
    JOIN public.attendance_sessions ses ON ses.id = m.session_id
    WHERE m.student_id = _student_id
      AND m.superseded_by IS NULL
      AND m.status = 'present'
      AND m.check_in_at IS NOT NULL
      AND m.check_out_at IS NULL
      AND ses.session_date < _today
  )
  UPDATE public.attendance_marks m
  SET check_out_at = LEAST(
        o.check_in_at + interval '2 hours',
        (o.session_date + time '23:59')::timestamptz
      ),
      check_out_meta = coalesce(m.check_out_meta, '{}'::jsonb)
        || jsonb_build_object('auto', true, 'reason', 'missed_checkout', 'closed_at', now())
  FROM open_marks o
  WHERE m.id = o.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Academy-wide daily cleanup (safe to run repeatedly).
CREATE OR REPLACE FUNCTION public.auto_close_stale_attendance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH open_marks AS (
    SELECT m.id, m.check_in_at, ses.session_date
    FROM public.attendance_marks m
    JOIN public.attendance_sessions ses ON ses.id = m.session_id
    WHERE m.superseded_by IS NULL
      AND m.status = 'present'
      AND m.check_in_at IS NOT NULL
      AND m.check_out_at IS NULL
      AND ses.session_date < CURRENT_DATE
  )
  UPDATE public.attendance_marks m
  SET check_out_at = LEAST(
        o.check_in_at + interval '2 hours',
        (o.session_date + time '23:59')::timestamptz
      ),
      check_out_meta = coalesce(m.check_out_meta, '{}'::jsonb)
        || jsonb_build_object('auto', true, 'reason', 'missed_checkout', 'closed_at', now())
  FROM open_marks o
  WHERE m.id = o.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_close_student_stale_attendance(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_close_stale_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_close_stale_attendance() TO service_role;

-- QR scan: close stale previous-day visits before deciding check-in vs check-out.
CREATE OR REPLACE FUNCTION public.qr_attendance_scan(_token text, _lat double precision, _lng double precision, _accuracy double precision DEFAULT NULL::double precision, _local_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t            public.tenants%ROWTYPE;
  s            public.students%ROWTYPE;
  v_uid        uuid := auth.uid();
  v_email      text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_dist       double precision;
  v_slack      double precision;
  v_date       date := coalesce(_local_date, CURRENT_DATE);
  v_session    uuid;
  v_open       public.attendance_marks%ROWTYPE;
  v_last       timestamptz;
  v_action     text;
  v_total      integer;
  v_meta       jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'result', 'not_signed_in');
  END IF;

  SELECT * INTO t
  FROM public.tenants
  WHERE attendance_qr_token = _token
    AND attendance_qr_enabled = true;

  IF t.id IS NULL THEN
    INSERT INTO public.attendance_qr_scans (user_id, lat, lng, accuracy_m, result)
    VALUES (v_uid, _lat, _lng, _accuracy, 'invalid_token');
    RETURN jsonb_build_object('ok', false, 'result', 'invalid_token');
  END IF;

  SELECT * INTO s
  FROM public.students
  WHERE tenant_id = t.id
    AND lifecycle_status = 'active'
    AND (user_id = v_uid OR (email IS NOT NULL AND v_email <> '' AND lower(email) = v_email))
  ORDER BY created_at
  LIMIT 1;

  IF s.id IS NULL THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, user_id, lat, lng, accuracy_m, result)
    VALUES (t.id, v_uid, _lat, _lng, _accuracy, 'not_student');
    RETURN jsonb_build_object('ok', false, 'result', 'not_student');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(s.id::text, 0));

  IF v_date < CURRENT_DATE - 1 OR v_date > CURRENT_DATE + 1 THEN
    v_date := CURRENT_DATE;
  END IF;

  IF t.geo_lat IS NULL OR t.geo_lng IS NULL THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, 'no_location_set');
    RETURN jsonb_build_object('ok', false, 'result', 'no_location_set');
  END IF;

  IF _lat IS NULL OR _lng IS NULL THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, accuracy_m, result)
    VALUES (t.id, s.id, v_uid, _accuracy, 'no_location');
    RETURN jsonb_build_object('ok', false, 'result', 'no_location');
  END IF;

  IF _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, 'no_location');
    RETURN jsonb_build_object('ok', false, 'result', 'no_location');
  END IF;

  IF _accuracy IS NOT NULL AND _accuracy > 2000 THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, 'low_accuracy');
    RETURN jsonb_build_object('ok', false, 'result', 'low_accuracy', 'accuracy_m', _accuracy);
  END IF;

  v_dist := public.geo_distance_m(t.geo_lat, t.geo_lng, _lat, _lng);
  v_slack := least(coalesce(_accuracy, 0), 250);

  IF v_dist - v_slack > coalesce(t.geo_radius_m, 150) THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'too_far');
    RETURN jsonb_build_object(
      'ok', false,
      'result', 'too_far',
      'distance_m', round(v_dist)::int,
      'radius_m', coalesce(t.geo_radius_m, 150)
    );
  END IF;

  SELECT max(created_at) INTO v_last
  FROM public.attendance_qr_scans
  WHERE student_id = s.id AND result = 'ok';

  IF v_last IS NOT NULL
     AND v_last > now() - make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120)) THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'rate_limited');
    RETURN jsonb_build_object(
      'ok', false,
      'result', 'rate_limited',
      'retry_after_seconds',
      greatest(1, ceil(extract(epoch FROM (
        v_last + make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120)) - now()
      )))::int)
    );
  END IF;

  -- Forgot to check out yesterday? Auto-close it so today starts clean.
  PERFORM public.auto_close_student_stale_attendance(s.id, v_date);

  v_meta := jsonb_build_object(
    'lat', _lat,
    'lng', _lng,
    'accuracy_m', _accuracy,
    'distance_m', round(v_dist)::int,
    'via', 'qr'
  );

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
    WHERE id = v_open.id
      AND check_out_at IS NULL;
    v_action := 'check_out';
  ELSE
    IF s.batch_id IS NULL THEN
      INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
      VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'no_batch');
      RETURN jsonb_build_object('ok', false, 'result', 'no_batch');
    END IF;

    INSERT INTO public.attendance_sessions (tenant_id, batch_id, session_date)
    VALUES (t.id, s.batch_id, v_date)
    ON CONFLICT (batch_id, session_date) DO NOTHING;

    SELECT id INTO v_session
    FROM public.attendance_sessions
    WHERE tenant_id = t.id
      AND batch_id = s.batch_id
      AND session_date = v_date;

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

  INSERT INTO public.attendance_qr_scans
    (tenant_id, student_id, user_id, action, lat, lng, accuracy_m, distance_m, result)
  VALUES
    (t.id, s.id, v_uid, v_action, _lat, _lng, _accuracy, v_dist, 'ok');

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
    'academy_name', t.name,
    'at', now(),
    'distance_m', round(v_dist)::int,
    'total_minutes_today', v_total
  );
END;
$function$;