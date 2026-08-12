-- Add update_mc_ball_bowler RPC if missing
CREATE OR REPLACE FUNCTION public.update_mc_ball_bowler(
    p_event_id UUID,
    p_bowler_athlete_id UUID,
    p_bowler_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mc_ball_events 
    SET 
        bowler_athlete_id = p_bowler_athlete_id,
        bowler_name = p_bowler_name,
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_mc_ball_bowler(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_mc_ball_bowler(UUID, UUID, TEXT) TO service_role;

-- Ensure RLS on mc_teams allows authenticated updates
-- (Assumes existing policy might be too restrictive or missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mc_teams' 
        AND policyname = 'Admins can update teams'
    ) THEN
        CREATE POLICY "Admins can update teams" 
        ON public.mc_teams 
        FOR UPDATE 
        TO authenticated 
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;

-- Ensure RLS on mc_matches allows authenticated updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mc_matches' 
        AND policyname = 'Admins can update matches'
    ) THEN
        CREATE POLICY "Admins can update matches" 
        ON public.mc_matches 
        FOR UPDATE 
        TO authenticated 
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;
