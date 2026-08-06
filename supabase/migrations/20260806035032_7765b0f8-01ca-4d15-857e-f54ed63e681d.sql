-- V2 returns JSONB array of {registration_id, student_id}
CREATE OR REPLACE FUNCTION public.bulk_approve_registrations_v2(
  _tenant_id uuid,
  _ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg_id uuid;
  new_id uuid;
  result jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_tenant_member(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOREACH reg_id IN ARRAY _ids
  LOOP
    BEGIN
      new_id := public.approve_registration(reg_id);
      result := result || jsonb_build_object(
        'registration_id', reg_id,
        'student_id', new_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip individual failures in bulk
      RAISE NOTICE 'Failed to approve registration %: %', reg_id, SQLERRM;
    END;
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_approve_registrations_v2(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_approve_registrations_v2(uuid, uuid[]) TO service_role;
