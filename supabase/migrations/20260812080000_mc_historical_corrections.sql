-- Function to update a ball's bowler transactionally
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

-- Ensure RLS on mc_teams allows authenticated updates for owners and platform admins
-- The existing "Tenant members manage their teams" policy handles this if they are members.
-- We add a specific policy for scorers to update team names if they are designated scorers.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mc_teams' 
        AND policyname = 'scorers can update team names'
    ) THEN
        CREATE POLICY "scorers can update team names" 
        ON public.mc_teams 
        FOR UPDATE 
        TO authenticated 
        USING (is_match_scorer(auth.uid(), tenant_id))
        WITH CHECK (is_match_scorer(auth.uid(), tenant_id));
    END IF;
END
$$;
