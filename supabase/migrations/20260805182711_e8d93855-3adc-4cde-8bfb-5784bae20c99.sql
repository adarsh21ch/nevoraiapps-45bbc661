-- Fix the has_role function to match the 3-argument signature used in RLS and internal checks
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

-- Ensure delete_student_data_v2 uses the correct function calls
CREATE OR REPLACE FUNCTION public.delete_student_data_v2(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _tenant_id uuid;
    _invoice_ids uuid[];
BEGIN
    -- Get tenant_id
    SELECT tenant_id INTO _tenant_id FROM public.students WHERE id = _student_id;
    
    -- Verify caller is owner or admin for this tenant
    IF NOT (
        public.has_role(auth.uid(), _tenant_id, 'owner') OR 
        public.has_role(auth.uid(), _tenant_id, 'admin') OR
        public.is_platform_admin(auth.uid())
    ) THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    -- 1. Billing allocations
    DELETE FROM public.billing_payment_allocations
    WHERE payment_id IN (SELECT id FROM public.billing_payments WHERE student_id = _student_id);
    
    -- 2. Billing payments
    DELETE FROM public.billing_payments WHERE student_id = _student_id;
    
    -- 3. Billing invoices and lines
    SELECT array_agg(id) INTO _invoice_ids FROM public.billing_invoices WHERE student_id = _student_id;
    IF _invoice_ids IS NOT NULL THEN
        DELETE FROM public.billing_invoice_lines WHERE invoice_id = ANY(_invoice_ids);
        DELETE FROM public.billing_invoices WHERE id = ANY(_invoice_ids);
    END IF;
    
    -- 4. Billing charges and subs
    DELETE FROM public.billing_charges WHERE student_id = _student_id;
    DELETE FROM public.billing_subscriptions WHERE student_id = _student_id;
    
    -- 5. Legacy payments
    DELETE FROM public.payments WHERE student_id = _student_id;
    
    -- 6. Student
    DELETE FROM public.students WHERE id = _student_id;
END;
$$;

-- Ensure delete_all_archived_students_v2 uses the correct function calls
CREATE OR REPLACE FUNCTION public.delete_all_archived_students_v2(_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _student_id uuid;
    _count integer := 0;
BEGIN
    -- Verify caller is owner or admin
    IF NOT (
        public.has_role(auth.uid(), _tenant_id, 'owner') OR 
        public.has_role(auth.uid(), _tenant_id, 'admin') OR
        public.is_platform_admin(auth.uid())
    ) THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    FOR _student_id IN (SELECT id FROM public.students WHERE tenant_id = _tenant_id AND status = 'left') LOOP
        PERFORM public.delete_student_data_v2(_student_id);
        _count := _count + 1;
    END LOOP;
    
    RETURN _count;
END;
$$;
