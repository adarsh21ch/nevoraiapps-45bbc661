UPDATE public.tenants
SET attendance_qr_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE attendance_qr_token IS NULL;