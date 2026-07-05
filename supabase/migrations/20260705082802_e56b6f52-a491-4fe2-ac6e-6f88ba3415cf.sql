
-- ===== TENANTS =====
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  custom_domain text UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#1d4ed8',
  secondary_color text NOT NULL DEFAULT '#0f172a',
  niche text NOT NULL DEFAULT 'academy',
  features jsonb NOT NULL DEFAULT '{"online_registration": true, "fee_tracking": true, "whatsapp_reminders": false, "attendance": false, "powered_by_badge": true}'::jsonb,
  phone text, whatsapp text, email text, address text,
  upi_id text, upi_qr_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ===== PLATFORM ADMINS =====
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read platform admin"
  ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== SECURITY DEFINER HELPERS =====
CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.platform_admins WHERE user_id = _uid) $$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_uid uuid, _tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = _uid AND tenant_id = _tenant) $$;

-- profile policies (using helper functions to avoid recursion)
CREATE POLICY "read own or admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));
CREATE POLICY "admin manages profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- tenants policies
CREATE POLICY "public read active tenants"
  ON public.tenants FOR SELECT TO anon
  USING (status = 'active');
CREATE POLICY "auth read tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_tenant_member(auth.uid(), id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "member updates tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "admin inserts tenant"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "admin deletes tenant"
  ON public.tenants FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- ===== BATCHES =====
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  name text NOT NULL,
  timing text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.batches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active batches"
  ON public.batches FOR SELECT TO anon USING (active = true);
