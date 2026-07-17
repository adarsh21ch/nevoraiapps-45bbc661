UPDATE auth.users
SET email = 'rajivbilthare@gmail.com',
    encrypted_password = crypt('Sai@sports2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '569aad94-6e4c-4704-8ed3-908abe1b2d4b';

UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', '"rajivbilthare@gmail.com"'),
    updated_at = now()
WHERE user_id = '569aad94-6e4c-4704-8ed3-908abe1b2d4b' AND provider = 'email';