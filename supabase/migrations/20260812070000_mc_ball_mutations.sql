-- Function to delete a ball event and re-sequence subsequent balls
CREATE OR REPLACE FUNCTION public.delete_mc_ball_event(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_innings_id UUID;
    v_seq INT;
BEGIN
    SELECT innings_id, sequence_number INTO v_innings_id, v_seq 
    FROM mc_ball_events 
    WHERE id = p_event_id;

    IF v_innings_id IS NULL THEN
        RETURN;
    END IF;

    DELETE FROM mc_ball_events WHERE id = p_event_id;

    -- Shift sequence numbers down
    UPDATE mc_ball_events 
    SET sequence_number = sequence_number - 1
    WHERE innings_id = v_innings_id AND sequence_number > v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_mc_ball_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mc_ball_event(UUID) TO service_role;

-- Function to update a ball event (e.g. change runs, extras, or dismissal)
CREATE OR REPLACE FUNCTION public.update_mc_ball_event(
    p_event_id UUID,
    p_runs_off_bat INT,
    p_extra_type TEXT,
    p_extra_runs INT,
    p_dismissal_type TEXT,
    p_dismissed_athlete_id UUID,
    p_dismissed_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mc_ball_events 
    SET 
        runs_off_bat = p_runs_off_bat,
        extra_type = p_extra_type,
        extra_runs = p_extra_runs,
        dismissal_type = p_dismissal_type,
        dismissed_athlete_id = p_dismissed_athlete_id,
        dismissed_name = p_dismissed_name,
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_mc_ball_event(UUID, INT, TEXT, INT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_mc_ball_event(UUID, INT, TEXT, INT, TEXT, UUID, TEXT) TO service_role;
