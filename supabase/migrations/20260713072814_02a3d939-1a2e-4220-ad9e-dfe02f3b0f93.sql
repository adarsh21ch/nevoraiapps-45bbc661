
-- =========================================================
-- Athlete Profile Engine
-- =========================================================

-- 1. Athlete Profiles ------------------------------------------------
CREATE TABLE public.mc_athlete_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  primary_sport text NOT NULL DEFAULT 'cricket',
  secondary_sports jsonb NOT NULL DEFAULT '[]'::jsonb,
  dominant_hand text,
  height_cm numeric,
  weight_kg numeric,
  fitness_status text,
  medical_notes text,
  emergency_notes text,
  joining_sport_date date,
  current_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_athlete_profiles TO authenticated;
GRANT ALL ON public.mc_athlete_profiles TO service_role;
ALTER TABLE public.mc_athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their athlete profiles"
  ON public.mc_athlete_profiles FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_athlete_profiles_touch BEFORE UPDATE ON public.mc_athlete_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_athlete_profiles_tenant_idx ON public.mc_athlete_profiles(tenant_id);
CREATE INDEX mc_athlete_profiles_student_idx ON public.mc_athlete_profiles(student_id);

-- 2. Cricket Profiles ------------------------------------------------
CREATE TABLE public.mc_cricket_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  athlete_profile_id uuid NOT NULL REFERENCES public.mc_athlete_profiles(id) ON DELETE CASCADE,
  batting_style text,
  bowling_style text,
  bowling_type text,
  playing_role text,
  preferred_position text,
  jersey_number int,
  dominant_hand text,
  favorite_shot text,
  favorite_delivery text,
  career_status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_cricket_profiles TO authenticated;
GRANT ALL ON public.mc_cricket_profiles TO service_role;
ALTER TABLE public.mc_cricket_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their cricket profiles"
  ON public.mc_cricket_profiles FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_cricket_profiles_touch BEFORE UPDATE ON public.mc_cricket_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_cricket_profiles_athlete_idx ON public.mc_cricket_profiles(athlete_profile_id);

-- 3. Achievements ----------------------------------------------------
CREATE TABLE public.mc_athlete_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  athlete_profile_id uuid NOT NULL REFERENCES public.mc_athlete_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  event_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_athlete_achievements TO authenticated;
GRANT ALL ON public.mc_athlete_achievements TO service_role;
ALTER TABLE public.mc_athlete_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their athlete achievements"
  ON public.mc_athlete_achievements FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_athlete_achievements_touch BEFORE UPDATE ON public.mc_athlete_achievements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_athlete_achievements_athlete_idx ON public.mc_athlete_achievements(athlete_profile_id);

-- 4. Awards ----------------------------------------------------------
CREATE TABLE public.mc_athlete_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  athlete_profile_id uuid NOT NULL REFERENCES public.mc_athlete_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  event_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_athlete_awards TO authenticated;
GRANT ALL ON public.mc_athlete_awards TO service_role;
ALTER TABLE public.mc_athlete_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their athlete awards"
  ON public.mc_athlete_awards FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_athlete_awards_touch BEFORE UPDATE ON public.mc_athlete_awards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_athlete_awards_athlete_idx ON public.mc_athlete_awards(athlete_profile_id);

-- 5. Timeline --------------------------------------------------------
CREATE TABLE public.mc_athlete_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  athlete_profile_id uuid NOT NULL REFERENCES public.mc_athlete_profiles(id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_athlete_timeline TO authenticated;
GRANT ALL ON public.mc_athlete_timeline TO service_role;
ALTER TABLE public.mc_athlete_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage their athlete timeline"
  ON public.mc_athlete_timeline FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_platform_admin(auth.uid()));

CREATE TRIGGER mc_athlete_timeline_touch BEFORE UPDATE ON public.mc_athlete_timeline
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX mc_athlete_timeline_athlete_idx ON public.mc_athlete_timeline(athlete_profile_id);
CREATE INDEX mc_athlete_timeline_date_idx ON public.mc_athlete_timeline(event_date DESC);
