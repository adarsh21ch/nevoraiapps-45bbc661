ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS village_locality text,
ADD COLUMN IF NOT EXISTS permanent_address text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
