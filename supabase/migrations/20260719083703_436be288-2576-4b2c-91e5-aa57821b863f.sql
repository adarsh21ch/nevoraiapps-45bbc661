
-- Phase 30 Part A: allow authenticated owners to persist the product-tour "seen" flag
-- without opening the broader profiles table to client writes.
CREATE OR REPLACE FUNCTION public.mark_owner_tour_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
     SET owner_tour_seen_at = v_ts
   WHERE user_id = auth.uid();

  RETURN v_ts;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_owner_tour_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_owner_tour_seen() TO authenticated;
