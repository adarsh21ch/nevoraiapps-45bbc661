CREATE OR REPLACE FUNCTION public.get_attendance_qr_settings(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.tenants%ROWTYPE;
BEGIN
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = _tenant_id;
  RETURN jsonb_build_object(
    'enabled', coalesce(t.attendance_qr_enabled, false),
    'token', t.attendance_qr_token,
    'lat', t.geo_lat,
    'lng', t.geo_lng,
    'radius_m', coalesce(t.geo_radius_m, 150),
    'min_gap_seconds', coalesce(t.attendance_qr_min_gap_seconds, 120)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_attendance_qr_settings(
  _tenant_id uuid,
  _enabled boolean DEFAULT NULL::boolean,
  _lat double precision DEFAULT NULL::double precision,
  _lng double precision DEFAULT NULL::double precision,
  _radius_m integer DEFAULT NULL::integer,
  _rotate_token boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t public.tenants%ROWTYPE;
BEGIN
  IF NOT (public.is_tenant_owner(auth.uid(), _tenant_id)
          OR public.has_role(auth.uid(), _tenant_id, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  UPDATE public.tenants SET
    attendance_qr_enabled = coalesce(_enabled, attendance_qr_enabled, false),
    geo_lat = coalesce(_lat, geo_lat),
    geo_lng = coalesce(_lng, geo_lng),
    geo_radius_m = coalesce(greatest(least(_radius_m, 1000), 50), geo_radius_m, 150),
    attendance_qr_token = CASE
      WHEN _rotate_token OR attendance_qr_token IS NULL
        THEN encode(gen_random_bytes(16), 'hex')
      ELSE attendance_qr_token END
  WHERE id = _tenant_id
  RETURNING * INTO t;

  RETURN jsonb_build_object(
    'enabled', coalesce(t.attendance_qr_enabled, false),
    'token', t.attendance_qr_token,
    'lat', t.geo_lat,
    'lng', t.geo_lng,
    'radius_m', coalesce(t.geo_radius_m, 150),
    'min_gap_seconds', coalesce(t.attendance_qr_min_gap_seconds, 120)
  );
END;
$function$;