
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS attendance_qr_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance_qr_token text,
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision,
  ADD COLUMN IF NOT EXISTS geo_radius_m integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS attendance_qr_min_gap_seconds integer NOT NULL DEFAULT 120;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_attendance_qr_token_key
  ON public.tenants (attendance_qr_token) WHERE attendance_qr_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  user_id uuid,
  action text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.attendance_qr_scans TO authenticated;
GRANT ALL ON public.attendance_qr_scans TO service_role;

ALTER TABLE public.attendance_qr_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own tenant qr scans" ON public.attendance_qr_scans;
CREATE POLICY "Staff read own tenant qr scans" ON public.attendance_qr_scans
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE INDEX IF NOT EXISTS attendance_qr_scans_tenant_created_idx
  ON public.attendance_qr_scans (tenant_id, created_at DESC);

-- Distance helper (metres) — plain haversine, no PostGIS dependency.
CREATE OR REPLACE FUNCTION public.geo_distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ---------------------------------------------------------------------------
-- Student self check-in / check-out via the printed academy QR.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qr_attendance_scan(
  _token text,
  _lat double precision,
  _lng double precision,
  _accuracy double precision DEFAULT NULL,
  _local_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t            public.tenants%ROWTYPE;
  s            public.students%ROWTYPE;
  v_uid        uuid := auth.uid();
  v_email      text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_dist       double precision;
  v_date       date := coalesce(_local_date, CURRENT_DATE);
  v_session    uuid;
  v_open       public.attendance_marks%ROWTYPE;
  v_last       timestamptz;
  v_action     text;
  v_total      integer;
  v_meta       jsonb;

  FUNCTION_RESULT jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'result', 'not_signed_in');
  END IF;

  SELECT * INTO t FROM public.tenants
   WHERE attendance_qr_token = _token AND attendance_qr_enabled = true;

  IF t.id IS NULL THEN
    INSERT INTO public.attendance_qr_scans (user_id, lat, lng, accuracy_m, result)
    VALUES (v_uid, _lat, _lng, _accuracy, 'invalid_token');
    RETURN jsonb_build_object('ok', false, 'result', 'invalid_token');
  END IF;

  SELECT * INTO s FROM public.students
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

  IF _accuracy IS NOT NULL AND _accuracy > 200 THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, 'low_accuracy');
    RETURN jsonb_build_object('ok', false, 'result', 'low_accuracy', 'accuracy_m', _accuracy);
  END IF;

  v_dist := public.geo_distance_m(t.geo_lat, t.geo_lng, _lat, _lng);

  IF v_dist > coalesce(t.geo_radius_m, 150) THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'too_far');
    RETURN jsonb_build_object('ok', false, 'result', 'too_far',
      'distance_m', round(v_dist)::int, 'radius_m', coalesce(t.geo_radius_m, 150));
  END IF;

  SELECT max(created_at) INTO v_last FROM public.attendance_qr_scans
   WHERE student_id = s.id AND result = 'ok';

  IF v_last IS NOT NULL
     AND v_last > now() - make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120)) THEN
    INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
    VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'rate_limited');
    RETURN jsonb_build_object('ok', false, 'result', 'rate_limited',
      'retry_after_seconds',
      ceil(extract(epoch FROM (v_last + make_interval(secs => coalesce(t.attendance_qr_min_gap_seconds, 120))) - now()))::int);
  END IF;

  v_meta := jsonb_build_object('lat', _lat, 'lng', _lng, 'accuracy_m', _accuracy, 'distance_m', round(v_dist)::int, 'via', 'qr');

  -- Any currently open visit today → this scan is a CHECK OUT.
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
     WHERE id = v_open.id;
    v_action := 'check_out';
  ELSE
    IF s.batch_id IS NULL THEN
      INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, lat, lng, accuracy_m, distance_m, result)
      VALUES (t.id, s.id, v_uid, _lat, _lng, _accuracy, v_dist, 'no_batch');
      RETURN jsonb_build_object('ok', false, 'result', 'no_batch');
    END IF;

    SELECT id INTO v_session FROM public.attendance_sessions
     WHERE tenant_id = t.id AND batch_id = s.batch_id AND session_date = v_date;
    IF v_session IS NULL THEN
      INSERT INTO public.attendance_sessions (tenant_id, batch_id, session_date)
      VALUES (t.id, s.batch_id, v_date)
      RETURNING id INTO v_session;
    END IF;

    INSERT INTO public.attendance_marks
      (tenant_id, session_id, student_id, status, check_in_at, source, marked_by, check_in_meta)
    VALUES
      (t.id, v_session, s.id, 'present', now(), 'qr', v_uid, v_meta);
    v_action := 'check_in';
  END IF;

  INSERT INTO public.attendance_qr_scans (tenant_id, student_id, user_id, action, lat, lng, accuracy_m, distance_m, result)
  VALUES (t.id, s.id, v_uid, v_action, _lat, _lng, _accuracy, v_dist, 'ok');

  SELECT coalesce(sum(m.duration_minutes), 0)::int INTO v_total
    FROM public.attendance_marks m
    JOIN public.attendance_sessions ses ON ses.id = m.session_id
   WHERE m.student_id = s.id AND m.superseded_by IS NULL AND ses.session_date = v_date;

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
$$;

REVOKE ALL ON FUNCTION public.qr_attendance_scan(text, double precision, double precision, double precision, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qr_attendance_scan(text, double precision, double precision, double precision, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Owner/admin settings for QR attendance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_attendance_qr_settings(
  _tenant_id uuid,
  _enabled boolean DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _radius_m integer DEFAULT NULL,
  _rotate_token boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.tenants%ROWTYPE;
BEGIN
  IF NOT (public.is_tenant_owner(_tenant_id, auth.uid())
          OR public.has_role(auth.uid(), _tenant_id, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  UPDATE public.tenants SET
    attendance_qr_enabled = coalesce(_enabled, attendance_qr_enabled),
    geo_lat = coalesce(_lat, geo_lat),
    geo_lng = coalesce(_lng, geo_lng),
    geo_radius_m = coalesce(greatest(least(_radius_m, 1000), 50), geo_radius_m),
    attendance_qr_token = CASE
      WHEN _rotate_token OR attendance_qr_token IS NULL
        THEN encode(gen_random_bytes(16), 'hex')
      ELSE attendance_qr_token END
  WHERE id = _tenant_id
  RETURNING * INTO t;

  RETURN jsonb_build_object(
    'enabled', t.attendance_qr_enabled,
    'token', t.attendance_qr_token,
    'lat', t.geo_lat,
    'lng', t.geo_lng,
    'radius_m', t.geo_radius_m
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_attendance_qr_settings(uuid, boolean, double precision, double precision, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_attendance_qr_settings(uuid, boolean, double precision, double precision, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_attendance_qr_settings(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t public.tenants%ROWTYPE;
BEGIN
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = _tenant_id;
  RETURN jsonb_build_object(
    'enabled', t.attendance_qr_enabled,
    'token', t.attendance_qr_token,
    'lat', t.geo_lat,
    'lng', t.geo_lng,
    'radius_m', t.geo_radius_m,
    'min_gap_seconds', t.attendance_qr_min_gap_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_qr_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_qr_settings(uuid) TO authenticated;
