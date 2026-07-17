
CREATE TABLE IF NOT EXISTS public.mc_scoring_locks (
  match_id uuid PRIMARY KEY REFERENCES public.mc_matches(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  session_id text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mc_scoring_locks TO authenticated;
GRANT ALL ON public.mc_scoring_locks TO service_role;

ALTER TABLE public.mc_scoring_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant members read scoring lock" ON public.mc_scoring_locks;
CREATE POLICY "tenant members read scoring lock"
  ON public.mc_scoring_locks FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP FUNCTION IF EXISTS public.acquire_match_scoring_lock(uuid);
DROP FUNCTION IF EXISTS public.release_match_scoring_lock(uuid);
DROP FUNCTION IF EXISTS public.acquire_match_scoring_lock(uuid, text);
DROP FUNCTION IF EXISTS public.release_match_scoring_lock(uuid, text);

CREATE OR REPLACE FUNCTION public.acquire_match_scoring_lock(_match_id uuid, _session_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  lock_row record;
  stale_after interval := interval '90 seconds';
BEGIN
  SELECT id, tenant_id INTO m FROM public.mc_matches WHERE id = _match_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match not found'; END IF;
  IF NOT public.is_tenant_member(auth.uid(), m.tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO lock_row FROM public.mc_scoring_locks WHERE match_id = _match_id FOR UPDATE;

  IF lock_row.match_id IS NULL THEN
    INSERT INTO public.mc_scoring_locks (match_id, tenant_id, owner_user_id, session_id)
    VALUES (_match_id, m.tenant_id, auth.uid(), _session_id);
    RETURN TRUE;
  END IF;

  IF lock_row.owner_user_id = auth.uid() THEN
    UPDATE public.mc_scoring_locks
      SET session_id = _session_id, last_heartbeat_at = now()
      WHERE match_id = _match_id;
    RETURN TRUE;
  END IF;

  IF lock_row.last_heartbeat_at < now() - stale_after THEN
    UPDATE public.mc_scoring_locks
      SET owner_user_id = auth.uid(),
          session_id = _session_id,
          acquired_at = now(),
          last_heartbeat_at = now()
      WHERE match_id = _match_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.release_match_scoring_lock(_match_id uuid, _session_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.mc_scoring_locks
    WHERE match_id = _match_id
      AND owner_user_id = auth.uid()
      AND session_id = _session_id;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.acquire_match_scoring_lock(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_match_scoring_lock(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_match_scoring_lock(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_match_scoring_lock(uuid, text) TO authenticated;
