-- Create persistence table for match scoring selections
CREATE TABLE public.mc_match_draft_selections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    match_id uuid NOT NULL REFERENCES public.mc_matches(id) ON DELETE CASCADE,
    innings_id uuid NOT NULL REFERENCES public.mc_innings(id) ON DELETE CASCADE,
    
    striker_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
    striker_name text,
    
    non_striker_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
    non_striker_name text,
    
    bowler_athlete_id uuid REFERENCES public.mc_athlete_profiles(id) ON DELETE SET NULL,
    bowler_name text,
    
    updated_at timestamptz DEFAULT now(),
    
    UNIQUE (innings_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mc_match_draft_selections TO authenticated;
GRANT ALL ON public.mc_match_draft_selections TO service_role;

-- RLS
ALTER TABLE public.mc_match_draft_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage match selections"
ON public.mc_match_draft_selections
FOR ALL
TO authenticated
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Function to upsert selections
CREATE OR REPLACE FUNCTION public.upsert_match_draft_selection(
    p_tenant_id uuid,
    p_match_id uuid,
    p_innings_id uuid,
    p_striker_athlete_id uuid DEFAULT NULL,
    p_striker_name text DEFAULT NULL,
    p_non_striker_athlete_id uuid DEFAULT NULL,
    p_non_striker_name text DEFAULT NULL,
    p_bowler_athlete_id uuid DEFAULT NULL,
    p_bowler_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.mc_match_draft_selections (
        tenant_id,
        match_id,
        innings_id,
        striker_athlete_id,
        striker_name,
        non_striker_athlete_id,
        non_striker_name,
        bowler_athlete_id,
        bowler_name,
        updated_at
    )
    VALUES (
        p_tenant_id,
        p_match_id,
        p_innings_id,
        p_striker_athlete_id,
        p_striker_name,
        p_non_striker_athlete_id,
        p_non_striker_name,
        p_bowler_athlete_id,
        p_bowler_name,
        now()
    )
    ON CONFLICT (innings_id)
    DO UPDATE SET
        striker_athlete_id = EXCLUDED.striker_athlete_id,
        striker_name = EXCLUDED.striker_name,
        non_striker_athlete_id = EXCLUDED.non_striker_athlete_id,
        non_striker_name = EXCLUDED.non_striker_name,
        bowler_athlete_id = EXCLUDED.bowler_athlete_id,
        bowler_name = EXCLUDED.bowler_name,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_match_draft_selection TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mc_match_draft_selections;