CREATE POLICY "auth read batches"
  ON public.batches FOR SELECT TO authenticated
  USING (active = true OR public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "member manages batches"
  ON public.batches FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== FEE PLANS =====
CREATE TABLE public.fee_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  name text NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fee_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_plans TO authenticated;
GRANT ALL ON public.fee_plans TO service_role;
ALTER TABLE public.fee_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active fee_plans"
  ON public.fee_plans FOR SELECT TO anon USING (active = true);
CREATE POLICY "auth read fee_plans"
  ON public.fee_plans FOR SELECT TO authenticated
  USING (active = true OR public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "member manages fee_plans"
  ON public.fee_plans FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== STUDENTS =====
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  guardian_name text, guardian_phone text,
  dob date, photo_url text,
  batch_id uuid REFERENCES public.batches ON DELETE SET NULL,
  fee_plan_id uuid REFERENCES public.fee_plans ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'registered',
  joined_at date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant scope students"
  ON public.students FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== REGISTRATIONS =====
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  whatsapp text,
  guardian_name text,
  guardian_phone text,
  dob date,
  batch_id uuid REFERENCES public.batches ON DELETE SET NULL,
  fee_plan_id uuid REFERENCES public.fee_plans ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_ref text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public insert registration"
  ON public.registrations FOR INSERT TO anon
  WITH CHECK (status = 'new');
CREATE POLICY "tenant scope registrations"
  ON public.registrations FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== PAYMENTS =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  student_id uuid REFERENCES public.students ON DELETE SET NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  period text,
  method text NOT NULL DEFAULT 'upi',
  receipt_no serial,
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant scope payments"
  ON public.payments FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== SITE CONTENT =====
CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  section text NOT NULL,
  content jsonb NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX site_content_singleton_uidx
  ON public.site_content(tenant_id, section) WHERE section IN ('hero','about');
CREATE INDEX site_content_tenant_section_idx ON public.site_content(tenant_id, section);
CREATE POLICY "public read site_content"
  ON public.site_content FOR SELECT TO anon USING (true);
CREATE POLICY "auth read site_content"
  ON public.site_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "member manages site_content"
  ON public.site_content FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

-- ===== SEED: Kirkland Cricket Academy =====
INSERT INTO public.tenants (slug, name, tagline, niche, primary_color, secondary_color, phone, whatsapp, email, address, upi_id)
VALUES
('kirkland-cricket', 'Kirkland Cricket Academy', 'Where champions are made', 'academy', '#1d4ed8', '#0f172a', '+919999999999', '+919999999999', 'info@kirklandcricket.in', 'MG Road, Bengaluru, Karnataka 560001', 'kirkland@upi'),
('demo-gym', 'PowerHouse Gym', 'Stronger every day', 'gym', '#16a34a', '#052e16', '+919888888888', '+919888888888', 'hello@powerhousegym.in', 'Sector 21, Gurgaon, Haryana 122016', 'powerhouse@upi');

-- Kirkland batches
INSERT INTO public.batches (tenant_id, name, timing)
SELECT t.id, v.name, v.timing
FROM public.tenants t, (VALUES
  ('Morning Session', '6:00 AM – 8:00 AM'),
  ('Evening Session', '4:00 PM – 6:00 PM')
) AS v(name, timing)
WHERE t.slug = 'kirkland-cricket';

-- Kirkland fee plans
INSERT INTO public.fee_plans (tenant_id, name, amount, type, description)
SELECT t.id, v.name, v.amount, v.type, v.description
FROM public.tenants t, (VALUES
  ('Registration Fee', 500, 'registration', 'One-time joining fee'),
  ('Single Session (Monthly)', 1500, 'monthly', 'One session per day, six days a week'),
  ('Both Sessions (Monthly)', 2200, 'monthly', 'Morning + evening sessions'),
  ('Personal Coaching Add-on (Monthly)', 600, 'monthly', 'One-on-one weekly session with head coach')
) AS v(name, amount, type, description)
WHERE t.slug = 'kirkland-cricket';

-- Kirkland site content
INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'hero',
  jsonb_build_object(
    'headline', 'Turn Passion Into Performance',
    'subheadline', 'Bengaluru''s premier cricket academy — professional coaching for ages 7 to 21, from grip to glory.',
    'cta_label', 'Register Now'
  ), 0
FROM public.tenants t WHERE t.slug = 'kirkland-cricket';

INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'about',
  jsonb_build_object(
    'heading', 'A decade of building cricketers',
    'body', 'Founded in 2012, Kirkland Cricket Academy has trained 800+ students, with 40+ selected for state and district teams. Our coaches are BCCI-certified with international playing experience. We focus on technique, fitness, mental game, and match awareness — one player at a time.'
  ), 0
FROM public.tenants t WHERE t.slug = 'kirkland-cricket';

INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'star_players', v.content, v.sort_order
FROM public.tenants t, (VALUES
  (jsonb_build_object('name','Arjun Reddy','achievement','Karnataka U-19 State Team, 2024'), 1),
  (jsonb_build_object('name','Priya Sharma','achievement','South Zone U-16 Selection, 2023'), 2),
  (jsonb_build_object('name','Rohan Mehta','achievement','Bengaluru District Champion, 2024'), 3)
) AS v(content, sort_order)
WHERE t.slug = 'kirkland-cricket';

INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'achievements', v.content, v.sort_order
FROM public.tenants t, (VALUES
  (jsonb_build_object('text','40+ state-level selections since 2012'), 1),
  (jsonb_build_object('text','800+ students trained'), 2),
  (jsonb_build_object('text','3-time inter-academy tournament champions'), 3)
) AS v(content, sort_order)
WHERE t.slug = 'kirkland-cricket';

-- PowerHouse Gym seed
INSERT INTO public.fee_plans (tenant_id, name, amount, type, description)
SELECT t.id, v.name, v.amount, v.type, v.description
FROM public.tenants t, (VALUES
  ('Registration Fee', 1000, 'registration', 'One-time joining fee'),
  ('Monthly Membership', 1800, 'monthly', 'Full gym access, 6 AM – 10 PM')
) AS v(name, amount, type, description)
WHERE t.slug = 'demo-gym';

INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'hero',
  jsonb_build_object(
    'headline', 'Stronger Every Day',
    'subheadline', 'Modern equipment, certified trainers, and programs built for real results.',
    'cta_label', 'Join Now'
  ), 0
FROM public.tenants t WHERE t.slug = 'demo-gym';

INSERT INTO public.site_content (tenant_id, section, content, sort_order)
SELECT t.id, 'about',
  jsonb_build_object(
    'heading', 'A community gym in Gurgaon',
    'body', 'PowerHouse is Gurgaon''s community-first gym — certified trainers, group classes, and a modern strength floor. No contracts, no gimmicks.'
  ), 0
FROM public.tenants t WHERE t.slug = 'demo-gym';
