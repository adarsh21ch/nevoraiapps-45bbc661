DROP POLICY IF EXISTS "Staff read own tenant qr scans" ON public.attendance_qr_scans;
CREATE POLICY "Staff read own tenant qr scans"
ON public.attendance_qr_scans
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));