
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  contact_whatsapp text NOT NULL DEFAULT '9329040508',
  contact_email text NOT NULL DEFAULT 'team@nevorai.com',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can insert"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
