-- =============================================================
-- Phase 3 — Realtime, Security & Concurrency Foundation
-- =============================================================

-- 1) app_role enum + user_roles table --------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner','admin','platform_admin','student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL   ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user can read own roles"
    ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Role helpers (security definer, RLS-safe) -----------------------------
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid, _tenant_id uuid, _role public.app_role
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (tenant_id = _tenant_id OR (tenant_id IS NULL AND _role = 'platform_admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public.current_role(_tenant_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
    AND (tenant_id = _tenant_id OR tenant_id IS NULL)
  ORDER BY CASE role
    WHEN 'platform_admin' THEN 0
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'student' THEN 3
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role(uuid) TO authenticated;

-- 3) Backfill from profiles.role -------------------------------------------
-- profiles has (user_id, tenant_id, role text)
INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT p.user_id,
       p.tenant_id,
       CASE p.role
         WHEN 'owner' THEN 'owner'::public.app_role
         WHEN 'coach' THEN 'admin'::public.app_role
         ELSE 'admin'::public.app_role
       END
FROM public.profiles p
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, tenant_id, role)
SELECT pa.user_id, NULL, 'platform_admin'::public.app_role
FROM public.platform_admins pa
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

-- Keep user_roles in sync when profiles change (backward-compat bridge)
CREATE OR REPLACE FUNCTION public._sync_user_role_from_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mapped public.app_role;
BEGIN
  mapped := CASE NEW.role
    WHEN 'owner' THEN 'owner'::public.app_role
    WHEN 'coach' THEN 'admin'::public.app_role
    ELSE 'admin'::public.app_role
  END;
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM public.user_roles
      WHERE user_id = NEW.user_id AND tenant_id = NEW.tenant_id;
  END IF;
  INSERT INTO public.user_roles(user_id, tenant_id, role)
  VALUES (NEW.user_id, NEW.tenant_id, mapped)
  ON CONFLICT (user_id, tenant_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_user_role ON public.profiles;
CREATE TRIGGER trg_sync_user_role
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public._sync_user_role_from_profile();

-- 4) Rate limiting ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits int NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON public.rate_limit_hits(window_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_hits TO authenticated;
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- No user policy: only reachable via SECURITY DEFINER RPC below.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text, _max_hits int, _window_seconds int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  win_start timestamptz := date_trunc('second', now())
     - (EXTRACT(EPOCH FROM now())::bigint % _window_seconds) * interval '1 second';
  cur_hits int;
BEGIN
  -- Garbage-collect old buckets opportunistically
  DELETE FROM public.rate_limit_hits
    WHERE window_start < now() - interval '1 hour';

  INSERT INTO public.rate_limit_hits(bucket_key, window_start, hits)
  VALUES (_key, win_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rate_limit_hits.hits + 1
  RETURNING hits INTO cur_hits;

  RETURN cur_hits <= _max_hits;
END; $$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO anon, authenticated;

-- 5) Bulk attendance -------------------------------------------------------
-- marks: [{ student_id, status, remark? }]
CREATE OR REPLACE FUNCTION public.bulk_mark_attendance(
  _session_id uuid, _marks jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sess record;
  n int := 0;
BEGIN
  SELECT id, tenant_id, batch_id INTO sess
  FROM attendance_sessions WHERE id = _session_id;
  IF sess.id IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), sess.tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Supersede prior marks for the affected students in this session
  UPDATE attendance_marks am
     SET superseded_by = gen_random_uuid()
   WHERE am.session_id = _session_id
     AND am.superseded_by IS NULL
     AND am.student_id IN (
       SELECT (elem->>'student_id')::uuid FROM jsonb_array_elements(_marks) elem
     );

  INSERT INTO attendance_marks (session_id, tenant_id, student_id, status, marked_by, remark)
  SELECT _session_id,
         sess.tenant_id,
         (elem->>'student_id')::uuid,
         (elem->>'status')::text,
         auth.uid(),
         elem->>'remark'
  FROM jsonb_array_elements(_marks) elem;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.bulk_mark_attendance(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_mark_attendance(uuid, jsonb) TO authenticated;

-- 6) Bulk registration approval -------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_approve_registrations(
  _tenant_id uuid, _ids uuid[]
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE registrations
     SET status = 'approved',
         updated_at = now()
   WHERE tenant_id = _tenant_id
     AND id = ANY(_ids)
     AND status IN ('pending','trial');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.bulk_approve_registrations(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_approve_registrations(uuid, uuid[]) TO authenticated;

-- 7) Bulk notification recipient enqueue ----------------------------------
CREATE OR REPLACE FUNCTION public.bulk_enqueue_notification_recipients(
  _campaign_id uuid, _recipient_ids uuid[]
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  camp record;
  n int;
BEGIN
  SELECT id, tenant_id INTO camp FROM comm_campaigns WHERE id = _campaign_id;
  IF camp.id IS NULL THEN RAISE EXCEPTION 'campaign not found'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), camp.tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO comm_campaign_recipients (campaign_id, student_id, status)
  SELECT _campaign_id, r, 'queued'
  FROM UNNEST(_recipient_ids) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.bulk_enqueue_notification_recipients(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_enqueue_notification_recipients(uuid, uuid[]) TO authenticated;

-- 8) Advisory locks for concurrent match scoring --------------------------
-- Use pg_try_advisory_lock keyed on hashtext(match_id). Two scorers on the
-- same match will not both hold the lock at once; second caller receives false.
CREATE OR REPLACE FUNCTION public.acquire_match_scoring_lock(_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
BEGIN
  SELECT id, tenant_id INTO m FROM mc_matches WHERE id = _match_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), m.tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN pg_try_advisory_lock(hashtextextended(_match_id::text, 42));
END; $$;

CREATE OR REPLACE FUNCTION public.release_match_scoring_lock(_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN pg_advisory_unlock(hashtextextended(_match_id::text, 42));
END; $$;

REVOKE ALL ON FUNCTION public.acquire_match_scoring_lock(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_match_scoring_lock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_match_scoring_lock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_match_scoring_lock(uuid) TO authenticated;
