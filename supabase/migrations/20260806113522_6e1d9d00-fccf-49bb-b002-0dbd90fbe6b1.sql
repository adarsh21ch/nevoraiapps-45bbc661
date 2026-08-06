ALTER TABLE public.mc_matches 
ADD COLUMN IF NOT EXISTS playing_rules text DEFAULT 'T20';

COMMENT ON COLUMN public.mc_matches.playing_rules IS 'Supported profiles: T20, ODI, Test';

-- Update existing matches to T20 by default as it was the implicit behavior
UPDATE public.mc_matches SET playing_rules = 'T20' WHERE playing_rules IS NULL;
