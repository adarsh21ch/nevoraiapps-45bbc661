
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.platform_sports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🎯',
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled','disabled')),
  version text NOT NULL DEFAULT 'v1',
  launch_date date,
  blurb text,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_sports TO anon, authenticated;
GRANT ALL ON public.platform_sports TO service_role;

ALTER TABLE public.platform_sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled sports"
  ON public.platform_sports FOR SELECT
  USING (status = 'enabled' OR public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage sports"
  ON public.platform_sports FOR ALL
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER platform_sports_updated_at
  BEFORE UPDATE ON public.platform_sports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_sports (key, name, icon, status, version, sort_order, blurb) VALUES
  ('cricket',    'Cricket',       '🏏', 'enabled',  'v1', 10,  'Full ball-by-ball scoring, career records, tournaments and live match sharing.'),
  ('football',   'Football',      '⚽', 'disabled', 'v0', 20,  'Player OS, attendance, billing and website. Match module coming soon.'),
  ('badminton',  'Badminton',     '🏸', 'disabled', 'v0', 30,  'Player OS, attendance, billing and website. Match scoring coming soon.'),
  ('basketball', 'Basketball',    '🏀', 'disabled', 'v0', 40,  'Player OS, attendance, billing and website. Match module coming soon.'),
  ('volleyball', 'Volleyball',    '🏐', 'disabled', 'v0', 50,  'Player OS, attendance, billing and website. Match module coming soon.'),
  ('tennis',     'Tennis',        '🎾', 'disabled', 'v0', 60,  'Player OS, attendance, billing and website. Match module coming soon.'),
  ('swimming',   'Swimming',      '🏊', 'disabled', 'v0', 70,  'Attendance, billing, website and swimmer records.'),
  ('gym',        'Gym / Fitness', '💪', 'disabled', 'v0', 80,  'Members, plans, attendance and billing tuned for gyms.');

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sport_id text
  REFERENCES public.platform_sports(key) ON UPDATE CASCADE;

UPDATE public.tenants
   SET sport_id = COALESCE(NULLIF(features->>'sport',''), 'cricket')
 WHERE sport_id IS NULL;
