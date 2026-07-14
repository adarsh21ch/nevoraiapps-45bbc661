
-- 1. Public slug columns (nullable so we can backfill safely, then populate)
ALTER TABLE public.mc_matches  ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE public.mc_teams    ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE public.students    ADD COLUMN IF NOT EXISTS public_slug text;

-- Slug helper: lowercase, [a-z0-9-], collapsed
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(BOTH '-' FROM
    regexp_replace(
      regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  );
$$;

-- Backfill team slugs from short_name / name
UPDATE public.mc_teams t
SET public_slug = COALESCE(
  NULLIF(public.slugify(t.short_name), ''),
  NULLIF(public.slugify(t.name), ''),
  'team-' || substr(t.id::text, 1, 8)
) || '-' || substr(t.id::text, 1, 6)
WHERE t.public_slug IS NULL;

-- Backfill student slugs from name + player_id (guaranteed unique per tenant)
UPDATE public.students s
SET public_slug = COALESCE(NULLIF(public.slugify(s.name), ''), 'player') ||
  CASE WHEN s.player_id IS NOT NULL AND btrim(s.player_id) <> ''
       THEN '-' || lower(s.player_id)
       ELSE '-' || substr(s.id::text, 1, 6) END
WHERE s.public_slug IS NULL;

-- Backfill match slugs: teamA-vs-teamB-yyyymmdd-shortid
UPDATE public.mc_matches m
SET public_slug = (
  SELECT COALESCE(NULLIF(public.slugify(ta.short_name), ''), NULLIF(public.slugify(ta.name), ''), 'team-a')
      || '-vs-'
      || COALESCE(NULLIF(public.slugify(tb.short_name), ''), NULLIF(public.slugify(tb.name), ''), 'team-b')
      || COALESCE('-' || to_char(m.scheduled_date, 'YYYYMMDD'), '')
      || '-' || substr(m.id::text, 1, 6)
  FROM public.mc_teams ta, public.mc_teams tb
  WHERE ta.id = m.team_a_id AND tb.id = m.team_b_id
)
WHERE m.public_slug IS NULL;

-- Uniqueness for public URL lookup
CREATE UNIQUE INDEX IF NOT EXISTS mc_matches_public_slug_uidx ON public.mc_matches (public_slug) WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mc_teams_public_slug_uidx   ON public.mc_teams   (public_slug) WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_public_slug_uidx   ON public.students   (public_slug) WHERE public_slug IS NOT NULL;

-- 2. Prevent duplicate scored deliveries (race condition guard)
CREATE UNIQUE INDEX IF NOT EXISTS mc_ball_events_delivery_uidx
  ON public.mc_ball_events (innings_id, over_number, ball_number, sequence_number);

-- 3. Hot-path indexes
CREATE INDEX IF NOT EXISTS mc_ball_events_match_created_idx
  ON public.mc_ball_events (match_id, created_at);

CREATE INDEX IF NOT EXISTS mc_ball_events_innings_over_idx
  ON public.mc_ball_events (innings_id, over_number, ball_number);

CREATE INDEX IF NOT EXISTS mc_matches_tenant_status_idx
  ON public.mc_matches (tenant_id, status, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS mc_match_squads_match_team_idx
  ON public.mc_match_squads (match_id, team_id);

CREATE INDEX IF NOT EXISTS mc_teams_tenant_idx
  ON public.mc_teams (tenant_id);

CREATE INDEX IF NOT EXISTS students_tenant_idx
  ON public.students (tenant_id);

-- 4. Ensure new matches/teams/students get a slug automatically
CREATE OR REPLACE FUNCTION public.assign_match_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ta_slug text; tb_slug text; base text; candidate text; suffix int := 0;
BEGIN
  IF NEW.public_slug IS NOT NULL AND btrim(NEW.public_slug) <> '' THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(public.slugify(short_name), ''), NULLIF(public.slugify(name), ''), 'team-a')
    INTO ta_slug FROM public.mc_teams WHERE id = NEW.team_a_id;
  SELECT COALESCE(NULLIF(public.slugify(short_name), ''), NULLIF(public.slugify(name), ''), 'team-b')
    INTO tb_slug FROM public.mc_teams WHERE id = NEW.team_b_id;
  base := ta_slug || '-vs-' || tb_slug
        || COALESCE('-' || to_char(NEW.scheduled_date, 'YYYYMMDD'), '')
        || '-' || substr(NEW.id::text, 1, 6);
  candidate := base;
  WHILE EXISTS(SELECT 1 FROM public.mc_matches WHERE public_slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  END LOOP;
  NEW.public_slug := candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS mc_matches_assign_slug ON public.mc_matches;
CREATE TRIGGER mc_matches_assign_slug BEFORE INSERT ON public.mc_matches
  FOR EACH ROW EXECUTE FUNCTION public.assign_match_slug();

CREATE OR REPLACE FUNCTION public.assign_team_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; candidate text; suffix int := 0;
BEGIN
  IF NEW.public_slug IS NOT NULL AND btrim(NEW.public_slug) <> '' THEN RETURN NEW; END IF;
  base := COALESCE(
    NULLIF(public.slugify(NEW.short_name), ''),
    NULLIF(public.slugify(NEW.name), ''),
    'team'
  ) || '-' || substr(NEW.id::text, 1, 6);
  candidate := base;
  WHILE EXISTS(SELECT 1 FROM public.mc_teams WHERE public_slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  END LOOP;
  NEW.public_slug := candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS mc_teams_assign_slug ON public.mc_teams;
CREATE TRIGGER mc_teams_assign_slug BEFORE INSERT ON public.mc_teams
  FOR EACH ROW EXECUTE FUNCTION public.assign_team_slug();

CREATE OR REPLACE FUNCTION public.assign_student_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; candidate text; suffix int := 0;
BEGIN
  IF NEW.public_slug IS NOT NULL AND btrim(NEW.public_slug) <> '' THEN RETURN NEW; END IF;
  base := COALESCE(NULLIF(public.slugify(NEW.name), ''), 'player')
       || CASE WHEN NEW.player_id IS NOT NULL AND btrim(NEW.player_id) <> ''
               THEN '-' || lower(NEW.player_id)
               ELSE '-' || substr(NEW.id::text, 1, 6) END;
  candidate := base;
  WHILE EXISTS(SELECT 1 FROM public.students WHERE public_slug = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
  END LOOP;
  NEW.public_slug := candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS students_assign_slug ON public.students;
CREATE TRIGGER students_assign_slug BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.assign_student_slug();
