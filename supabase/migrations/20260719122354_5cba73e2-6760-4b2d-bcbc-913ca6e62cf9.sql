-- Enforce at most one captain and one vice-captain per team per match.
-- Partial unique indexes are cheap, DB-side, and don't affect other write paths.

CREATE UNIQUE INDEX IF NOT EXISTS mc_match_squads_one_captain_per_team
  ON public.mc_match_squads (match_id, team_id)
  WHERE is_captain = true;

CREATE UNIQUE INDEX IF NOT EXISTS mc_match_squads_one_vice_captain_per_team
  ON public.mc_match_squads (match_id, team_id)
  WHERE is_vice_captain = true;