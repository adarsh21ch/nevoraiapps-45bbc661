CREATE TABLE public.user_usernames (
  user_id uuid PRIMARY KEY,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_usernames_username_lower_idx ON public.user_usernames (lower(username));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_usernames TO authenticated;
GRANT ALL ON public.user_usernames TO service_role;

ALTER TABLE public.user_usernames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own username"
ON public.user_usernames FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_usernames_set_updated_at
BEFORE UPDATE ON public.user_usernames
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_my_username(_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text := lower(trim(_username));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF uname !~ '^[a-z0-9._]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters: letters, numbers, dot or underscore';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_usernames u WHERE lower(u.username) = uname AND u.user_id <> uid) THEN
    RAISE EXCEPTION 'That username is already taken';
  END IF;

  INSERT INTO public.user_usernames (user_id, username)
  VALUES (uid, uname)
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now();

  RETURN uname;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_username(text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_my_username(text) TO authenticated;