UPDATE auth.users
SET encrypted_password = crypt('Platform@2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@academyos.test';

UPDATE auth.users
SET encrypted_password = crypt('Owner@2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'owner@kirklandcricket.test';