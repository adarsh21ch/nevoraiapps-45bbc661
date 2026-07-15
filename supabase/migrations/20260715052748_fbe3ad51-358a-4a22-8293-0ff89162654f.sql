-- Platform admin: permanently delete a tenant (cascades via FKs)
CREATE OR REPLACE FUNCTION public.platform_delete_tenant(_tenant_id uuid, _confirm_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_name text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform admins can remove a tenant';
  END IF;

  SELECT name INTO actual_name FROM public.tenants WHERE id = _tenant_id;
  IF actual_name IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;
  IF lower(trim(actual_name)) <> lower(trim(_confirm_name)) THEN
    RAISE EXCEPTION 'Confirmation name does not match';
  END IF;

  PERFORM public.log_platform_action(
    _tenant_id, 'tenant', _tenant_id::text, 'delete',
    jsonb_build_object('name', actual_name), NULL
  );

  DELETE FROM public.tenants WHERE id = _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.platform_delete_tenant(uuid, text) TO authenticated;

-- Owner: permanently remove a player and all academy data
CREATE OR REPLACE FUNCTION public.owner_delete_student(_student_id uuid, _confirm_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_tenant uuid;
  s_name   text;
BEGIN
  SELECT tenant_id, name INTO s_tenant, s_name FROM public.students WHERE id = _student_id;
  IF s_tenant IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), s_tenant) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only the academy owner can remove a player';
  END IF;
  IF lower(trim(s_name)) <> lower(trim(_confirm_name)) THEN
    RAISE EXCEPTION 'Confirmation name does not match';
  END IF;

  -- Billing FKs are RESTRICT — clean up explicitly.
  DELETE FROM public.billing_payment_allocations
    WHERE payment_id IN (SELECT id FROM public.billing_payments WHERE student_id = _student_id);
  DELETE FROM public.billing_payments        WHERE student_id = _student_id;
  DELETE FROM public.billing_invoice_adjustments
    WHERE invoice_id IN (SELECT id FROM public.billing_invoices WHERE student_id = _student_id);
  DELETE FROM public.billing_invoice_lines
    WHERE invoice_id IN (SELECT id FROM public.billing_invoices WHERE student_id = _student_id);
  DELETE FROM public.billing_invoices        WHERE student_id = _student_id;
  DELETE FROM public.billing_charges         WHERE student_id = _student_id;
  DELETE FROM public.billing_subscriptions   WHERE student_id = _student_id;

  PERFORM public.log_platform_action(
    s_tenant, 'student', _student_id::text, 'delete',
    jsonb_build_object('name', s_name), NULL
  );

  DELETE FROM public.students WHERE id = _student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_delete_student(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_delete_student(uuid, text) TO authenticated;

-- Owner: remove a member (coach/admin/staff) from the academy
CREATE OR REPLACE FUNCTION public.owner_delete_member(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_tenant uuid;
  p_user   uuid;
  p_role   text;
BEGIN
  SELECT tenant_id, user_id, role INTO p_tenant, p_user, p_role
    FROM public.profiles WHERE id = _profile_id;
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), p_tenant) OR public.is_platform_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Only the academy owner can remove a member';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove yourself';
  END IF;
  IF public.is_platform_admin(p_user) THEN
    RAISE EXCEPTION 'Cannot remove a platform administrator';
  END IF;

  PERFORM public.log_platform_action(
    p_tenant, 'member', _profile_id::text, 'delete',
    jsonb_build_object('user_id', p_user, 'role', p_role), NULL
  );

  DELETE FROM public.profiles WHERE id = _profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_delete_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_delete_member(uuid) TO authenticated;