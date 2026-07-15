
-- Anon read policies scoped to matches that belong to a published + public tournament.
-- Enables the public tournament website (fixtures, live matches, results, analytics, awards)
-- without exposing internal/tenant-only data.

GRANT SELECT ON public.mc_tournaments TO anon;
GRANT SELECT ON public.mc_tournament_teams TO anon;
GRANT SELECT ON public.mc_tournament_rounds TO anon;
GRANT SELECT ON public.mc_matches TO anon;
GRANT SELECT ON public.mc_teams TO anon;
GRANT SELECT ON public.mc_innings TO anon;
GRANT SELECT ON public.mc_ball_events TO anon;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_matches'
      AND policyname = 'Public read matches of published tournaments'
  ) THEN
    CREATE POLICY "Public read matches of published tournaments"
      ON public.mc_matches
      FOR SELECT
      TO anon
      USING (
        tournament_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.mc_tournaments t
          WHERE t.id = mc_matches.tournament_id
            AND t.published = true
            AND t.visibility = 'public'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_teams'
      AND policyname = 'Public read teams in published tournaments'
  ) THEN
    CREATE POLICY "Public read teams in published tournaments"
      ON public.mc_teams
      FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.mc_tournament_teams tt
          JOIN public.mc_tournaments t ON t.id = tt.tournament_id
          WHERE tt.team_id = mc_teams.id
            AND t.published = true
            AND t.visibility = 'public'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_innings'
      AND policyname = 'Public read innings of published tournament matches'
  ) THEN
    CREATE POLICY "Public read innings of published tournament matches"
      ON public.mc_innings
      FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.mc_matches m
          JOIN public.mc_tournaments t ON t.id = m.tournament_id
          WHERE m.id = mc_innings.match_id
            AND t.published = true
            AND t.visibility = 'public'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mc_ball_events'
      AND policyname = 'Public read ball events of published tournament matches'
  ) THEN
    CREATE POLICY "Public read ball events of published tournament matches"
      ON public.mc_ball_events
      FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.mc_matches m
          JOIN public.mc_tournaments t ON t.id = m.tournament_id
          WHERE m.id = mc_ball_events.match_id
            AND t.published = true
            AND t.visibility = 'public'
        )
      );
  END IF;
END $$;
