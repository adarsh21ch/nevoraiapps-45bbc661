CREATE OR REPLACE FUNCTION public.delete_student_data_v2(_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _tenant_id uuid;
    _invoice_ids uuid[];
    _payment_ids uuid[];
BEGIN
    -- Get tenant_id and verify caller is owner
    SELECT tenant_id INTO _tenant_id FROM public.students WHERE id = _student_id;
    
    IF NOT public.has_role(auth.uid(), 'admin') AND NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        -- Fallback to is_tenant_owner check if has_role isn't enough
        IF NOT public.is_tenant_owner(auth.uid(), _tenant_id) THEN
            RAISE EXCEPTION 'Forbidden';
        END IF;
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
    -- Verify caller is owner
    IF NOT public.is_tenant_owner(auth.uid(), _tenant_id) THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    FOR _student_id IN (SELECT id FROM public.students WHERE tenant_id = _tenant_id AND status = 'left') LOOP
        PERFORM public.delete_student_data_v2(_student_id);
        _count := _count + 1;
    END LOOP;
    
    RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_data_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_all_archived_students_v2(uuid) TO authenticated;
